// KM Imports
import {asyncCheckOrMkdir, asyncExists, asyncRemove, asyncCopy} from './lib/utils/files';
import {getConfig, setConfig, resolvedPathTemp, resolvedPathAvatars, configureLocale} from './lib/utils/config';
import {initConfig} from './utils/config';
import {parseCommandLineArgs} from './args';
import logger, { configureLogger } from './lib/utils/logger';
import {exit, initEngine} from './services/engine';
import {logo} from './logo';
import { setState, getState } from './utils/state';
import { version } from './version';
import { migrateOldFoldersToRepo, addRepo, getRepo } from './services/repo';
// Types
import {Config} from './types/config';

// Node modules
import i18n from 'i18next';
import {moveSync} from 'fs-extra';
import {dirname} from 'path';
import {mkdirSync, existsSync} from 'fs';
import {join, resolve} from 'path';
import minimist from 'minimist';
import chalk from 'chalk';
import {createInterface} from 'readline';
import { getPortPromise } from 'portfinder';
import { app, BrowserWindow, Menu, MenuItem } from 'electron';
import cloneDeep from 'lodash.clonedeep';
import open from 'open';
import { welcomeToYoukousoKaraokeMugen } from './services/welcome';
import { initStep } from './utils/electron_logger';

process.on('uncaughtException', exception => {
	console.log('Uncaught exception:', exception);
});

process.on('unhandledRejection', (error) => {
	console.log('Unhandled Rejection at:', error);
});

process.on('SIGINT', () => {
	exit('SIGINT');
});

process.on('SIGTERM', () => {
	exit('SIGTERM');
});

// CTRL+C for Windows :

if (process.platform === 'win32' ) {
	const rl = createInterface({
	  input: process.stdin,
	  output: process.stdout
	});

	rl.on('SIGINT', () => {
	  exit('SIGINT');
	});
}

// Main app begins here.
// Testing if we're in a packaged version of KM or not.
// First, this is a test for unpacked electron mode.
// If we're not using electron, then use __dirname's parent)
let originalAppPath: string;
if (process.versions.electron) {
	//INIT_CWD exists only when electron is launched from yarn (dev)
	//PORTABLE_EXECUTABLE_DIR exists only when launched from a packaged eletron app (yarn dist) (production)
	// The last one is when running an unpackaged electron for testing purposes (yarn packer) (dev)
	originalAppPath = process.env.INIT_CWD || process.env.PORTABLE_EXECUTABLE_DIR || join(__dirname, '../../../');
	// Because OSX packages are structured differently, we'll modify our path
	if (process.platform === 'darwin') originalAppPath = resolve(originalAppPath, '../../');
} else {
	originalAppPath = process.cwd();
}

// On OSX, process.cwd() returns /, which is utter stupidity but let's go along with it.
// What's funny is that originalAppPath is correct on OSX no matter if you're using Electron or not.
const appPath = process.platform === 'darwin'
	? resolve(dirname(process.execPath), '../')
	: process.cwd();
// Resources are all the stuff our app uses and is bundled with. mpv config files, default avatar, background, migrations, locales, etc.
const resourcePath = process.versions.electron && existsSync(resolve(appPath, 'resources/'))
	// If launched from electron we check if cwd/resources exists and set it to resourcePath. If not we'll use appPath
	// CWD = current working directory, so if launched from a dist exe, this is $HOME/AppData/Local/ etc. on Windows, and equivalent path on Unix systems.
	// It also works from unpackaged electron, if all things are well.
	// If it doesn't exist, we'll assume the resourcePath is originalAppPath.
	? process.platform === 'darwin'
		? process.resourcesPath
		: resolve(appPath, 'resources/')
	: originalAppPath;

// DataPath is by default appPath + app. This is default when running from source
const dataPath = existsSync(resolve(originalAppPath, 'portable'))
	? resolve(originalAppPath, 'app/')
	// Rewriting dataPath to point to user home directory
	: resolve(process.env.HOME || process.env.HOMEPATH, 'KaraokeMugen');

if (!existsSync(dataPath)) mkdirSync(dataPath);

// Move config file if it's in appPath to dataPath
if (existsSync(resolve(originalAppPath, 'config.yml')) && !existsSync(resolve(dataPath, 'config.yml'))) {
	moveSync(resolve(originalAppPath, 'config.yml'), resolve(dataPath, 'config.yml'));
}

