const ipcRenderer = require('electron').ipcRenderer
console.log(ipcRenderer)
ipcRenderer.on('log', (event, data)=> {
	console.log('appel')
	console.log(event)
	console.log(data)
})