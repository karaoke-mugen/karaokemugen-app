const ipcRenderer = require('electron').ipcRenderer
ipcRenderer.on('log', (event, data)=> {
	console.log(data)
	let div =document.getElementById('logs');
	div.innerText = div.innerText +'\n'+data.message
})