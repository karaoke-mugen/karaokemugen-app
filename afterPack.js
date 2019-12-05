const fs = require('fs-extra');
exports.default = context => {
	fs.mkdirSync('dist/win-unpacked/app');
	fs.mkdirSync('dist/win-unpacked/app/bin');
	fs.copySync('app/bin', 'dist/win-unpacked/app/bin/');
	fs.copySync('app/config.yml', 'dist/win-unpacked/config.yml');
	fs.copySync('app/database.json', 'dist/win-unpacked/database.json');
}