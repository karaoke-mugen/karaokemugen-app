import Transport from 'winston-transport';
import {win} from '../index';

export class IPCTransport extends Transport {
	constructor(opts: any) {
		super(opts);
	}

	log(info: any, callback: any) {
		win.webContents.send('log', info);
		callback();
	}
}

