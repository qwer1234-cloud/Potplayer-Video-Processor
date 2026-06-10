const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { findVideoFileForPBF } = require('./core/video-matcher');

async function run() {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'processvideo-video-match-'));
  const pbfPath = path.join(tempDir, 'episode.pbf');
  const videoPath = path.join(tempDir, 'episode.mp4');
  fs.writeFileSync(pbfPath, '[Bookmark]\\n');
  fs.writeFileSync(videoPath, '');

  assert.strictEqual(
    await findVideoFileForPBF(pbfPath),
    videoPath,
    'finds a video with the same base name next to the PBF file'
  );

  fs.rmSync(tempDir, { recursive: true, force: true });
}

run()
  .then(() => console.log('Core video matcher tests passed'))
  .catch(error => {
    console.error(error);
    process.exit(1);
  });
