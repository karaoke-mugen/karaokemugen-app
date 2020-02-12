import Transport from 'winston-transport';
import {ipcMain} from 'electron';

export class IPCTransport extends Transport {
	constructor(opts: any) {
		super(opts);
	}

	log(info: any, callback: any) {
		ipcMain.emit('log', info);
		callback();
	}
}