if (existsSync(resolve(originalAppPath, 'database.json')) && !existsSync(resolve(dataPath, 'database.json'))) {
	moveSync(resolve(originalAppPath, 'database.json'), resolve(dataPath, 'database.json'));
}

export let win: Electron.BrowserWindow;

setState({originalAppPath: originalAppPath, appPath: appPath, dataPath: dataPath, resourcePath: resourcePath});

process.env['NODE_ENV'] = 'production'; // Default


if(app) {
	// Cette méthode sera appelée quand Electron aura fini
	// de s'initialiser et sera prêt à créer des fenêtres de navigation.
	// Certaines APIs peuvent être utilisées uniquement quand cet événement est émit.
	app.on('ready', async () => {
		createWindow();
		await main()
			.catch(err => {
				logger.error(`[Launcher] Error during launch : ${err}`);
				console.log(err);
				exit(1);
			});
		win.loadURL(await welcomeToYoukousoKaraokeMugen());
	});

	// Quitte l'application quand toutes les fenêtres sont fermées.
	app.on('window-all-closed', () => {
		// Sur macOS, il est commun pour une application et leur barre de menu
		// de rester active tant que l'utilisateur ne quitte pas explicitement avec Cmd + Q
		if (process.platform !== 'darwin') {
			exit(0).then(() => app.quit());
		}
	});

	app.on('activate', () => {
		// Sur macOS, il est commun de re-créer une fenêtre de l'application quand
		// l'icône du dock est cliquée et qu'il n'y a pas d'autres fenêtres d'ouvertes.
		if (win === null) {
			createWindow();
		}
	});

	const menu = new Menu();
	menu.append(new MenuItem({ label: 'Update', click() {
		console.log('item 1 clicked');
	}}));
	menu.append(new MenuItem({ type: 'separator' }));
	menu.append(new MenuItem({ label: 'Launch MPV', click() {
		console.log('item 2 clicked');
	} }));
	Menu.setApplicationMenu(menu);
} else {
	main()
		.catch(err => {
			logger.error(`[Launcher] Error during launch : ${err}`);
			console.log(err);
			exit(1);
		});
}

function createWindow () {
	// Cree la fenetre du navigateur.
	win = new BrowserWindow({
		backgroundColor: '#36393f',
		icon: resolve(resourcePath, 'assets/icon.png'),
		webPreferences: {
			nodeIntegration: true
		}
	});

	// and load the index.html of the app.
	win.loadURL(`file://${resolve(resourcePath, 'initpage/index.html')}`);
	win.maximize();
	win.show();

	win.webContents.on('new-window', (event, url) => {
		event.preventDefault();
		open(url);
	});

	// Émit lorsque la fenêtre est fermée.
	win.on('closed', () => {
	  // Dé-référence l'objet window , normalement, vous stockeriez les fenêtres
	  // dans un tableau si votre application supporte le multi-fenêtre. C'est le moment
	  // où vous devez supprimer l'élément correspondant.
	  win = null;
	  exit(0);
	});
}


