const assert = require('assert');
const fs = require('fs');
const path = require('path');

const extensionDir = path.join(__dirname, 'potplayer-extension', 'Media', 'PlayParse');
const scriptPath = path.join(extensionDir, 'MediaPlayParse - ProcessVideo.as');
const iniPath = path.join(extensionDir, 'ProcessVideo_default.ini');
const readmePath = path.join(__dirname, 'potplayer-extension', 'README.md');

assert.ok(fs.existsSync(scriptPath), 'ships a PotPlayer AngelScript extension file');
assert.ok(fs.existsSync(iniPath), 'ships a default ProcessVideo ini file');
assert.ok(fs.existsSync(readmePath), 'ships PotPlayer extension setup documentation');

const script = fs.readFileSync(scriptPath, 'utf8');
assert.match(script, /HostExecuteProgram/, 'extension launches the companion through PotPlayer HostExecuteProgram');
assert.match(script, /processvideo-cli\.js/, 'extension can launch the development Node companion');
assert.match(script, /--processvideo-cli/, 'extension can launch a packaged Electron exe as the companion');
assert.match(script, /cooldown_seconds/, 'extension supports a launch cooldown to avoid repeated PlayParse triggers');
assert.match(script, /HostLoadInteger/, 'extension reads the last launch time from PotPlayer temp storage');
assert.match(script, /HostSaveInteger/, 'extension writes the last launch time to PotPlayer temp storage');
assert.match(script, /require_pbf_exists/, 'extension can require a matching PBF before launching');
assert.match(script, /InferPBFPath/, 'extension infers same-directory same-name PBF paths');
assert.match(script, /HostFileExist\(pbfPath\)/, 'extension checks that the inferred PBF exists');
assert.match(script, /async_launch/, 'extension can launch the companion without blocking PotPlayer parsing');
assert.match(script, /BuildAsyncLaunchParam/, 'extension builds a fire-and-forget launch command');
assert.match(script, /cmd\.exe/, 'extension uses cmd start for asynchronous companion launch');
assert.match(script, /GetTitle\(\)/, 'extension exposes a PotPlayer title');

const ini = fs.readFileSync(iniPath, 'utf8');
assert.match(ini, /\[PROCESSVIDEO\]/);
assert.match(ini, /companion_path=/);
assert.match(ini, /node_path=/);
assert.match(ini, /mode=bookmark-gif/);
assert.match(ini, /cooldown_seconds=30/);
assert.match(ini, /require_pbf_exists=1/);
assert.match(ini, /async_launch=1/);

console.log('PotPlayer extension file tests passed');
