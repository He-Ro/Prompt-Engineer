var ws = null;
var timeout = 60;
var minTextSize = 8;
var timer = null;
var countdown_value = null;

var current_img = 0;

const images_playery = ["thinking_woman.png", "thought.jpg"];
const images_playerx = ["thinker.jpg", "thinking_man.png"];

function changeClap(player, action) {
	var lh = document.getElementById(player + "-left-hand");
	var rh = document.getElementById(player + "-right-hand");
	var sh = document.getElementById(player + "-static-hand");
	if (action == "start") {
		lh.removeAttribute("hidden");
		rh.removeAttribute("hidden");
		sh.setAttribute("hidden", "hidden");
	}
	if (action == "stop") {
		lh.setAttribute("hidden", "hidden");
		rh.setAttribute("hidden", "hidden");
		sh.removeAttribute("hidden");
	}
}

function startWebsocket() {
	ws = null;
	ws = new WebSocket('ws://' + document.domain + ':1337')

	ws.onopen = function(){
		console.log("Socket open");
		ws.send(JSON.stringify({"action": "init", "player": "Summary"}));
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

		if (received_msg["action"] == "text_update") {
			let div = document.getElementById(received_msg["player"] + "_Text");
			div.innerText = received_msg["text"];
			textFit(div, {minFontSize: minTextSize, maxFontSize: 100, multiLine: true});
		}
		if (received_msg["action"] == "clear_inputs") {
			let divA = document.getElementById("PlayerY_Text");
			divA.innerText = "";
			let divV = document.getElementById("PlayerX_Text");
			divV.innerText = "";
		}
		if (received_msg["action"] == "init_response") {
			let divA = document.getElementById("PlayerY_Text");
			divA.innerText = received_msg["playery_text"];
			textFit(divA, {minFontSize: minTextSize, maxFontSize: 100, multiLine: true});
			let divV = document.getElementById("PlayerX_Text");
			divV.innerText = received_msg["playerx_text"];
			textFit(divV, {minFontSize: minTextSize, maxFontSize: 100, multiLine: true});
			let question = document.getElementById("question");
			question.innerText = received_msg["question"];
			textFit(question, {minFontSize: minTextSize, maxFontSize: 100, multiLine: true});
			let scoreA = document.getElementById("PlayerY_Applaus");
			let scoreV = document.getElementById("PlayerX_Applaus");
			scoreA.hidden = true;
			scoreV.hidden = true;
			set_points("PlayerY", received_msg["points"]["PlayerY"]);
			set_points("PlayerX", received_msg["points"]["PlayerX"]);
			timeout = received_msg["timeout"];
		}
		if (received_msg["action"] == "show_next_question") {
			clearInterval(timer);

			thinking_img = document.getElementById("thinking-img-PlayerX");
			thinking_img.src = "thinking/" + images_playerx[current_img % images_playerx.length];
			thinking_img.hidden = false;
			thinking_img = document.getElementById("thinking-img-PlayerY");
			thinking_img.src = "thinking/" + images_playery[current_img % images_playery.length];
			thinking_img.hidden = false;
			current_img += 1;

			let scoreA = document.getElementById("PlayerY_Applaus");
			let scoreV = document.getElementById("PlayerX_Applaus");
			scoreA.hidden = true;
			scoreV.hidden = true;
			var playery_hand = document.getElementById("PlayerY-static-hand");
			var playerx_hand = document.getElementById("PlayerX-static-hand");
			playery_hand.hidden = true;
			playerx_hand.hidden = true;
			let divA = document.getElementById("PlayerY_Text");
			divA.innerText = "";
			let imgA = document.getElementById("PlayerY_Image");
			imgA.hidden = true;
			let divV = document.getElementById("PlayerX_Text");
			divV.innerText = "";
			let imgV = document.getElementById("PlayerX_Image");
			imgV.hidden = true;
			let question = document.getElementById("question");
			question.innerText = received_msg["question"];
			textFit(question, {minFontSize: minTextSize, maxFontSize: 100, multiLine: true});
			let countdown_div = document.getElementById("countdown");
			countdown_value = timeout;
			countdown_div.style.color = "white";
			countdown_div.innerText = format_time(countdown_value);
			countdown_div.hidden = false;
			countdown_div.style.display = "flex";
			timer = setInterval(update_countdown, 1000);
			let spinners = document.querySelectorAll(".spinner");
			for (let spinner of spinners) {
				spinner.hidden = true;
			}

		}
		if (received_msg["action"] == "show_picture") {
			let spinner = document.querySelector("#" + received_msg["player"] + " .spinner");
			spinner.hidden = true;
			let img = document.getElementById(received_msg["player"] + "_Image");
			img.src = "data:image/png;base64," + received_msg["picture"];
			img.hidden = false;
		}
		if (received_msg["action"] == "applaus_init") {
			for (const tmp_player of ["PlayerY", "PlayerX"]) {
				var sh = document.getElementById(tmp_player + "-static-hand");
				sh.hidden = false;
			}
			let scoreA = document.getElementById("PlayerY_Applaus");
			let scoreV = document.getElementById("PlayerX_Applaus");
			if (received_msg["zero_scores"] == true) {
				scoreA.innerText = "0.0";
				scoreV.innerText = "0.0";
				scoreA.hidden = false;
				scoreV.hidden = false;
				setTimeout(changeClap, 1000, received_msg["player"], "start");
			} else {
				changeClap(received_msg["player"], "start");
			}
		}

		if (received_msg["action"] == "start_image_generation") {
			clearInterval(timer);
			thinking_img = document.getElementById("thinking-img-PlayerX");
			thinking_img.hidden = true;
			thinking_img = document.getElementById("thinking-img-PlayerY");
			thinking_img.hidden = true;

			let imgA = document.getElementById("PlayerX_Image");
			imgA.hidden = true;
			imgA = document.getElementById("PlayerY_Image");
			imgA.hidden = true;

			let spinners = document.querySelectorAll(".spinner");
			for (let spinner of spinners) {
				spinner.hidden = false;
			}
			let countdown_div = document.getElementById("countdown");
			countdown_div.hidden = true;
			countdown_div.style.display = "none";
		}

		if (received_msg["action"] == "applaus_update") {
			let player = received_msg["player"];
			let scoreA = document.getElementById("PlayerY_Applaus");
			let scoreV = document.getElementById("PlayerX_Applaus");
			scoreA.hidden = false;
			scoreV.hidden = false;
			if (player == "PlayerY") {
				scoreA.innerText = received_msg["score"];
			} else {
				scoreV.innerText = received_msg["score"];
			}
			if (!received_msg["active"]) {
				changeClap(received_msg["player"], "stop");
			}
		}

		if (received_msg["action"] == "set_points") {
			let player = received_msg["player"];
			let points = received_msg["points"];
			set_points(player, points);
		}

		if (received_msg["action"] == "set_timeout") {
			let timeout_value = received_msg["value"];
			timeout = timeout_value;
		}
	};
}

function set_points(user, points) {
	points = points.toString().padStart(4, '0')

	if (user == "PlayerY") {
		document.getElementById("Points_PlayerY").innerText = points;
	} else if (user == "PlayerX") {
		document.getElementById("Points_PlayerX").innerText = points;
	} else {
		console.log("Unknown user: " + user);
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
	} else {
		if (countdown_value < 6) {
			countdown_div.style.color = "red";
		}
		countdown_div.innerText = format_time(countdown_value);
	}
}

function resize_handler() {
	console.log("func resize_handler");

	let divA = document.getElementById("PlayerY_Text");
	textFit(divA, {minFontSize: minTextSize, maxFontSize: 100, multiLine: true});
	let divV = document.getElementById("PlayerX_Text");
	textFit(divV, {minFontSize: minTextSize, maxFontSize: 100, multiLine: true});
	let question = document.getElementById("question");
	textFit(question, {minFontSize: minTextSize, maxFontSize: 100, multiLine: true});
}


window.onresize = resize_handler;
setTimeout(startWebsocket, 100);
