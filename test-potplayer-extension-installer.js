const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const {
  buildAdminInstallCommand,
  buildAdminInstallPowerShellCommand,
  installPotPlayerExtension
} = require('./potplayer-extension/install-extension');

const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'processvideo-potplayer-install-'));
const targetRoot = path.join(tempRoot, 'PotPlayer');
const targetDir = path.join(targetRoot, 'Extension', 'Media', 'PlayParse');
fs.mkdirSync(targetDir, { recursive: true });

const userIniPath = path.join(targetDir, 'ProcessVideo.ini');
fs.writeFileSync(userIniPath, '[PROCESSVIDEO]\ncompanion_path=C:\\Custom\\Companion.exe\n');

const result = installPotPlayerExtension({
  potplayerPath: targetRoot,
  companionPath: 'D:\\ProcessVideo-Beta\\cli\\processvideo-cli.js',
  nodePath: 'node',
  reportPath: 'D:\\ProcessVideo-Beta\\runtime\\last-run.json'
});

assert.strictEqual(result.targetDir, targetDir);
assert.ok(fs.existsSync(path.join(targetDir, 'MediaPlayParse - ProcessVideo.as')));
assert.ok(fs.existsSync(path.join(targetDir, 'ProcessVideo_default.ini')));
const preservedIni = fs.readFileSync(userIniPath, 'utf8');
assert.match(preservedIni, /companion_path=C:\\Custom\\Companion\.exe/, 'preserves an existing user companion_path');
assert.match(preservedIni, /async_launch=1/, 'adds new default async launch setting to existing user config');
assert.strictEqual(result.wroteUserIni, false);
assert.strictEqual(result.updatedUserIni, true);

fs.rmSync(userIniPath, { force: true });
const secondResult = installPotPlayerExtension({
  potplayerPath: targetRoot,
  companionPath: 'D:\\ProcessVideo-Beta\\cli\\processvideo-cli.js',
  nodePath: 'node',
  reportPath: 'D:\\ProcessVideo-Beta\\runtime\\last-run.json'
});
const generatedIni = fs.readFileSync(secondResult.userIniPath, 'utf8');
assert.match(generatedIni, /companion_path=D:\\ProcessVideo-Beta\\cli\\processvideo-cli\.js/);
assert.match(generatedIni, /node_path=node/);
assert.match(generatedIni, /report_path=D:\\ProcessVideo-Beta\\runtime\\last-run\.json/);
assert.match(generatedIni, /async_launch=1/);

const exeIni = require('./potplayer-extension/install-extension').renderUserIni({
  companionPath: 'D:\\ProcessVideo-Beta\\dist\\Video Processing Tool Beta 5.13.1.exe',
  nodePath: '',
  reportPath: 'C:\\Users\\sunhao\\AppData\\Roaming\\video-processor-beta\\runtime\\last-run.json'
});
assert.match(exeIni, /companion_path=D:\\ProcessVideo-Beta\\dist\\Video Processing Tool Beta 5\.13\.1\.exe/);
assert.match(exeIni, /node_path=/);
assert.doesNotMatch(exeIni, /node_path=node/);
assert.strictEqual(
  buildAdminInstallCommand({
    exePath: 'D:\\ProcessVideo-Beta\\dist\\Video Processing Tool Beta 5.13.1.exe',
    potplayerPath: 'C:\\Program Files\\DAUM\\PotPlayer',
    companionPath: 'D:\\ProcessVideo-Beta\\dist\\Video Processing Tool Beta 5.13.1.exe',
    nodePath: '',
    reportPath: 'C:\\Users\\sunhao\\AppData\\Roaming\\video-processor-beta\\runtime\\last-run.json'
  }),
  '"D:\\ProcessVideo-Beta\\dist\\Video Processing Tool Beta 5.13.1.exe" "--install-potplayer-extension" "--potplayer" "C:\\Program Files\\DAUM\\PotPlayer" "--companion" "D:\\ProcessVideo-Beta\\dist\\Video Processing Tool Beta 5.13.1.exe" "--node" "--report" "C:\\Users\\sunhao\\AppData\\Roaming\\video-processor-beta\\runtime\\last-run.json"',
  'builds an administrator command for Program Files installs'
);
assert.strictEqual(
  buildAdminInstallPowerShellCommand({
    exePath: 'D:\\ProcessVideo-Beta\\dist\\Video Processing Tool Beta 5.13.1.exe',
    potplayerPath: 'C:\\Program Files\\DAUM\\PotPlayer',
    companionPath: 'D:\\ProcessVideo-Beta\\dist\\Video Processing Tool Beta 5.13.1.exe',
    nodePath: '',
    reportPath: 'C:\\Users\\sunhao\\AppData\\Roaming\\video-processor-beta\\runtime\\last-run.json'
  }),
  "Start-Process -FilePath 'D:\\ProcessVideo-Beta\\dist\\Video Processing Tool Beta 5.13.1.exe' -ArgumentList '\"--install-potplayer-extension\" \"--potplayer\" \"C:\\Program Files\\DAUM\\PotPlayer\" \"--companion\" \"D:\\ProcessVideo-Beta\\dist\\Video Processing Tool Beta 5.13.1.exe\" \"--node\" \"--report\" \"C:\\Users\\sunhao\\AppData\\Roaming\\video-processor-beta\\runtime\\last-run.json\"' -Verb RunAs",
  'builds a PowerShell UAC command for elevated installs'
);
assert.deepStrictEqual(
  require('./potplayer-extension/install-extension').parseCliArgs([
    '--potplayer',
    'C:\\Program Files\\DAUM\\PotPlayer',
    '--node',
    '--report',
    'D:\\ProcessVideo-Beta\\runtime\\last-run.json'
  ]),
  {
    potplayerPath: 'C:\\Program Files\\DAUM\\PotPlayer',
    nodePath: '',
    reportPath: 'D:\\ProcessVideo-Beta\\runtime\\last-run.json'
  },
  'allows --node to be empty before another option'
);

fs.rmSync(tempRoot, { recursive: true, force: true });
console.log('PotPlayer extension installer tests passed');
