import { app, BrowserWindow, dialog,ipcMain, Menu,protocol } from 'electron';
import { promises as fs } from 'fs';
import i18next from 'i18next';
import open from 'open';
import { resolve } from 'path';

import { exit } from '../components/engine';
import { listUsers } from '../dao/user';
import { main, preInit } from '../index';
import {getConfig, resolvedPathStreamFiles, setConfig} from '../lib/utils/config';
import logger from '../lib/utils/logger';
import { emit,on } from '../lib/utils/pubsub';
import { testJSON } from '../lib/utils/validators';
import { emitWS } from '../lib/utils/ws';
import { importSet } from '../services/blacklist';
import { importFavorites } from '../services/favorites';
import { isAllKaras } from '../services/kara';
import { playSingleSong } from '../services/karaokeEngine';
import { importPlaylist, playlistImported} from '../services/playlist';
import { addRepo,getRepo } from '../services/repo';
import { generateAdminPassword } from '../services/user';
import { welcomeToYoukousoKaraokeMugen } from '../services/welcome';
import { detectKMFileTypes } from '../utils/files';
import { getState,setState } from '../utils/state';
import { tip } from '../utils/tips';
import { initAutoUpdate } from './electronAutoUpdate';
import { emitIPC } from './electronLogger';
import { getMenu,initMenu } from './electronMenu';

export let win: Electron.BrowserWindow;
export let zipWorker: Electron.BrowserWindow;
export let chibiPlayerWindow: Electron.BrowserWindow;
export let chibiPlaylistWindow: Electron.BrowserWindow;

let initDone = false;

export function startElectron() {
	setState({electron: app ? true : false });
	// Fix bug that makes the web views not updating if they're hidden behind other windows.
	// It's better for streamers who capture the web interface through OBS.
	app.commandLine.appendSwitch('disable-features','CalculateNativeWinOcclusion');
	// This is called when Electron finished initializing
	app.on('ready', async () => {
		try {
			await preInit();
		} catch(err) {
			console.log(err);
			// This is usually very much fatal.
			emit('initError', err);
			return;
		}
		// Register km:// protocol for internal use only.
		protocol.registerStringProtocol('km', req => {
			const args = req.url.substr(5).split('/');
			handleProtocol(args);
		});
		createZipWorker();
		if (!getState().opt.cli) await initElectronWindow();
		on('KMReady', async () => {
			const state = getState();
			if (!state.opt.cli) {
				win.loadURL(await welcomeToYoukousoKaraokeMugen());
				if (!state.forceDisableAppUpdate) initAutoUpdate();
				if (getConfig().GUI.ChibiPlayer.Enabled) {
					updateChibiPlayerWindow(true);
				}
				if (getConfig().GUI.ChibiPlaylist.Enabled) {
					updateChibiPlaylistWindow(true);
				}
			}
			initDone = true;
		});
		ipcMain.once('initPageReady', async () => {
			try {
				await main();
			} catch(err) {
				logger.error('Error during launch', {service: 'Launcher', obj: err});
			}
		});
		if (getState().opt.cli) {
			try {
				await main();
			} catch(err) {
				logger.error('Error during launch', {service: 'Launcher', obj: err});
				throw err;
			}
		}
		ipcMain.on('getSecurityCode', (event, _eventData) => {
			event.sender.send('getSecurityCodeResponse', getState().securityCode);
		});
		ipcMain.on('droppedFiles', async (_event, eventData) => {
			for (const path of eventData.files) {
				await handleFile(path, eventData.username, eventData.onlineToken);
			}
		});
		ipcMain.on('tip', (_event, _eventData) => {
			emitIPC('techTip', tip());
		});
		ipcMain.on('setChibiPlayerAlwaysOnTop', (_event, _eventData) => {
			setChibiPlayerAlwaysOnTop(!getConfig().GUI.ChibiPlayer.AlwaysOnTop);
			setConfig({GUI:{ChibiPlayer:{ AlwaysOnTop: !getConfig().GUI.ChibiPlayer.AlwaysOnTop }}});
		});
		ipcMain.on('closeChibiPlayer', (_event, _eventData) => {
			updateChibiPlayerWindow(false);
			setConfig({GUI: {ChibiPlayer: { Enabled: false }}});
			applyMenu();
		});
		ipcMain.on('focusMainWindow', (_event, _eventData) => {
			focusWindow();
		});
		ipcMain.on('openFolder', (_event, eventData) => {
			if (eventData.type === 'streamFiles') {
				open(resolve(resolvedPathStreamFiles()));
			}
		});
	});

	// macOS only. Yes.
	app.on('open-url', (_event, url: string) => {
		handleProtocol(url.substr(5).split('/'));
	});

	app.on('window-all-closed', async () => {
		await exit(0);
	});

	app.on('activate', async () => {
		// Recreate the window if the app is clicked on in the dock(for macOS)
		if (win === null) {
			await initElectronWindow();
		}
	});

	ipcMain.on('get-file-paths', async (event, options) => {
		event.sender.send('get-file-paths-response', (await dialog.showOpenDialog(options)).filePaths);
	});

	if (process.platform !== 'darwin') Menu.setApplicationMenu(null);
}

