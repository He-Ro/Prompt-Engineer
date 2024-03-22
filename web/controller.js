var ws = null;

function startWebsocket() {
	ws = null;
	ws = new WebSocket('ws://' + document.domain + ':1337')

	ws.onopen = function(){
		console.log("Socket open");
		ws.send(JSON.stringify({"action": "init", "player": "controler"}));
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
}

function clear_inputs() {
	console.log("func clear_inputs")
	ws.send(JSON.stringify({"action": "clear_inputs"}));
};

function start_image_generation() {
	console.log("func start_image_generation")
	ws.send(JSON.stringify({"action": "start_image_generation"}));
};

function show_next_question() {
	console.log("func show_next_question")

	let question = document.getElementById("question");
	let question_text = question[question.selectedIndex].text;
	// Check if custom question overwrites the question
	let checkbox_custom_question = document.getElementById("checkbox_custom_question");
	if (checkbox_custom_question.checked) {
		let custom_question = document.getElementById("custom_question");
		question_text = custom_question.value;
	}
	console.log(question_text)

	ws.send(JSON.stringify({"action": "show_next_question", "question": question_text}));
};

function start_applaus(player) {
	console.log("func start_applaus " + player)
	ws.send(JSON.stringify({"action": "start_applaus", "player": player}));
};

function change_points(player, value) {
	console.log("func change_points " + player + " " + value)
	ws.send(JSON.stringify({"action": "change_points", "player": player, "value": value}));
};

function set_timeout() {
	console.log("func set_timeout");
	let timeout_value = document.getElementById("timeout_value").value;
	ws.send(JSON.stringify({"action": "set_timeout", "value": timeout_value}));
};

function activate_input(activated) {
	console.log("func activate_input" + activated);
	ws.send(JSON.stringify({"action": "change_input_enabled", "activated": activated}));
};

setTimeout(startWebsocket, 100);
