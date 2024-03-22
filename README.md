<img src='https://raw.githubusercontent.com/He-Ro/Prompt-Engineer/main/docs/robot-artist.png'>

# PROMPT ENGINEER

Inspired by [Prompt Battle](https://promptbattle.com/).

A picture is worth more than a thousand words… see for yourself. This is the view that is meant for the audience:

<img src='https://raw.githubusercontent.com/He-Ro/Prompt-Engineer/main/docs/summary_example.png'>

## Installation

1. Create a venv and activate it
   ```
   $ python -m venv venv
   $ source venv/bin/activate
   ```
2. Install the requirements from the requirements file
   ```
   $ pip install -r requirements.txt
   ```
3. Copy the file `example_config.ini` to `config.ini`
4. Adapt the values within the file `config.ini`

## Run the app

1. Identify your local IP address from which the app should be accessible. In the following example, this IP will be `192.168.0.20`.
2. Start the web server
   ```
   $ cd web
   $ python3 -m http.server -b 192.168.0.20 3000
   ```
3. Install the app [Phyphox](https://play.google.com/store/apps/details?id=de.rwth_aachen.phyphox) on your smartphone.
4. Start the Experiment *Applause meter* (*Applausmeter* in German) within Phyphox and enable *Allow remote access* (*Fernzugriff erlauben* in German) in the menu (three-dot menu on Android).
5. Start the websocket server part. The first argument is the listening IP for the server, and the second argument is the IP of your smartphone (Phyphox shows the IP at the bottom of the screen):
   ```
   $ python3 server.py 192.168.0.20 192.168.0.42
   ```
6. Start playing by visiting `http://192.168.0.20:3000` in a browser.

## Playing

The following four pages are available:

1. `/page.html?player=PlayerX` - For the first player
2. `/page.html?player=PlayerY` - For the second player
3. `/controller.html` - For the game master
4. `/summary.html` - For the audience
5. `/slideshow.html` - Useful to show the pictures after the game has finished

Note: In the browser, use the IP address identified in the first step of *Run the app* and do not use `localhost` or `127.0.0.1`.

## Preparing your show

Here are some steps you need to consider when setting up your game show.

1. Prepare a set of tasks for the player and add them to the collection in `web/controller.html`.
2. Obtain your OpenAI key and enter it in the `config.ini` file. Do not forget to set `production = true`.
3. Optimally, provide each player with their own device to enter the prompt.
4. Generated images are stored under `web/images`. The prompt used to generate each image can be retrieved with `exiftool [image]`.

## Development

The set of tools used for development, code formatting, style checking, and testing can be installed with the following command:

```bash
python3 -m pip install -r requirements-dev.txt
```

All tools can be executed manually with the following commands and report errors if encountered:

```bash
black .
flake8
```

A `black` and `flake8` check of modified files before any commit can also be forced using Git's pre-commit hook functionality:

```bash
pre-commit install
```

More information on the black and flake8 setup can be found at https://ljvmiranda921.github.io/notebook/2018/06/21/precommits-using-black-and-flake8/

### Contributions

Thanks to [KonWol](https://github.com/KonWol) for testing, testing, adding features and discussing the game during its development. Due to a fresh Git history, his additions prior to the cut are not attributed to him.