export async function handleProtocol(args: string[]) {
	try {
		logger.info(`Received protocol uri km://${args.join('/')}`, {service: 'ProtocolHandler'});
		if (!getState().ready) return;
		switch(args[0]) {
			case 'addRepo':
				const repoName = args[1];
				const repo = getRepo(repoName);
				if (!repo) {
					const buttons = await dialog.showMessageBox({
						type: 'none',
						title: i18next.t('UNKNOWN_REPOSITORY_ADD.TITLE'),
						message: `${i18next.t('UNKNOWN_REPOSITORY_ADD.MESSAGE', {repoName: repoName})}`,
						buttons: [i18next.t('YES'), i18next.t('NO')],
					});
					if (buttons.response === 0) {
						await addRepo({
							Name: repoName,
							Online: true,
							Enabled: true,
							SendStats: false,
							AutoMediaDownloads: 'updateOnly',
							MaintainerMode: false,
							BaseDir: `repos/${repoName}/json`,
							Path: {
								Medias: [`repos/${repoName}/medias`]
							}
						});
					}
				} else {
					await dialog.showMessageBox({
						type: 'none',
						title: i18next.t('REPOSITORY_ALREADY_EXISTS.TITLE'),
						message: `${i18next.t('REPOSITORY_ALREADY_EXISTS.MESSAGE', {repoName: repoName})}`
					});
				}
				break;
			default:
				throw 'Unknown protocol';
		}
	} catch(err) {
		logger.error(`Unknown command : ${args.join('/')}`, {service: 'ProtocolHandler'});
	}
}

export async function handleFile(file: string, username?: string, onlineToken?: string) {
	try {
		logger.info(`Received file path ${file}`, {service: 'FileHandler'});
		if (!getState().ready) return;
		if (!username) {
			const users = await listUsers();
			const adminUsersOnline = users.filter(u => u.type === 0 && u.login !== 'admin');
			// We have no other choice but to pick only the first one
			username = adminUsersOnline[0]?.login;
			if (!username) {
				username = 'admin';
				logger.warn('Could not find a username, switching to admin by default', {service: 'FileHandler'});
			}
		}
		const rawData = await fs.readFile(resolve(file), 'utf-8');
		if (!testJSON(rawData)) {
			logger.debug(`File ${file} is not JSON, ignoring`, {service: 'FileHandler'});
			return;
		}
		const data = JSON.parse(rawData);
		const KMFileType = detectKMFileTypes(data);
		const url = `http://localhost:${getConfig().Frontend.Port}/admin`;
		switch(KMFileType) {
			case 'Karaoke Mugen BLC Set File':
				await importSet(data);
				if (win && !win.webContents.getURL().includes('/admin')) {
					win.loadURL(url);
					win.webContents.on('did-finish-load', () => emitWS('BLCSetsUpdated'));
				} else {
					emitWS('BLCSetsUpdated');
				}
				break;
			case 'Karaoke Mugen Favorites List File':
				if (!username) throw 'Unable to find a user to import the file to';
				await importFavorites(data, username, onlineToken);
				if (win && !win.webContents.getURL().includes('/admin')) {
					win.loadURL(url);
					win.webContents.on('did-finish-load', () => emitWS('favoritesUpdated', username));
				} else {
					emitWS('favoritesUpdated', username);
				}
				break;
			case 'Karaoke Mugen Karaoke Data File':
				const kara = await isAllKaras([data.data.kid]);
				if (kara.length > 0) throw 'Song unknown in database';
				await playSingleSong(data.data.kid);
				if (win && !win.webContents.getURL().includes('/admin')) win.loadURL(url);
				break;
			case 'Karaoke Mugen Playlist File':
				if (!username) throw 'Unable to find a user to import the file to';
				const res = await importPlaylist(data, username);
				if (win && !win.webContents.getURL().includes('/admin')) {
					win.loadURL(url);
					win.webContents.on('did-finish-load', () => playlistImported(res));
				} else {
					playlistImported(res);
				}
				break;
			default:
				//Unrecognized, ignoring
				throw 'Filetype not recognized';
		}
	} catch(err) {
		logger.error(`Could not handle ${file}`, {service: 'Electron', obj: err});
	}
}

export function applyMenu() {
	initMenu();
	const menu = Menu.buildFromTemplate(getMenu());
	process.platform === 'darwin' ? Menu.setApplicationMenu(menu):win.setMenu(menu);
}

async function initElectronWindow() {
	await createWindow();
	applyMenu();
}

