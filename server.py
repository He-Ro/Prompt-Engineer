#! /usr/bin/env python3

import argparse
import base64
import configparser
import datetime
import json
import logging
import os
import re
from io import BytesIO

import httpx
import trio
from openai import AsyncOpenAI
from PIL import Image
from trio_websocket import ConnectionClosed, serve_websocket

config = None
PRODUCTION = None
EXIF_USER_COMMENT_TAG = 0x9286

connections = {
    "PlayerY": None,
    "PlayerX": None,
    "Summary": [],
    "Slideshow": None,
}

if os.path.isfile("./images.json"):
    with open("./images.json", "r") as f:
        images = json.load(f)
else:
    images = []

current_image = {
    "PlayerY": None,
    "PlayerX": None,
}

applaus = {
    "show_applaus": False,
    "PlayerY": {"active": False, "value": 0.0},
    "PlayerX": {"active": False, "value": 0.0},
}

current_text = {
    "PlayerY": "",
    "PlayerX": "",
}

game_state = {
    "current_question": "",
    "text_readonly": True,
    "ip_applaus": None,
    "points": {"PlayerY": 0, "PlayerX": 0},
    "timeout": 60,
}


def parse_arguments():
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "local_ip", help="The IP address that should be used to host the app"
    )
    parser.add_argument("ip_applaus", help="The IP address of the applaus-o-meter")
    args = parser.parse_args()
    return args


def send_summary_message(nursery, message):
    if isinstance(message, (list, dict)):
        message = json.dumps(message)
    for connection in connections["Summary"]:
        if connection is not None:
            nursery.start_soon(connection.send_message, message)


async def create_image(nursery, player, prompt):
    filename = ""

    if not re.search("[a-zA-Z0-9]", prompt):
        prompt = "Generate a 404 error image stating that no prompt was provided."

    if PRODUCTION:
        # Create image with Dall_e
        start_time = trio.current_time()
        response = await oai_client.images.generate(
            model=config["dall_e_version"],
            prompt=prompt,
            size=config["image_size"],
            quality="standard",
            response_format="b64_json",
            n=1,
        )
        creation_time = trio.current_time() - start_time
        logging.info(f"Image cration finished in {creation_time}")

        # Parse image and add prompt as tag
        b64_image = response.data[0].b64_json
        img = Image.open(BytesIO(base64.b64decode(b64_image)))
        exif_data = img.getexif()
        exif_data[EXIF_USER_COMMENT_TAG] = bytes.fromhex(
            "554E49434F444500"
        ) + f"Task: {game_state['current_question']} - Prompt: {prompt}".encode(
            "utf-16"
        )

        # Save final image
        with BytesIO() as bytes_output:
            img.save(bytes_output, format="PNG", exif=exif_data)
            filename = f"{player}_{datetime.datetime.now().isoformat('_')}.png"
            async with await trio.open_file("web/images/" + filename, "wb") as f:
                await f.write(bytes_output.getvalue())

    else:
        # Static image paths
        if player == "PlayerY":
            filename = "player1_example_image.png"
        else:
            filename = "player2_example_image.png"

        with open(f"web/images/{filename}", "rb") as f:
            picture = f.read()
            b64_image = base64.b64encode(picture).decode("utf-8")
        await trio.sleep(4)

    # Add image to image list
    images.append({"path": f"images/{filename}", "prompt": prompt})
    with open("./images.json", "w") as f:
        json.dump(images, f)

    # Show finished images
    current_image[player] = b64_image
    message = {"action": "show_picture", "player": player, "picture": b64_image}
    send_summary_message(nursery, json.dumps(message))


async def send_applaus_control(command, http_client):
    try:
        await http_client.get(
            f"http://{game_state['ip_applaus']}:8080/control", params=command
        )
    except httpx.RemoteProtocolError:
        await http_client.get(
            f"http://{game_state['ip_applaus']}:8080/control", params=command
        )


