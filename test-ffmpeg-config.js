const assert = require('assert');
const path = require('path');
const {
  getConfiguredFFmpegBinPath,
  getFFmpegToolPath,
  getFFmpegToolEnvironment,
  mergeFFmpegSettingsForSave,
  quoteCommandPath
} = require('./ffmpeg-config');

const configuredBin = path.join('D:', 'ProcessVideo-Beta', 'tools', 'ffmpeg', 'bin');
const configuredExe = path.join(configuredBin, 'ffmpeg.exe');

assert.strictEqual(
  getConfiguredFFmpegBinPath({ ffmpegPath: configuredBin }),
  configuredBin,
  'accepts a configured FFmpeg bin directory'
);

assert.strictEqual(
  getConfiguredFFmpegBinPath({ ffmpegPath: configuredExe }),
  configuredBin,
  'accepts a configured ffmpeg.exe path and normalizes to its directory'
);

assert.strictEqual(
  getFFmpegToolPath({ ffmpegPath: configuredBin }, 'ffmpeg'),
  path.join(configuredBin, 'ffmpeg.exe'),
  'resolves ffmpeg.exe from the configured bin directory'
);

assert.strictEqual(
  getFFmpegToolPath({}, 'ffprobe'),
  'ffprobe',
  'falls back to PATH command name when no FFmpeg path is configured'
);

const env = getFFmpegToolEnvironment({ ffmpegPath: configuredBin }, { PATH: 'C:\\Windows\\System32' });
assert.ok(
  env.PATH.startsWith(`${configuredBin};`),
  'prepends configured FFmpeg bin directory to child process PATH'
);

assert.strictEqual(
  quoteCommandPath('C:\\Program Files\\ffmpeg\\bin\\ffprobe.exe'),
  '"C:\\Program Files\\ffmpeg\\bin\\ffprobe.exe"',
  'quotes absolute command paths with spaces for shell execution'
);

assert.deepStrictEqual(
  mergeFFmpegSettingsForSave(
    { ffmpegPath: configuredBin, lastSelectionPaths: { video: 'C:\\videos' } },
    { format: 'gif' }
  ),
  {
    format: 'gif',
    ffmpegPath: configuredBin,
    lastSelectionPaths: { video: 'C:\\videos' }
  },
  'renderer settings saves preserve FFmpeg path config'
);

console.log('FFmpeg config tests passed');