export async function createZipWorker() {
	zipWorker = new BrowserWindow({
		show: getState().opt.debug,
		webPreferences: {
			nodeIntegration: true,
			contextIsolation: false
		}
	});
	zipWorker.loadURL(`file://${resolve(getState().resourcePath, 'zipWorker/index.html')}`);
	zipWorker.setMenu(Menu.buildFromTemplate([{
		label: i18next.t('MENU_VIEW'),
		submenu: [
			{ label: i18next.t('MENU_VIEW_RELOAD'), role: 'reload' },
			{ label: i18next.t('MENU_VIEW_RELOADFORCE'), role: 'forceReload' },
			{ label: i18next.t('MENU_VIEW_TOGGLEDEVTOOLS'), role: 'toggleDevTools' },
			{ type: 'separator' },
			{ label: i18next.t('MENU_VIEW_RESETZOOM'), role: 'resetZoom' },
			{ label: i18next.t('MENU_VIEW_ZOOMIN'), role: 'zoomIn' },
			{ label: i18next.t('MENU_VIEW_ZOOMOUT'), role: 'zoomOut' },
			{ type: 'separator' },
			{ label: i18next.t('MENU_VIEW_FULLSCREEN'), role: 'togglefullscreen' }
		]
	}]));
}

async function createWindow() {
	// Create the browser window
	const state = getState();
	win = new BrowserWindow({
		width: 1400,
		height: 900,
		backgroundColor: '#36393f',
		show: false,
		icon: resolve(state.resourcePath, 'build/icon.png'),
		webPreferences: {
			nodeIntegration: true,
			contextIsolation: false,
		},
	});
	// and load the index.html of the app.
	if (initDone) {
		win.loadURL(await welcomeToYoukousoKaraokeMugen());
	} else {
		win.loadURL(`file://${resolve(state.resourcePath, 'initpage/index.html')}`);
	}

	win.once('ready-to-show', () => {
		win.show();
	});
	win.webContents.on('new-window', (event, url) => {
		event.preventDefault();
		openLink(url);
	});
	win.webContents.on('will-navigate', (event, url) => {
		event.preventDefault();
		openLink(url);
	});

	// What to do when the window is closed.
	win.on('closed', () => {
		win = null;
		if (chibiPlayerWindow) chibiPlayerWindow.destroy();
		if (chibiPlaylistWindow) chibiPlaylistWindow.destroy();
		if (zipWorker) zipWorker.destroy();
	});
}

function openLink(url: string) {
	getConfig().GUI.OpenInElectron && url.indexOf('//localhost') !== -1
		? win.loadURL(url)
		: open(url);
}

export function setProgressBar(number: number) {
	if (win) win.setProgressBar(number);
}

export function focusWindow() {
	if (win) {
		if (win.isMinimized()) win.restore();
		win.focus();
	}
}

export function closeAllWindows() {	
	// Hide main window since destroying it would force-kill the app.
	win?.hide();
	chibiPlayerWindow?.destroy();
	chibiPlaylistWindow?.destroy();
}

export async function updateChibiPlayerWindow(show: boolean) {
	const state = getState();
	const conf = getConfig();
	if (show) {
		chibiPlayerWindow = new BrowserWindow({
			width: 521,
			height: 139,
			x: conf.GUI.ChibiPlayer.PositionX,
			y: conf.GUI.ChibiPlayer.PositionY,
			frame: false,
			resizable: false,
			show: false,
			alwaysOnTop: getConfig().GUI.ChibiPlayer.AlwaysOnTop,
			backgroundColor: '#36393f',
			webPreferences: {
				nodeIntegration: true,
				contextIsolation: false
			},
			icon: resolve(state.resourcePath, 'build/icon.png'),
		});
		const port = state.frontendPort;
		chibiPlayerWindow.once('ready-to-show', () => {
			chibiPlayerWindow.show();
		});
		chibiPlayerWindow.on('moved', () => {
			const pos = chibiPlayerWindow.getPosition();
			setConfig({ GUI: {
				ChibiPlayer: {
					PositionX: pos[0],
					PositionY: pos[1]
				}
			}});
		});
		await chibiPlayerWindow.loadURL(`http://localhost:${port}/chibi?admpwd=${await generateAdminPassword()}`);
	} else {
		chibiPlayerWindow?.destroy();
	}
}

export function setChibiPlayerAlwaysOnTop(enabled: boolean) {
	if (chibiPlayerWindow) chibiPlayerWindow.setAlwaysOnTop(enabled);
}

export async function updateChibiPlaylistWindow(show: boolean) {
	const state = getState();
	const conf = getConfig();
	if (show) {
		chibiPlaylistWindow = new BrowserWindow({
			width: 475,
			height: 720,
			x: conf.GUI.ChibiPlaylist.PositionX,
			y: conf.GUI.ChibiPlaylist.PositionY,
			show: false,
			backgroundColor: '#36393f',
			webPreferences: {
				nodeIntegration: true,
				contextIsolation: false
			},
			icon: resolve(state.resourcePath, 'build/icon.png'),
		});
		const port = state.frontendPort;
		chibiPlaylistWindow.once('ready-to-show', () => {
			chibiPlaylistWindow.show();
		});
		chibiPlaylistWindow.on('moved', () => {
			const pos = chibiPlaylistWindow.getPosition();
			setConfig({ GUI: {
				ChibiPlaylist: {
					PositionX: pos[0],
					PositionY: pos[1]
				}
			}});
		});
		await chibiPlaylistWindow.loadURL(`http://localhost:${port}/chibiPlaylist?admpwd=${await generateAdminPassword()}`);
	} else {
		chibiPlaylistWindow?.destroy();
	}
}