async def ws_handler(request):  # noqa: C901
    ws = await request.accept()
    player = None
    summary_id = None
    async with httpx.AsyncClient() as http_client, trio.open_nursery() as nursery:
        while True:
            try:
                message = json.loads(await ws.get_message())
                action = message["action"]
                if action == "init":
                    player = message.get("player", None)
                    if player not in connections.keys():
                        if player == "controler":
                            logging.info("Connected controler")
                            continue
                        reply = {
                            "action": "error",
                            "message": "Unknown player "
                            + message.get("player", "Unknown"),
                        }
                        await ws.send_message(json.dumps(reply))
                        continue
                    if player == "Summary":
                        # we can have multiple summary pages open
                        summary_id = len(connections[player])
                        connections[player].append(ws)
                    else:
                        if connections[player] is not None:
                            reply = {
                                "action": "error",
                                "message": f"Player {player} is already connected!",
                            }
                            await ws.send_message(json.dumps(reply))
                            continue

                        connections[player] = ws
                    logging.info(f"Connected {player}")
                    init_reply = {
                        "action": "init_response",
                        "question": game_state["current_question"],
                        "text_readonly": game_state["text_readonly"],
                        "points": game_state["points"],
                    }
                    if player in ["PlayerY", "PlayerX"]:
                        init_reply["current_text"] = current_text[player]
                        init_reply["timeout"] = game_state["timeout"]
                    if player == "Slideshow":
                        init_reply["images"] = images
                    if player == "Summary":
                        for x in ["PlayerY", "PlayerX"]:
                            if current_image[x] is not None:
                                message = {
                                    "action": "show_picture",
                                    "player": x,
                                    "picture": current_image[x],
                                }
                                await ws.send_message(json.dumps(message))
                        init_reply["playery_text"] = current_text["PlayerY"]
                        init_reply["playerx_text"] = current_text["PlayerX"]
                        init_reply["timeout"] = game_state["timeout"]
                    await ws.send_message(json.dumps(init_reply))
                elif action == "text_update":
                    player = message["player"]
                    current_text[player] = message["text"]
                    logging.info(f"Text of {player} is: {current_text[player]}")
                    send_summary_message(nursery, message)
                elif action == "clear_inputs":
                    current_text["PlayerY"] = ""
                    current_text["PlayerX"] = ""
                    for player in ["PlayerY", "PlayerX"]:
                        if connections[player] is not None:
                            await connections[player].send_message(json.dumps(message))
                    send_summary_message(nursery, message)
                elif action == "start_image_generation":
                    game_state["text_readonly"] = True
                    send_summary_message(nursery, message)
                    for player in ["PlayerY", "PlayerX"]:
                        if connections[player] is not None:
                            logging.info(
                                f"Sending Message start_image_generation to {player}"
                            )
                            await connections[player].send_message(json.dumps(message))
                        # Start Image generation
                        logging.info("Starting image Generation")
                        nursery.start_soon(
                            create_image, nursery, player, current_text[player]
                        )
                elif action == "show_next_question":
                    game_state["current_question"] = message["question"]
                    game_state["text_readonly"] = False
                    # Reset applaus
                    for player in ["PlayerX", "PlayerY"]:
                        applaus[player]["value"] = 0.0
                        applaus[player]["active"] = False
                    applaus["show_applaus"] = False

                    for player in ["PlayerY", "PlayerX"]:
                        if connections[player] is not None:
                            logging.info(
                                f"Sending Message show_next_question to {player}"
                            )
                            await connections[player].send_message(json.dumps(message))
                        else:
                            logging.warning(
                                f"Want to send message show_next_question to {player}, but that player is disconnected…"
                            )
                    send_summary_message(nursery, message)
                elif action == "start_applaus":
                    player = message["player"]
                    if applaus["PlayerY"]["active"] or applaus["PlayerX"]["active"]:
                        continue
                    first_player_for_applaus = not applaus["show_applaus"]
                    applaus[player]["active"] = True
                    applaus["show_applaus"] = True
                    applaus_init = {
                        "action": "applaus_init",
                        "player": player,
                        "zero_scores": first_player_for_applaus,
                    }
                    logging.info(applaus_init)
                    send_summary_message(nursery, applaus_init)
                    await trio.sleep(0.5)
                    if first_player_for_applaus:
                        # wait a bit more. The hands have just been displayed
                        await trio.sleep(1.0)
                    current_score = str(round(applaus[player]["value"], 1))
                    if "." not in current_score:
                        current_score += ".0"
                    score_update = {
                        "action": "applaus_update",
                        "player": player,
                        "score": current_score,
                        "active": True,
                    }
                    send_summary_message(nursery, score_update)
                    await send_applaus_control(
                        {"cmd": "clear"}, http_client=http_client
                    )
                    # Start Knopf
                    await send_applaus_control(
                        {"cmd": "trigger", "element": 3}, http_client=http_client
                    )
                    # Play Symbol
                    await send_applaus_control(
                        {"cmd": "start"}, http_client=http_client
                    )
                    await fetch_applaus(
                        game_state["ip_applaus"],
                        player,
                        http_client,
                        nursery,
                    )
                    # Pause Symbol
                    await send_applaus_control({"cmd": "stop"}, http_client=http_client)
                    applaus[player]["active"] = False
                    current_score = str(round(applaus[player]["value"], 1))
                    if "." not in current_score:
                        current_score += ".0"
                    score_update = {
                        "action": "applaus_update",
                        "player": player,
                        "score": current_score,
                        "active": False,
                    }
                    send_summary_message(nursery, score_update)

                elif action == "change_points":
                    player = message["player"]
                    game_state["points"][player] += message["value"]
                    points_update = {
                        "action": "set_points",
                        "player": player,
                        "points": game_state["points"][player],
                    }
                    send_summary_message(nursery, points_update)
                elif action == "set_timeout":
                    timeout = message["value"]
                    logging.info("Setting timeout to {timeout}")
                    game_state["timeout"] = timeout
                    for player in ["PlayerY", "PlayerX"]:
                        if connections[player]:
                            await connections[player].send_message(json.dumps(message))
                    send_summary_message(nursery, message)
                elif action == "change_input_enabled":
                    for player in ["PlayerY", "PlayerX"]:
                        if connections[player]:
                            await connections[player].send_message(json.dumps(message))
                else:
                    logging.error(f"Unknown action {action}")
            except ConnectionClosed as e:
                logging.warning(repr(e))
                break
            except Exception as e:
                logging.exception(e)
                break
        if player == "Summary":
            connections["Summary"][summary_id] = None
            logging.info(f"Removing Summary connection {summary_id}")
        elif player in connections.keys():
            logging.warning(f"Removing {player} from connection")
            connections[player] = None


