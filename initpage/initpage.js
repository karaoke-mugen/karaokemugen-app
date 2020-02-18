const ipcRenderer = require('electron').ipcRenderer
ipcRenderer.on('initStep', (event, data)=> {
	let div =document.getElementById('init');
	div.innerText = div.innerText +'\n'+data
});
ipcRenderer.on('log', (event, data)=> {
	let div =document.getElementById('logs');
	div.innerHTML = div.innerHTML + "<div>" + data.message + "</div>"
})
ipcRenderer.on('error', (event, data)=> {
	if (!buttonLogsStatus) clickButton();
	let div =document.getElementById('error');
	div.innerHTML = "<div>" + data + "</div>"
})

let buttonLogsStatus = false;
document.getElementById("buttonLogs").onclick = clickButton;

function clickButton () {
	document.getElementById("logs").className = buttonLogsStatus ? 'hidden' : '';
	buttonLogsStatus = !buttonLogsStatus;
}