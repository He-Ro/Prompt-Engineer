const urlParams = new URLSearchParams(window.location.search);
const player = urlParams.get('player');
var ws = null;

var timeout = 60;
var timer = null;
var countdown_value = null;

function init_player_text() {
	let player_text = document.getElementById("player");
	player_text.innerText = player;
}

function startWebsocket() {
	ws = null;
	ws = new WebSocket('ws://' + document.domain + ':1337')

	ws.onopen = function(){
		console.log("Socket open");
		ws.send(JSON.stringify({"action": "init", "player": player}));
	};

	// Error handling
	ws.onclose = function() {
		console.log("Socket closed");
		setTimeout(startWebsocket, 500);
	};
	ws.onerror = function() {
		console.log("Socket error");
		ws.onclose = null; // Avoid recursive restart
		setTimeout(startWebsocket, 500);
	};

	ws.onmessage = function(evt) {
		var received_msg = JSON.parse(evt.data);
		console.log(received_msg);

		if (received_msg["action"] == "clear_inputs") {
			let text = document.getElementById("text_field");
			text.value = "";
		}

		if (received_msg["action"] == "start_image_generation") {
			clearInterval(timer);
			let countdown_div = document.getElementById("countdown");
			countdown_div.style.color = "red";

			// When image generation starts, the text should not be changeable anymore
			let text = document.getElementById("text_field");
			text.disabled= true;
		}

		if (received_msg["action"] == "init_response") {
			let text = document.getElementById("text_field");
			text.disabled= received_msg["text_readonly"];
			text.value = received_msg["current_text"];

			let timeout_value = received_msg["timeout"];
			timeout = timeout_value;

			let question = document.getElementById("question");
			question.innerText = received_msg["question"];
			text.focus();
		}

		if (received_msg["action"] == "show_next_question") {
			let text = document.getElementById("text_field");
			text.disabled= false;
			text.value = "";
			let countdown_div = document.getElementById("countdown");
			countdown_value = timeout;
			countdown_div.style.color = "black";
			countdown_div.innerText = format_time(countdown_value);
			countdown_div.hidden = false;
			countdown_div.style.display = "flex";
			timer = setInterval(update_countdown, 1000);

			let question = document.getElementById("question");
			question.innerText = received_msg["question"];
			text.focus();
		}

		if (received_msg["action"] == "set_timeout") {
			let timeout_value = received_msg["value"];
			timeout = timeout_value;
		}

		if (received_msg["action"] == "change_input_enabled") {
			let text = document.getElementById("text_field");
			text.disabled = !received_msg["activated"];
		}
	}
}

function format_time(seconds) {
	var m = Math.floor(seconds/60);
	var s = seconds % 60;
	return m.toString().padStart(2, '0') + ":" + s.toString().padStart(2, '0');
}


function update_countdown() {
	console.log("update_countdown " + countdown_value);
	countdown_value--;
	var countdown_div = document.getElementById("countdown");
	if (countdown_value < 0) {
		clearInterval(timer);
		let text = document.getElementById("text_field");
		text.disabled= true;
	} else {
		if (countdown_value < 6) {
			countdown_div.style.color = "red";
		}
		countdown_div.innerText = format_time(countdown_value);
	}
}

function handle_input() {
	console.log("func handle_input");

	let text = document.getElementById("text_field").value;
	ws.send(JSON.stringify({"action": "text_update", "player": player, "text": text}));
}

init_player_text();
setTimeout(startWebsocket, 100);