async def fetch_applaus(ip_applaus, player, http_client, nursery, duration=4):
    with trio.move_on_after(duration):
        while True:
            try:
                start_time = trio.current_time()
                response = await http_client.get(
                    f"http://{ip_applaus}:8080/get", params={"scorePlot": "full"}
                )
                json_response = json.loads(response.text)

                logging.info(json_response["buffer"]["scorePlot"])
                scores = json_response["buffer"]["scorePlot"]["buffer"]
                if len(scores) > 0:
                    score = scores[0]
                    applaus[player]["value"] = score
                    logging.debug(f"{player}'s applaus: {score}")
                    current_score = str(round(applaus[player]["value"], 1))
                    if "." not in current_score:
                        current_score += ".0"
                    score_update = {
                        "action": "applaus_update",
                        "player": player,
                        "score": current_score,
                        "active": True,
                    }
                    send_summary_message(nursery, score_update)

                await trio.sleep_until(start_time + 0.1)

            except httpx.ConnectError:
                # Wenn die App nicht an ist, kann auch keine Verbindung aufgebaut werden
                pass


async def main():
    async with trio.open_nursery() as nursery:
        nursery.start_soon(serve_websocket, ws_handler, args.local_ip, 1337, None)


if __name__ == "__main__":
    # Set logging level
    logging.basicConfig(level=logging.INFO)

    # Parse arguments
    args = parse_arguments()
    game_state["ip_applaus"] = args.ip_applaus

    # Load config file
    config = configparser.ConfigParser()
    config.read("config.ini")
    config = config["Prompt Engineer"]
    PRODUCTION = config.getboolean("production")

    # Open OpenAI Api
    if PRODUCTION:
        api_key = config["openai_api_key"]
        oai_client = AsyncOpenAI(api_key=api_key)

    # Start game
    trio.run(main)