async function main() {
	await configureLocale();
	initStep(i18n.t('INIT_INIT'));
	const argv = minimist(process.argv.slice(2));
	setState({ os: process.platform, version: version, electron: app });
	const state = getState();
	console.log(chalk.white(logo));
	console.log('Karaoke Player & Manager - http://karaokes.moe');
	console.log(`Version ${chalk.bold.green(state.version.number)} (${chalk.bold.green(state.version.name)})`);
	console.log('================================================================================');
	await configureLogger(dataPath, argv.debug || (app && app.commandLine.hasSwitch('debug')), true);
	await parseCommandLineArgs(argv, app ? app.commandLine : null);
	await initConfig(argv);
	const publicConfig = cloneDeep(getConfig());
	publicConfig.Karaoke.StreamerMode.Twitch.OAuth = 'xxxxx';
	publicConfig.App.JwtSecret = 'xxxxx';
	publicConfig.App.InstanceID = 'xxxxx';
	logger.debug(`[Launcher] AppPath : ${appPath}`);
	logger.debug(`[Launcher] DataPath : ${dataPath}`);
	logger.debug(`[Launcher] ResourcePath : ${resourcePath}`);
	logger.debug(`[Launcher] Electron ResourcePath: ${process.resourcesPath}`);
	logger.debug(`[Launcher] Locale : ${state.EngineDefaultLocale}`);
	logger.debug(`[Launcher] OS : ${state.os}`);
	logger.debug(`[Launcher] Loaded configuration : ${JSON.stringify(publicConfig)}`);
	logger.debug(`[Launcher] Initial state : ${JSON.stringify(state)}`);

	// Checking paths, create them if needed.
	await checkPaths(getConfig());

	// Copy the input.conf file to modify mpv's default behaviour, namely with mouse scroll wheel
	const tempInput = resolve(resolvedPathTemp(), 'input.conf');
	logger.debug(`[Launcher] Copying input.conf to ${tempInput}`);
	await asyncCopy(resolve(resourcePath, 'assets/input.conf'), tempInput);

	const tempBackground = resolve(resolvedPathTemp(), 'default.jpg');
	logger.debug(`[Launcher] Copying default background to ${tempBackground}`);
	await asyncCopy(resolve(resourcePath, `assets/${state.version.image}`), tempBackground);

	// Copy avatar blank.png if it doesn't exist to the avatar path
	logger.debug(`[Launcher] Copying blank.png to ${resolvedPathAvatars()}`);
	await asyncCopy(resolve(resourcePath, 'assets/blank.png'), resolve(resolvedPathAvatars(), 'blank.png'));

	/**
	 * Test if network ports are available
	 */
	verifyOpenPort(getConfig().Frontend.Port, getConfig().App.FirstRun);

	/**
	 * Gentlemen, start your engines.
	 */
	try {
		await initEngine();
	} catch(err) {
		console.log(err);
		logger.error(`[Launcher] Karaoke Mugen initialization failed : ${err}`);
		exit(1);
	}
}

/**
 * Checking if application paths exist.
 */
async function checkPaths(config: Config) {
	// Migrate old folder config to new repository one :
	await migrateOldFoldersToRepo();
	const conf = getConfig();
	const appPath = getState().appPath;
	const dataPath = getState().dataPath;
	// If no karaoke is found, copy the samples directory if it exists
	if (!await asyncExists(resolve(dataPath, conf.System.Repositories[0].Path.Karas[0])) && await asyncExists(resolve(appPath, 'samples/')) && !getRepo('Samples')) {
		try {
			await addRepo({
				Name: 'Samples',
				Online: false,
				Path: {
					Lyrics: [resolve(appPath, 'samples/lyrics')],
					Medias: [resolve(appPath, 'samples/medias')],
					Karas: [resolve(appPath, 'samples/karaokes')],
					Tags: [resolve(appPath, 'samples/tags')],
					Series: [resolve(appPath, 'samples/series')]
				}
			});
		} catch (err) {
			// Non-fatal
			logger.warn(`[Launcher] Unable to add samples repository : ${err}`);
		}
	}

	// Emptying temp directory
	if (await asyncExists(resolvedPathTemp())) await asyncRemove(resolvedPathTemp());
	// Checking paths
	let checks = [];
	const paths = config.System.Path;
	for (const item of Object.keys(paths)) {
		Array.isArray(paths[item]) && paths[item]
			? paths[item].forEach((dir: string) => checks.push(asyncCheckOrMkdir(resolve(dataPath, dir))))
			: checks.push(asyncCheckOrMkdir(resolve(dataPath, paths[item])));
	}
	for (const repo of config.System.Repositories) {
		for (const paths of Object.keys(repo.Path)) {
			repo.Path[paths].forEach((dir: string) => checks.push(asyncCheckOrMkdir(resolve(dataPath, dir))));
		}
	}
	checks.push(asyncCheckOrMkdir(resolve(dataPath, 'logs/')));

	await Promise.all(checks);
	logger.debug('[Launcher] Directory checks complete');
}

async function verifyOpenPort(portConfig: number, firstRun: boolean) {
	try {
		const port = await getPortPromise({
			port: portConfig,
			stopPort: 7331
		});
		if (firstRun && port !== portConfig) {
			logger.warn(`[Launcher] Port ${portConfig} is already in use. Switching to ${port} and saving configuration`);
			setConfig({Frontend: {Port: port}});
		}
	} catch(err) {
		throw 'Failed to find a free port to use';
	}
}
