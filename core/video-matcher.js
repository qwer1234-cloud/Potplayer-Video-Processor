const fs = require('fs');
const path = require('path');

const DEFAULT_VIDEO_EXTENSIONS = ['mp4', 'avi', 'mov', 'mkv', 'wmv', 'flv', 'webm', 'm4v', '3gp'];

async function findVideoFileForPBF(pbfFilePath, options = {}) {
  const extensions = options.extensions || DEFAULT_VIDEO_EXTENSIONS;
  const pbfDir = path.dirname(pbfFilePath);
  const pbfBaseName = path.basename(pbfFilePath, '.pbf');

  for (const ext of extensions) {
    const videoPath = path.join(pbfDir, `${pbfBaseName}.${ext}`);
    if (fs.existsSync(videoPath)) {
      return videoPath;
    }
  }

  throw new Error(`No matching video file found for PBF: ${pbfFilePath}`);
}

module.exports = {
  DEFAULT_VIDEO_EXTENSIONS,
  findVideoFileForPBF
};
