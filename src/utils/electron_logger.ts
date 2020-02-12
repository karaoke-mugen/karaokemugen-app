import Transport from 'winston-transport';
import {ipcMain} from 'electron';

export function initIPC() {
	ipcMain.on('message', (event, data) => {
		event.sender.send('message', data);
	});
}

export class IPCTransport extends Transport {
	constructor(opts: any) {
		super(opts);
	}

	log(info: any, callback: any) {
		ipcMain.emit('log', info);
		callback();
	}
}

