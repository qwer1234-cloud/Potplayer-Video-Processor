const fs = require('fs');
const path = require('path');

const DEFAULT_POTPLAYER_PATHS = [
  'C:\\Program Files\\DAUM\\PotPlayer',
  'C:\\Program Files\\PotPlayer',
  'C:\\Program Files (x86)\\DAUM\\PotPlayer',
  'C:\\Program Files (x86)\\PotPlayer'
];

function getSourceDir() {
  return path.join(__dirname, 'Media', 'PlayParse');
}

function getTargetDir(potplayerPath) {
  return path.join(potplayerPath, 'Extension', 'Media', 'PlayParse');
}

function detectPotPlayerPath() {
  return DEFAULT_POTPLAYER_PATHS.find(candidate => fs.existsSync(candidate)) || '';
}

function renderUserIni(options) {
  return [
    '[PROCESSVIDEO]',
    `companion_path=${options.companionPath || ''}`,
    `node_path=${options.nodePath === undefined ? 'node' : options.nodePath}`,
    'mode=bookmark-gif',
    'open_ui_after_start=0',
    `report_path=${options.reportPath || ''}`,
    'timeout_seconds=10',
    'show_launch_message=1',
    'cooldown_seconds=30',
    'require_pbf_exists=1',
    ''
  ].join('\n');
}

function quoteWindowsArg(value) {
  return `"${String(value).replace(/"/g, '\\"')}"`;
}

function quotePowerShellSingle(value) {
  return `'${String(value).replace(/'/g, "''")}'`;
}

function getAdminInstallArgs(options = {}) {
  const args = ['--install-potplayer-extension'];

  if (options.potplayerPath) {
    args.push('--potplayer', options.potplayerPath);
  }
  if (options.companionPath) {
    args.push('--companion', options.companionPath);
  }
  if (options.nodePath !== undefined) {
    args.push('--node');
    if (options.nodePath) {
      args.push(options.nodePath);
    }
  }
  if (options.reportPath) {
    args.push('--report', options.reportPath);
  }

  return args;
}

function buildAdminInstallCommand(options = {}) {
  const exePath = options.exePath || process.execPath;
  const args = getAdminInstallArgs(options);
  return [quoteWindowsArg(exePath), ...args.map(quoteWindowsArg)].join(' ');
}

function buildAdminInstallPowerShellCommand(options = {}) {
  const exePath = options.exePath || process.execPath;
  const args = getAdminInstallArgs(options).map(quoteWindowsArg).join(' ');
  return `Start-Process -FilePath ${quotePowerShellSingle(exePath)} -ArgumentList ${quotePowerShellSingle(args)} -Verb RunAs`;
}

function installPotPlayerExtension(options = {}) {
  const potplayerPath = options.potplayerPath || detectPotPlayerPath();
  if (!potplayerPath) {
    throw new Error('PotPlayer installation path was not found');
  }

  const sourceDir = getSourceDir();
  const targetDir = getTargetDir(potplayerPath);
  fs.mkdirSync(targetDir, { recursive: true });

  const scriptName = 'MediaPlayParse - ProcessVideo.as';
  const defaultIniName = 'ProcessVideo_default.ini';
  fs.copyFileSync(path.join(sourceDir, scriptName), path.join(targetDir, scriptName));
  fs.copyFileSync(path.join(sourceDir, defaultIniName), path.join(targetDir, defaultIniName));

  const userIniPath = path.join(targetDir, 'ProcessVideo.ini');
  let wroteUserIni = false;
  if (!fs.existsSync(userIniPath)) {
    fs.writeFileSync(userIniPath, renderUserIni(options));
    wroteUserIni = true;
  }

  return {
    success: true,
    potplayerPath,
    targetDir,
    scriptPath: path.join(targetDir, scriptName),
    defaultIniPath: path.join(targetDir, defaultIniName),
    userIniPath,
    wroteUserIni
  };
}

function writeInstallReport(reportPath, report) {
  if (!reportPath) {
    return;
  }

  fs.mkdirSync(path.dirname(reportPath), { recursive: true });
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2), 'utf8');
}

function parseCliArgs(argv) {
  const options = {};
  for (let i = 0; i < argv.length; i += 1) {
    const option = argv[i];
    const value = argv[i + 1];
    if (option === '--potplayer') {
      options.potplayerPath = value;
      i += 1;
    } else if (option === '--companion') {
      options.companionPath = value;
      i += 1;
    } else if (option === '--node') {
      if (!value || value.startsWith('--')) {
        options.nodePath = '';
      } else {
        options.nodePath = value;
        i += 1;
      }
    } else if (option === '--report') {
      options.reportPath = value;
      i += 1;
    } else {
      throw new Error(`Unknown option: ${option}`);
    }
  }
  return options;
}

if (require.main === module) {
  try {
    const projectRoot = path.resolve(__dirname, '..');
    const options = parseCliArgs(process.argv.slice(2));
    if (!options.companionPath) {
      options.companionPath = path.join(projectRoot, 'cli', 'processvideo-cli.js');
    }
    if (options.nodePath === undefined) {
      options.nodePath = 'node';
    }
    if (!options.reportPath) {
      options.reportPath = path.join(projectRoot, 'runtime', 'last-run.json');
    }

    const result = installPotPlayerExtension(options);
    writeInstallReport(options.reportPath, result);
    console.log(`Installed ProcessVideo PotPlayer extension to: ${result.targetDir}`);
    console.log(`User config: ${result.userIniPath}${result.wroteUserIni ? ' (created)' : ' (preserved)'}`);
  } catch (error) {
    const options = (() => {
      try {
        return parseCliArgs(process.argv.slice(2));
      } catch (_) {
        return {};
      }
    })();
    writeInstallReport(options.reportPath, {
      success: false,
      error: error.message
    });
    console.error(error.message);
    process.exitCode = 1;
  }
}

module.exports = {
  DEFAULT_POTPLAYER_PATHS,
  buildAdminInstallCommand,
  buildAdminInstallPowerShellCommand,
  detectPotPlayerPath,
  getTargetDir,
  installPotPlayerExtension,
  parseCliArgs,
  renderUserIni,
  writeInstallReport
};
