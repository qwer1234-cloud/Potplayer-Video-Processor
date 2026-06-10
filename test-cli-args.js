const assert = require('assert');
const path = require('path');
const {
  EXIT_CODES,
  getDefaultReportPath,
  getElectronCompanionArgs,
  inferPBFPathFromVideo,
  parseArgs
} = require('./cli/processvideo-cli');

const parsed = parseArgs([
  'bookmark-gif',
  '--video',
  'D:\\media\\episode.mp4',
  '--pbf',
  'D:\\media\\episode.pbf',
  '--report',
  'D:\\reports\\last-run.json',
  '--open-ui',
  '--force'
]);

assert.deepStrictEqual(parsed, {
  mode: 'bookmark-gif',
  videoPath: 'D:\\media\\episode.mp4',
  pbfPath: 'D:\\media\\episode.pbf',
  reportPath: 'D:\\reports\\last-run.json',
  openUI: true,
  force: true
});

assert.strictEqual(
  inferPBFPathFromVideo('D:\\media\\episode.mp4'),
  'D:\\media\\episode.pbf',
  'infers same-directory same-name PBF path from the PotPlayer video path'
);

assert.strictEqual(
  getDefaultReportPath(),
  path.join(__dirname, 'runtime', 'last-run.json'),
  'writes plugin run reports to runtime/last-run.json by default'
);

assert.strictEqual(EXIT_CODES.ARGUMENT_ERROR, 10);
assert.deepStrictEqual(
  getElectronCompanionArgs([
    'Video Processing Tool Beta.exe',
    '--processvideo-cli',
    'bookmark-gif',
    '--video',
    'D:\\media\\episode.mp4'
  ]),
  ['bookmark-gif', '--video', 'D:\\media\\episode.mp4'],
  'extracts companion CLI args from packaged Electron argv'
);
assert.strictEqual(
  getElectronCompanionArgs(['Video Processing Tool Beta.exe']),
  null,
  'returns null when Electron was launched normally'
);
assert.throws(
  () => parseArgs(['bookmark-gif', '--video']),
  /Missing value for --video/,
  'rejects options without values'
);
assert.throws(
  () => parseArgs(['unknown-mode']),
  /Unsupported mode/,
  'rejects unsupported modes'
);

console.log('CLI argument tests passed');
