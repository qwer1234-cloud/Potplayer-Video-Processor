#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const { parsePBFBookmarks } = require('../core/pbf-parser');
const { findVideoFileForPBF } = require('../core/video-matcher');
const RobustBookmarkProcessor = require('../scripts/robust_bookmark_processor');

const EXIT_CODES = {
  SUCCESS: 0,
  ARGUMENT_ERROR: 10,
  PBF_ERROR: 20,
  VIDEO_MATCH_ERROR: 30,
  PROCESSING_ERROR: 40,
  UNKNOWN_ERROR: 50
};

const ELECTRON_COMPANION_FLAG = '--processvideo-cli';

function getElectronCompanionArgs(argv) {
  const flagIndex = argv.indexOf(ELECTRON_COMPANION_FLAG);
  if (flagIndex < 0) {
    return null;
  }

  return argv.slice(flagIndex + 1);
}

function parseArgs(argv) {
  const args = [...argv];
  const mode = args.shift();
  if (mode !== 'bookmark-gif') {
    throw new Error(`Unsupported mode: ${mode || '(missing)'}`);
  }

  const parsed = {
    mode,
    videoPath: '',
    pbfPath: '',
    reportPath: '',
    openUI: false
  };

  for (let i = 0; i < args.length; i += 1) {
    const option = args[i];
    if (option === '--open-ui') {
      parsed.openUI = true;
      continue;
    }

    const valueOptions = {
      '--video': 'videoPath',
      '--pbf': 'pbfPath',
      '--report': 'reportPath'
    };

    const target = valueOptions[option];
    if (!target) {
      throw new Error(`Unknown option: ${option}`);
    }

    const value = args[i + 1];
    if (!value || value.startsWith('--')) {
      throw new Error(`Missing value for ${option}`);
    }

    parsed[target] = value;
    i += 1;
  }

  return parsed;
}

function inferPBFPathFromVideo(videoPath) {
  const parsed = path.parse(videoPath);
  return path.join(parsed.dir, `${parsed.name}.pbf`);
}

function getDefaultReportPath() {
  return path.join(path.resolve(__dirname, '..'), 'runtime', 'last-run.json');
}

function getDefaultFFmpegBinPaths() {
  const projectRoot = path.resolve(__dirname, '..');
  const pathsToCheck = [];

  if (process.resourcesPath) {
    pathsToCheck.push(path.join(process.resourcesPath, 'tools', 'ffmpeg', 'bin'));
    pathsToCheck.push(path.join(process.resourcesPath, 'app', 'tools', 'ffmpeg', 'bin'));
  }

  pathsToCheck.push(path.join(projectRoot, 'tools', 'ffmpeg', 'bin'));

  return pathsToCheck;
}

function writeReport(reportPath, report) {
  fs.mkdirSync(path.dirname(reportPath), { recursive: true });
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
}

function launchElectronUI() {
  const projectRoot = path.resolve(__dirname, '..');
  const npmCommand = process.platform === 'win32' ? 'npm.cmd' : 'npm';
  const child = spawn(npmCommand, ['start'], {
    cwd: projectRoot,
    detached: true,
    stdio: 'ignore'
  });
  child.unref();
}

async function resolveInputPaths(parsed) {
  let pbfPath = parsed.pbfPath;
  let videoPath = parsed.videoPath;

  if (!pbfPath && videoPath) {
    pbfPath = inferPBFPathFromVideo(videoPath);
  }

  if (!pbfPath) {
    throw Object.assign(new Error('Either --pbf or --video is required'), { exitCode: EXIT_CODES.ARGUMENT_ERROR });
  }

  if (!fs.existsSync(pbfPath)) {
    throw Object.assign(new Error(`PBF file not found: ${pbfPath}`), { exitCode: EXIT_CODES.PBF_ERROR });
  }

  if (!videoPath) {
    try {
      videoPath = await findVideoFileForPBF(pbfPath);
    } catch (error) {
      throw Object.assign(error, { exitCode: EXIT_CODES.VIDEO_MATCH_ERROR });
    }
  }

  if (!fs.existsSync(videoPath)) {
    throw Object.assign(new Error(`Video file not found: ${videoPath}`), { exitCode: EXIT_CODES.VIDEO_MATCH_ERROR });
  }

  return { pbfPath, videoPath };
}

async function runBookmarkGif(parsed) {
  const reportPath = parsed.reportPath || getDefaultReportPath();
  const startedAt = new Date().toISOString();
  const baseReport = {
    source: 'potplayer-extension',
    mode: parsed.mode,
    videoPath: '',
    pbfPath: '',
    startedAt,
    finishedAt: '',
    success: false,
    outputs: []
  };

  try {
    const { pbfPath, videoPath } = await resolveInputPaths(parsed);
    baseReport.videoPath = videoPath;
    baseReport.pbfPath = pbfPath;

    if (parsed.openUI) {
      launchElectronUI();
    }

    const bookmarks = await parsePBFBookmarks(pbfPath);
    const processor = new RobustBookmarkProcessor({
      ffmpegDefaultPaths: getDefaultFFmpegBinPaths()
    });
    const result = await processor.processBookmarkPairs(bookmarks, videoPath, null, pbfPath);
    const resultItems = Array.isArray(result && result.results) ? result.results : [];
    const failedItems = resultItems.filter(item => !item.success);
    baseReport.success = Boolean(result && result.success) && failedItems.length === 0;
    baseReport.message = result && result.message ? result.message : '';
    baseReport.outputs = resultItems.filter(item => item.success && item.outputPath).map(item => item.outputPath);
    baseReport.results = resultItems;
    baseReport.finishedAt = new Date().toISOString();
    writeReport(reportPath, baseReport);

    if (!baseReport.success) {
      throw Object.assign(new Error(baseReport.message || 'Bookmark GIF processing failed'), {
        exitCode: EXIT_CODES.PROCESSING_ERROR
      });
    }

    return { reportPath, report: baseReport };
  } catch (error) {
    baseReport.error = error.message;
    baseReport.finishedAt = new Date().toISOString();
    writeReport(reportPath, baseReport);
    throw error;
  }
}

async function main(argv = process.argv.slice(2)) {
  let parsed;
  try {
    parsed = parseArgs(argv);
  } catch (error) {
    console.error(error.message);
    return EXIT_CODES.ARGUMENT_ERROR;
  }

  try {
    const result = await runBookmarkGif(parsed);
    console.log(`Report written: ${result.reportPath}`);
    return EXIT_CODES.SUCCESS;
  } catch (error) {
    console.error(error.message);
    return error.exitCode || EXIT_CODES.UNKNOWN_ERROR;
  }
}

if (require.main === module) {
  main().then(code => {
    process.exitCode = code;
  });
}

module.exports = {
  ELECTRON_COMPANION_FLAG,
  EXIT_CODES,
  getDefaultReportPath,
  getElectronCompanionArgs,
  inferPBFPathFromVideo,
  main,
  parseArgs,
  resolveInputPaths,
  runBookmarkGif,
  writeReport
};
