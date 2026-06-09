const { app, BrowserWindow, ipcMain, dialog, Menu } = require('electron');
const path = require('path');
const { exec } = require('child_process');
const { checkForUpdates } = require('./check-update');
const fs = require('fs');
const {
  getRememberedSelectionPath,
  mergeSettingsForSave,
  rememberSelectionPaths
} = require('./selection-path-config');
const {
  getFFmpegToolEnvironment,
  getFFmpegToolPath,
  mergeFFmpegSettingsForSave,
  quoteCommandPath
} = require('./ffmpeg-config');

// Import bookmark processors
const BookmarkProcessor = require('./scripts/bookmark_processor');
const IntegratedBookmarkProcessor = require('./scripts/integrated_bookmark_processor');
const FinalWorkingProcessor = require('./scripts/ultimate_working_processor');
const RobustBookmarkProcessor = require('./scripts/robust_bookmark_processor');

// Ensure processors are available globally for main process
global.IntegratedBookmarkProcessor = IntegratedBookmarkProcessor;
global.FinalWorkingProcessor = FinalWorkingProcessor;
global.RobustBookmarkProcessor = RobustBookmarkProcessor;

// Data persistence
const userDataPath = app.getPath('userData');
const settingsPath = path.join(userDataPath, 'settings.json');
const windowStatePath = path.join(userDataPath, 'window-state.json');
const DEFAULT_SELECTION_PATHS = {
  default: 'D:\\',
  gif: 'D:\\',
  'bookmark-gif': 'D:\\',
  video: 'C:\\Users\\sunhao\\Desktop\\ToWatch',
  subtitle: 'C:\\Users\\sunhao\\Desktop\\ToWatch',
  '7zip': 'E:\\',
  'add-prefix': 'E:\\',
  'remove-prefix': 'E:\\',
  ffmpeg: 'D:\\ProcessVideo-Beta\\tools\\ffmpeg\\bin'
};

// Increase memory limits and enable garbage collection
app.commandLine.appendSwitch('--max-old-space-size', '4096');
app.commandLine.appendSwitch('--max-semi-space-size', '128');
app.commandLine.appendSwitch('--max-executable-size', '512');
app.commandLine.appendSwitch('--expose-gc'); // Enable garbage collection

// Enhanced logging function
function logWithTimestamp(message, level = 'INFO') {
  const timestamp = new Date().toISOString();
  const logMessage = `[${timestamp}] [${level}] ${message}`;
  console.log(logMessage);

  // Also write to file for debugging
  try {
    const logPath = path.join(__dirname, 'app.log');
    fs.appendFileSync(logPath, logMessage + '\n');
  } catch (error) {
    console.error('Failed to write to log file:', error.message);
  }
}

// Data persistence functions
function saveSettings(settings) {
  try {
    const existingSettings = loadSettings();
    const settingsToSave = mergeFFmpegSettingsForSave(existingSettings, mergeSettingsForSave(existingSettings, settings));

    // Ensure userData directory exists
    if (!fs.existsSync(userDataPath)) {
      fs.mkdirSync(userDataPath, { recursive: true });
    }

    // Save settings with atomic write
    const tempPath = settingsPath + '.tmp';
    fs.writeFileSync(tempPath, JSON.stringify(settingsToSave, null, 2));
    fs.renameSync(tempPath, settingsPath);

    logWithTimestamp('Settings saved successfully');
  } catch (error) {
    logWithTimestamp(`Failed to save settings: ${error.message}`, 'ERROR');
  }
}

function loadSettings() {
  try {
    if (fs.existsSync(settingsPath)) {
      const data = fs.readFileSync(settingsPath, 'utf8');
      return JSON.parse(data);
    }
  } catch (error) {
    logWithTimestamp(`Failed to load settings: ${error.message}`, 'ERROR');
  }

  // Return default settings
  return {
    filePath: '',
    format: 'gif',
    hours: '00',
    minutes: '00',
    seconds: '00',
    milliseconds: '000',
    duration: '1',
    ffmpegPath: '',
    lastSelectionPaths: {}
  };
}

function getSelectionDefaultPath(format) {
  return getRememberedSelectionPath(loadSettings(), format, DEFAULT_SELECTION_PATHS);
}

function rememberSelectionPath(format, filePaths) {
  const settings = rememberSelectionPaths(loadSettings(), format, filePaths);
  saveSettings(settings);
}

function getBundledFFmpegBinPaths() {
  const pathsToCheck = [
    path.join(__dirname, 'tools', 'ffmpeg', 'bin')
  ];

  if (process.resourcesPath) {
    pathsToCheck.push(path.join(process.resourcesPath, 'app', 'tools', 'ffmpeg', 'bin'));
  }

  return pathsToCheck;
}

function saveWindowState(windowState) {
  try {
    if (!fs.existsSync(userDataPath)) {
      fs.mkdirSync(userDataPath, { recursive: true });
    }

    const tempPath = windowStatePath + '.tmp';
    fs.writeFileSync(tempPath, JSON.stringify(windowState, null, 2));
    fs.renameSync(tempPath, windowStatePath);

    logWithTimestamp('Window state saved successfully');
  } catch (error) {
    logWithTimestamp(`Failed to save window state: ${error.message}`, 'ERROR');
  }
}

function loadWindowState() {
  try {
    if (fs.existsSync(windowStatePath)) {
      const data = fs.readFileSync(windowStatePath, 'utf8');
      return JSON.parse(data);
    }
  } catch (error) {
    logWithTimestamp(`Failed to load window state: ${error.message}`, 'ERROR');
  }

  // Return default window state
  return {
    width: 650,
    height: 850,
    x: undefined,
    y: undefined
  };
}

// Advanced window management using PowerShell scripts

let mainWindow;
let processingCompleted = false;
let processCount = 0;

// Global error handlers
process.on('uncaughtException', (error) => {
  logWithTimestamp(`Uncaught Exception: ${error.message}`, 'ERROR');
  logWithTimestamp(`Stack: ${error.stack}`, 'ERROR');
});

process.on('unhandledRejection', (reason, promise) => {
  logWithTimestamp(`Unhandled Rejection at: ${promise}, reason: ${reason}`, 'ERROR');
});

// Advanced window management functions
function forceWindowTopMost(window) {
  // Use PowerShell script to force topmost
  const psScript = `
Add-Type @"
  using System;
  using System.Runtime.InteropServices;
  public class Win32 {
    [DllImport("user32.dll")]
    public static extern bool SetWindowPos(IntPtr hWnd, IntPtr hWndInsertAfter, int X, int Y, int cx, int cy, uint uFlags);
    [DllImport("user32.dll")]
    public static extern IntPtr GetForegroundWindow();
    public static readonly IntPtr HWND_TOPMOST = new IntPtr(-1);
    public const uint SWP_NOSIZE = 0x0001;
    public const uint SWP_NOMOVE = 0x0002;
    public const uint SWP_SHOWWINDOW = 0x0040;
  }
"@

$process = Get-Process | Where-Object {$_.MainWindowTitle -like "*Video Processing Tool*"}
if ($process) {
  $hwnd = $process.MainWindowHandle
  [Win32]::SetWindowPos($hwnd, [Win32]::HWND_TOPMOST, 0, 0, 0, 0, [Win32]::SWP_NOSIZE -bor [Win32]::SWP_NOMOVE -bor [Win32]::SWP_SHOWWINDOW)
  Write-Host "Window forced to topmost"
}
  `;

  exec(`powershell -Command "${psScript}"`, (error, stdout, stderr) => {
    if (error) {
      console.log('PowerShell error:', error.message);
    } else {
      console.log('PowerShell output:', stdout);
    }
  });
}

function executePotPlayerFix() {
  // Execute the enhanced PotPlayer fix PowerShell script
  const psScriptPath = path.join(__dirname, 'potplayer-fix.ps1');

  exec(`powershell -ExecutionPolicy Bypass -File "${psScriptPath}"`, (error, stdout, stderr) => {
    if (error) {
      console.log('PotPlayer fix PowerShell error:', error.message);
    } else {
      console.log('PotPlayer fix PowerShell output:', stdout);
    }
  });
}

function superForceTopMost(window) {
  console.log('Activating Super Force Top for PotPlayer...');

  // Execute enhanced PowerShell script first
  executePotPlayerFix();

  // Enhanced multiple topmost strategies
  const strategies = [
    () => window.setAlwaysOnTop(true, 'screen-saver'),
    () => window.setAlwaysOnTop(true, 'pop-up-menu'),
    () => window.setAlwaysOnTop(true, 'tooltip'),
    () => window.setAlwaysOnTop(true, 'normal'),
    () => window.setAlwaysOnTop(true, 'floating'),
    () => forceWindowTopMost(window),
    () => window.focus(),
    () => window.moveTop(),
    () => window.show(),
    () => window.setSkipTaskbar(false),
    () => window.maximize(),
    () => window.restore(),
    () => window.minimize(),
    () => window.restore(),
    () => executePotPlayerFix() // Execute PowerShell script again
  ];

  // Execute all strategies with timing
  strategies.forEach((strategy, index) => {
    setTimeout(() => {
      try {
        strategy();
        console.log(`Strategy ${index + 1} executed`);
      } catch (error) {
        console.log(`Strategy ${index + 1} failed:`, error.message);
      }
    }, index * 30);
  });

  // More aggressive monitoring and re-application
  let retryCount = 0;
  const maxRetries = 25;

  const monitorInterval = setInterval(() => {
    if (retryCount >= maxRetries) {
      clearInterval(monitorInterval);
      console.log('Maximum retries reached for PotPlayer mode');
      return;
    }

    // Check if window is still topmost
    if (!window.isAlwaysOnTop()) {
      console.log(`Window lost topmost status, re-applying aggressive strategy (attempt ${retryCount + 1})`);

      // Apply multiple topmost modes simultaneously
      window.setAlwaysOnTop(true, 'screen-saver');
      setTimeout(() => window.setAlwaysOnTop(true, 'pop-up-menu'), 10);
      setTimeout(() => window.setAlwaysOnTop(true, 'tooltip'), 20);
      setTimeout(() => forceWindowTopMost(window), 30);
      setTimeout(() => executePotPlayerFix(), 40);

      retryCount++;
    }
  }, 400); // Even more frequent monitoring

  console.log('Super Force Top activated with aggressive monitoring and PowerShell integration');
}

function createWindow() {
  // Load saved window state
  const windowState = loadWindowState();

  mainWindow = new BrowserWindow({
    width: windowState.width || 650,
    height: windowState.height || 850, // Significantly increased height for complete content visibility
    x: windowState.x,
    y: windowState.y,
    minWidth: 600,
    minHeight: 800, // Much higher minimum height to ensure no scrolling needed
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js')
    },
    resizable: true,
    alwaysOnTop: false,
    icon: path.join(__dirname, 'icon-beta.ico')
  });

  mainWindow.loadFile('index.html');

  // Create application menu
  const template = [
    {
      label: 'Window',
      submenu: [
        {
          label: 'Always on Top',
          type: 'checkbox',
          checked: false,
          accelerator: 'CmdOrCtrl+T',
          click: (menuItem) => {
            const currentState = mainWindow.isAlwaysOnTop();
            const newState = !currentState;

            // 尝试多种置顶模式
            if (newState) {
              // 启用置顶时，尝试多种模式
              mainWindow.setAlwaysOnTop(true, 'screen-saver');
              setTimeout(() => {
                if (!mainWindow.isAlwaysOnTop()) {
                  mainWindow.setAlwaysOnTop(true, 'pop-up-menu');
                }
              }, 100);
            } else {
              // 禁用置顶
              mainWindow.setAlwaysOnTop(false);
            }

            menuItem.checked = newState;
            console.log(`Always on Top: ${currentState ? 'was ENABLED, now DISABLED' : 'was DISABLED, now ENABLED'}`);
          }
        },
        {
          label: 'Force Always on Top',
          accelerator: 'CmdOrCtrl+Shift+T',
          click: () => {
            // 强制置顶模式 - 针对视频播放器
            mainWindow.setAlwaysOnTop(true, 'screen-saver');
            mainWindow.setAlwaysOnTop(true, 'pop-up-menu');
            mainWindow.setAlwaysOnTop(true, 'tooltip');

            // 额外的窗口提升
            mainWindow.focus();
            mainWindow.moveTop();

            // 使用Windows原生API强制置顶
            setTimeout(() => {
              forceWindowTopMost(mainWindow);
            }, 100);

            console.log('Force Always on Top enabled for video players');
          }
        },
        {
          label: 'Super Force Top (PotPlayer)',
          accelerator: 'CmdOrCtrl+Alt+T',
          click: () => {
            // 针对PotPlayer的特殊模式
            superForceTopMost(mainWindow);
          }
        },
        { type: 'separator' },
        { role: 'minimize', label: 'Minimize' },
        { role: 'close', label: 'Close' }
      ]
    },
    {
      label: 'Help',
      submenu: [
        {
          label: 'About',
          click: () => {
            dialog.showMessageBox(mainWindow, {
              type: 'info',
              title: 'About',
              message: 'Video Processing Tool Beta',
              detail: 'A tool for extracting video segments and creating GIFs. (Beta Version)'
            });
          }
        }
      ]
    }
  ];

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);

  // 开发模式下打开开发者工具
  if (process.argv.includes('--dev')) {
    mainWindow.webContents.openDevTools();
  }

  // Save window state on resize and move
  const saveWindowStateDebounced = debounce(() => {
    const bounds = mainWindow.getBounds();
    saveWindowState(bounds);
  }, 500);

  mainWindow.on('resize', saveWindowStateDebounced);
  mainWindow.on('move', saveWindowStateDebounced);

  // Save window state on close
  mainWindow.on('close', () => {
    const bounds = mainWindow.getBounds();
    saveWindowState(bounds);
  });
}

// Debounce function for window state saving
function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

app.whenReady().then(() => {
  createWindow();
  // Check for updates after a short delay
  setTimeout(() => {
    checkForUpdates();
  }, 2000);
});

app.on('window-all-closed', () => {
  logWithTimestamp('All windows closed, quitting application');
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('before-quit', (event) => {
  logWithTimestamp('Application quitting, cleaning up resources');
  // Force clear all window references
  mainWindow = null;
});

app.on('will-quit', (event) => {
  logWithTimestamp('Application will quit');
});

app.on('quit', (event, exitCode) => {
  logWithTimestamp(`Application quit with exit code: ${exitCode}`);
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

// 处理文件选择
ipcMain.handle('select-file', async (event, format) => {
  let filters = [];
  let title = '选择文件';

  // 根据格式设置不同的文件过滤器
  if (format === 'bookmark-gif') {
    title = '选择PBF书签文件';
    filters = [
      { name: 'PBF书签文件', extensions: ['pbf'] },
      { name: '所有文件', extensions: ['*'] }
    ];
  } else if (format === 'subtitle') {
    title = '选择视频文件以提取字幕';
    filters = [
      { name: '视频文件', extensions: ['mp4', 'avi', 'mov', 'mkv', 'wmv', 'flv', 'webm', 'm4v', '3gp'] },
      { name: '所有文件', extensions: ['*'] }
    ];
  } else if (format === '7zip' || format === 'add-prefix' || format === 'remove-prefix') {
    title = format === '7zip' ? '选择要压缩的文件夹' : '选择要重命名文件的文件夹';
    // For 7Zip and prefix operations, we want to select folders
    const result = await dialog.showOpenDialog(mainWindow, {
      title: title,
      defaultPath: getSelectionDefaultPath(format),
      properties: ['openDirectory'] // Select folder instead of file
    });

    if (!result.canceled && result.filePaths.length > 0) {
      rememberSelectionPath(format, result.filePaths);
      return result.filePaths[0]; // Return the selected folder path
    }
    return null;
  } else {
    title = '选择视频文件';
    filters = [
      { name: '视频文件', extensions: ['mp4', 'avi', 'mov', 'mkv', 'wmv', 'flv', 'webm'] },
      { name: '所有文件', extensions: ['*'] }
    ];
  }

  const result = await dialog.showOpenDialog(mainWindow, {
    title: title,
    defaultPath: getSelectionDefaultPath(format),
    filters: filters,
    properties: format === 'bookmark-gif' ? ['openMultiFile'] : ['openFile']
  });

  if (!result.canceled && result.filePaths.length > 0) {
    rememberSelectionPath(format, result.filePaths);
    // For bookmark-gif format, return array of files; for others, return single file
    if (format === 'bookmark-gif') {
      return result.filePaths; // Return array of PBF files
    } else {
      return result.filePaths[0]; // Return single file path
    }
  }
  return null;
});

// Select FFmpeg bin directory
ipcMain.handle('select-ffmpeg-path', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    title: 'Select FFmpeg bin folder',
    defaultPath: getSelectionDefaultPath('ffmpeg'),
    properties: ['openDirectory']
  });

  if (!result.canceled && result.filePaths.length > 0) {
    rememberSelectionPath('ffmpeg', result.filePaths);
    return result.filePaths[0];
  }

  return null;
});

// Save settings
ipcMain.handle('save-settings', async (event, settings) => {
  saveSettings(settings);
  return { success: true };
});

// Load settings
ipcMain.handle('load-settings', async () => {
  return loadSettings();
});

// Parse PBF file and extract bookmarks
ipcMain.handle('parse-pbf-bookmarks', async (event, pbfFilePath) => {
  try {
    const bookmarks = await parsePBFBookmarks(pbfFilePath);
    return { success: true, bookmarks };
  } catch (error) {
    logWithTimestamp(`PBF parsing failed: ${error.message}`, 'ERROR');
    return { success: false, error: error.message };
  }
});

// Detect subtitles in video file
ipcMain.handle('detect-subtitles', async (event, videoPath) => {
  try {
    const subtitles = await detectSubtitles(videoPath);
    return { success: true, subtitles };
  } catch (error) {
    logWithTimestamp(`Subtitle detection failed: ${error.message}`, 'ERROR');
    return { success: false, error: error.message };
  }
});

// Extract subtitle from video file
ipcMain.handle('extract-subtitle', async (event, videoPath, streamIndex, language) => {
  try {
    const outputPath = await extractSubtitle(videoPath, streamIndex, language);
    return { success: true, outputPath };
  } catch (error) {
    logWithTimestamp(`Subtitle extraction failed: ${error.message}`, 'ERROR');
    return { success: false, error: error.message };
  }
});

// PBF file parsing function
async function parsePBFBookmarks(pbfFilePath) {
  return new Promise((resolve, reject) => {
    const fs = require('fs');
    const path = require('path');

    logWithTimestamp(`Parsing PBF file: ${pbfFilePath}`);

    // Check if file exists
    if (!fs.existsSync(pbfFilePath)) {
      reject(new Error(`PBF file not found: ${pbfFilePath}`));
      return;
    }

    try {
      // Read PBF file content - try UTF-16LE first (PotPlayer format)
      let content;
      try {
        const buffer = fs.readFileSync(pbfFilePath);
        content = buffer.toString('utf16le');
        logWithTimestamp(`Reading PBF file with UTF-16LE encoding`);
      } catch (utf16Error) {
        // Fallback to UTF-8
        content = fs.readFileSync(pbfFilePath, 'utf8');
        logWithTimestamp(`Reading PBF file with UTF-8 encoding (fallback)`);
      }

      // Parse bookmarks based on common PBF/PotPlayer bookmark formats
      const bookmarks = parseBookmarkContent(content);

      if (bookmarks.length === 0) {
        reject(new Error('No bookmarks found in PBF file'));
        return;
      }

      logWithTimestamp(`Found ${bookmarks.length} bookmarks in PBF file`);
      resolve(bookmarks);

    } catch (error) {
      reject(new Error(`Failed to read PBF file: ${error.message}`));
    }
  });
}

// Parse bookmark content from PBF file
function parseBookmarkContent(content) {
  const bookmarks = [];

  // Split content into lines and process each line
  const lines = content.split('\n');

  // Format 1: PotPlayer PBF format (序号=时间戳*书签名称*图片数据...)
  // Fixed regex pattern based on actual PBF format analysis
  for (let lineRaw of lines) {
    const line = lineRaw.trim();
    if (line.startsWith('//') || line === '' || line === '[Bookmark]') continue;

    // Fixed regex: /^(\d+)=(\d+)\*([^*]*)\*/
    const match = /^(\d+)=(\d+)\*([^*]*)\*/.exec(line);
    if (match) {
      const index = parseInt(match[1]);
      const timestamp = parseInt(match[2]);
      const bookmarkName = match[3] || `书签 ${index + 1}`;

      // Convert timestamp to HH:MM:SS.mmm format
      const timeString = convertTimestampToTime(timestamp);

      bookmarks.push({
        index: index,
        timestamp: timestamp,
        time: timeString,
        name: bookmarkName,
        originalLine: line
      });
    }
  }

  // Sort bookmarks by index to ensure correct order
  bookmarks.sort((a, b) => a.index - b.index);

  // If no PotPlayer PBF format found, try other formats
  if (bookmarks.length === 0) {
    // Format 2: PotPlayer bookmark format (timestamp:HH:MM:SS.mmm name:BookmarkName)
    const potPlayerRegex = /timestamp:(\d{2}:\d{2}:\d{2}(?:\.\d{3})?)\s+name:(.+)/gi;

    while ((match = potPlayerRegex.exec(content)) !== null) {
      bookmarks.push({
        time: match[1],
        name: match[2].trim(),
        originalLine: match[0]
      });
    }

    // Format 3: Simple time format (HH:MM:SS.mmm BookmarkName)
    if (bookmarks.length === 0) {
      const simpleRegex = /(\d{2}:\d{2}:\d{2}(?:\.\d{3})?)\s+(.+)/gi;
      while ((match = simpleRegex.exec(content)) !== null) {
        bookmarks.push({
          time: match[1],
          name: match[2].trim(),
          originalLine: match[0]
        });
      }
    }

    // Format 4: JSON format
    if (bookmarks.length === 0) {
      try {
        const jsonData = JSON.parse(content);
        if (Array.isArray(jsonData)) {
          jsonData.forEach(item => {
            if (item.time && item.name) {
              bookmarks.push({
                time: item.time,
                name: item.name,
                originalLine: JSON.stringify(item)
              });
            }
          });
        }
      } catch (e) {
        // Not JSON format, continue
      }
    }

    // Format 5: Line by line parsing (each line: time name)
    if (bookmarks.length === 0) {
      const lines = content.split('\n');
      lines.forEach(line => {
        const trimmedLine = line.trim();
        if (trimmedLine) {
          const parts = trimmedLine.split(/\s+/);
          if (parts.length >= 2 && /^\d{2}:\d{2}:\d{2}/.test(parts[0])) {
            bookmarks.push({
              time: parts[0],
              name: parts.slice(1).join(' '),
              originalLine: trimmedLine
            });
          }
        }
      });
    }
  }

  return bookmarks;
}

// Convert PotPlayer timestamp to HH:MM:SS.mmm format
function convertTimestampToTime(timestamp) {
  // PotPlayer timestamp is in milliseconds, convert to HH:MM:SS.mmm
  const totalSeconds = Math.floor(timestamp / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const milliseconds = timestamp % 1000;

  return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}.${milliseconds.toString().padStart(3, '0')}`;
}

// Convert time string HH:MM:SS:mmm to seconds
function convertTimeToSeconds(timeStr) {
  const parseTime = (timeStr) => {
    const parts = timeStr.split(':');
    const hours = parseInt(parts[0]) || 0;
    const minutes = parseInt(parts[1]) || 0;
    const secondsParts = parts[2].split('.');
    const seconds = parseInt(secondsParts[0]) || 0;
    const milliseconds = parseInt(secondsParts[1]) || 0;

    return hours * 3600 + minutes * 60 + seconds + milliseconds / 1000;
  };

  return parseTime(timeStr);
}

// Convert seconds to time string HH:MM:SS.mmm
function convertSecondsToTime(totalSeconds) {
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = Math.floor(totalSeconds % 60);
  const milliseconds = Math.round((totalSeconds % 1) * 1000);

  return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}.${milliseconds.toString().padStart(3, '0')}`;
}


// Execute script function with enhanced memory management
function executeScript(scriptPath, args, format) {
  return new Promise((resolve, reject) => {
    const command = `${scriptPath} ${args.map(arg => `"${arg}"`).join(' ')}`;
    logWithTimestamp(`Executing command: ${command}`);

    let childProcess = null;

    // Enhanced timeout control - increased for long GIF generation
    const timeoutId = setTimeout(() => {
      logWithTimestamp('Script execution timeout reached', 'ERROR');

      if (childProcess) {
        try {
          childProcess.kill();
          logWithTimestamp('Child process killed due to timeout');
        } catch (killError) {
          logWithTimestamp(`Failed to kill child process: ${killError.message}`, 'WARN');
        }
      }

      reject(new Error('Script execution timeout'));
    }, 1800000); // 30 minutes timeout for long GIF generation

    // Enhanced encoding function with better cleanup
    const tryEncoding = (encoding) => {
      logWithTimestamp(`Trying encoding: ${encoding}`);

      childProcess = exec(command, {
        cwd: 'D:\\',
        encoding: encoding,
        timeout: 1500000, // 25 minutes timeout for long GIF generation
        maxBuffer: 1024 * 1024 * 20 // 20MB buffer for longer output
      }, (error, stdout, stderr) => {
        // Clean up timeout
        clearTimeout(timeoutId);

        if (error) {
          logWithTimestamp(`Execution error (${encoding}): ${error.message}`, 'ERROR');
          if (stderr) {
            logWithTimestamp(`Stderr: ${stderr}`, 'ERROR');
          }

          // If UTF-8 fails, try GBK
          if (encoding === 'utf8') {
            logWithTimestamp('UTF-8 encoding failed, trying GBK encoding...', 'WARN');
            tryEncoding('gbk');
          } else {
            reject(error);
          }
        } else {
          logWithTimestamp(`Execution successful (${encoding}): ${stdout}`, 'INFO');
          resolve(stdout);
        }
      });

      // Enhanced child process event handling
      childProcess.on('exit', (code, signal) => {
        logWithTimestamp(`Child process exited with code: ${code}, signal: ${signal}`);
        childProcess = null; // Clear reference
      });

      childProcess.on('error', (error) => {
        logWithTimestamp(`Child process error: ${error.message}`, 'ERROR');
        childProcess = null; // Clear reference
      });

      // Monitor memory usage during execution
      const memoryMonitor = setInterval(() => {
        const memoryUsage = process.memoryUsage();
        logWithTimestamp(`Memory during execution - RSS: ${Math.round(memoryUsage.rss / 1024 / 1024)}MB, Heap: ${Math.round(memoryUsage.heapUsed / 1024 / 1024)}MB`);
      }, 10000); // Log every 10 seconds

      // Clean up memory monitor when done
      childProcess.on('exit', () => {
        clearInterval(memoryMonitor);
      });
    };

    // Start with UTF-8 encoding
    tryEncoding('utf8');
  });
}


// Handle video processing request with enhanced memory management
ipcMain.handle('process-video', async (event, { filePath, format, startTime, duration, bookmarks, pbfFiles, allBookmarks, prefix }) => {
  processingCompleted = false;
  processCount++;

  // Enhanced memory logging
  const memoryUsage = process.memoryUsage();
  logWithTimestamp(`Process #${processCount} - Memory: RSS=${Math.round(memoryUsage.rss / 1024 / 1024)}MB, Heap=${Math.round(memoryUsage.heapUsed / 1024 / 1024)}MB, External=${Math.round(memoryUsage.external / 1024 / 1024)}MB`);

  // Check if this is 7Zip compression
  if (format === '7zip') {
    logWithTimestamp('Starting 7Zip compression');

    try {
      const result = await compressWith7Zip(filePath, event);

      if (result.success) {
        processingCompleted = true;
        logWithTimestamp('7Zip compression completed successfully');

        // Force garbage collection if available
        if (global.gc) {
          global.gc();
          logWithTimestamp('Forced garbage collection after 7Zip processing');
        }

        return {
          success: true,
          message: `Folder compressed successfully: ${result.outputPath}`
        };
      } else {
        throw new Error(result.error || '7Zip compression failed');
      }
    } catch (error) {
      logWithTimestamp(`7Zip compression failed: ${error.message}`, 'ERROR');
      throw error;
    }
  }

  // Check if this is prefix operations
  if (format === 'add-prefix' || format === 'remove-prefix') {
    logWithTimestamp(`Starting ${format === 'add-prefix' ? 'add' : 'remove'} prefix operation`);

    try {
      // Get prefix from parameters
      const prefixToUse = prefix || '';
      if (!prefixToUse) {
        throw new Error('前缀不能为空');
      }

      const result = await processFilePrefixes(filePath, format === 'add-prefix' ? 'add' : 'remove', prefixToUse, event);

      if (result.success) {
        processingCompleted = true;
        logWithTimestamp(`${format === 'add-prefix' ? 'Add' : 'Remove'} prefix operation completed successfully`);

        return {
          success: true,
          message: result.message,
          processedFiles: result.processedFiles,
          skippedFiles: result.skippedFiles
        };
      } else {
        throw new Error(result.error || `${format === 'add-prefix' ? 'Add' : 'Remove'} prefix operation failed`);
      }
    } catch (error) {
      logWithTimestamp(`${format === 'add-prefix' ? 'Add' : 'Remove'} prefix operation failed: ${error.message}`, 'ERROR');
      throw error;
    }
  }

  // Check if this is bookmark-based processing
  if (format === 'bookmark-gif') {
    logWithTimestamp('Using Robust Bookmark Processor for bookmark processing');

    // Use the new ROBUST processor with enhanced error handling
    const robustProcessor = new global.RobustBookmarkProcessor({
      outputDir: 'D:\\',
      defaultWidth: 960,
      defaultHeight: 540,
      defaultFps: 15,
      defaultQuality: 20,
      ffmpegPath: loadSettings().ffmpegPath,
      ffmpegDefaultPaths: getBundledFFmpegBinPaths()
    });

    // Determine which bookmarks to use
    const bookmarksToProcess = allBookmarks && allBookmarks.length > 0 ? allBookmarks[0].bookmarks : bookmarks;

    // For multiple PBF files, find the correct video file path
    let actualVideoPath = filePath;

    // If filePath is not a valid file path (like "1 个PBF文件已选择"),
    // try to find the video file from the first PBF file
    if (!fs.existsSync(filePath) && allBookmarks && allBookmarks.length > 0) {
      const firstPBFPath = allBookmarks[0].filePath;
      logWithTimestamp(`Original filePath not valid, looking for video file for: ${firstPBFPath}`);

      // Find corresponding video file
      const pbfDir = path.dirname(firstPBFPath);
      const pbfBaseName = path.basename(firstPBFPath, '.pbf');
      const videoExtensions = ['.mp4', '.avi', '.mov', '.mkv', '.wmv', '.flv', '.webm'];

      for (const ext of videoExtensions) {
        const testVideoPath = path.join(pbfDir, `${pbfBaseName}${ext}`);
        if (fs.existsSync(testVideoPath)) {
          actualVideoPath = testVideoPath;
          logWithTimestamp(`Found video file: ${actualVideoPath}`);
          break;
        }
      }

      if (!fs.existsSync(actualVideoPath)) {
        throw new Error(`Video file not found for PBF: ${firstPBFPath}`);
      }
    }

    logWithTimestamp(`Processing ${bookmarksToProcess.length} bookmarks with video: ${actualVideoPath}`);

    // Get PBF path for custom output directory
    const pbfPath = allBookmarks && allBookmarks.length > 0 ? allBookmarks[0].filePath : null;
    return await robustProcessor.processBookmarkPairs(bookmarksToProcess, actualVideoPath, event, pbfPath);
  }

  logWithTimestamp(`Starting video processing: ${filePath}, format: ${format}, start: ${startTime}, duration: ${duration}`);

  try {
    // Verify file exists
    if (!fs.existsSync(filePath)) {
      throw new Error(`File does not exist: ${filePath}`);
    }

    // Bookmark-gif format is now handled above by the Ultimate Working Processor

    // For GIF format, use Robust Processor for consistency
    if (format === 'gif') {
      logWithTimestamp('Using Robust Bookmark Processor for single GIF generation');

      // Create a single bookmark from start time and duration
      const startTimeInSeconds = convertTimeToSeconds(startTime);
      const endTimeInSeconds = startTimeInSeconds + parseInt(duration) * 60; // duration is in minutes

      const startBookmark = {
        time: startTime,
        name: 'Manual GIF'
      };

      const endBookmark = {
        time: convertSecondsToTime(endTimeInSeconds),
        name: 'End'
      };

      // Use Robust Bookmark Processor
      const robustProcessor = new global.RobustBookmarkProcessor({
        outputDir: 'D:\\',
        defaultWidth: 960,
        defaultHeight: 540,
        defaultFps: 15,
        defaultQuality: 20,
        ffmpegPath: loadSettings().ffmpegPath,
        ffmpegDefaultPaths: getBundledFFmpegBinPaths()
      });

      const result = await robustProcessor.processBookmarkPairs([startBookmark, endBookmark], filePath, event);

      if (result.success) {
        processingCompleted = true;
        logWithTimestamp('Single GIF generation completed successfully');

        // Force garbage collection if available
        if (global.gc) {
          global.gc();
          logWithTimestamp('Forced garbage collection after processing');
        }

        return {
          success: true,
          message: `GIF generated successfully: ${result.results[0]?.outputPath || 'Unknown location'}`
        };
      } else {
        throw new Error(result.error || 'GIF generation failed');
      }
    }

    // For video format, use existing logic
    const scriptName = 'extractVideo.cmd';
    const scriptPath = `D:\\${scriptName}`;

    if (!fs.existsSync(scriptPath)) {
      throw new Error(`Script file does not exist: ${scriptPath}`);
    }

    // Convert time format HH:MM:SS:mmm -> HH:MM:SS
    const timeParts = startTime.split(':');
    const scriptTime = `${timeParts[0]}:${timeParts[1]}:${timeParts[2]}`;

    logWithTimestamp(`Processing parameters - file: ${filePath}, format: ${format}, time: ${scriptTime}, duration: ${duration}`);

    // Execute script (no progress window)
    logWithTimestamp('Starting script execution');
    await executeScript(scriptPath, [filePath, scriptTime, duration], format);
    processingCompleted = true;
    logWithTimestamp('Script execution completed successfully');

    // Force garbage collection if available
    if (global.gc) {
      global.gc();
      logWithTimestamp('Forced garbage collection after processing');
    }

    logWithTimestamp('Returning success result to renderer');
    return { success: true, message: 'Processing completed!' };
  } catch (error) {
    logWithTimestamp(`Processing failed: ${error.message}`, 'ERROR');
    logWithTimestamp(`Stack: ${error.stack}`, 'ERROR');

    return {
      success: false,
      message: `Processing failed: ${error.message}`
    };
  } finally {
    // Enhanced resource cleanup
    if (!processingCompleted) {
      logWithTimestamp('Processing was not completed successfully', 'WARN');
    }

    // Log final memory usage
    const finalMemoryUsage = process.memoryUsage();
    logWithTimestamp(`Process #${processCount} completed - Memory: RSS=${Math.round(finalMemoryUsage.rss / 1024 / 1024)}MB, Heap=${Math.round(finalMemoryUsage.heapUsed / 1024 / 1024)}MB`);
  }
});

// Process multiple PBF files using FFmpeg-based scripts
async function processMultipleBookmarkGifsWithFFmpeg(event, pbfFiles, allBookmarksData, options = {}) {
  logWithTimestamp(`Starting multiple PBF files GIF processing with FFmpeg scripts: ${pbfFiles.length} files`);

  try {
    // Initialize bookmark processor
    const processor = new BookmarkProcessor({
      outputDir: options.outputDir || 'D:\\',
      defaultWidth: options.width || 480,
      defaultHeight: options.height || 270,
      defaultFps: options.fps || 15,
      defaultQuality: options.quality || 20
    });

    // Generate scripts for all bookmark pairs
    const scriptResult = await processor.processMultiplePBFFiles(pbfFiles, allBookmarksData, options);

    if (!scriptResult.success) {
      throw new Error(scriptResult.error);
    }

    logWithTimestamp(`Generated FFmpeg scripts: ${scriptResult.masterScriptPath}`);
    logWithTimestamp(`Total bookmark pairs to process: ${scriptResult.totalScripts}`);

    // Send progress update to renderer
    event.sender.send('processing-progress', {
      current: 0,
      total: scriptResult.totalScripts,
      message: `已生成FFmpeg脚本，准备处理 ${scriptResult.totalScripts} 个GIF片段...`
    });

    // Execute the master script
    const executionResult = await processor.executeScripts(scriptResult.masterScriptPath);

    // Collect results
    const allResults = [];
    let processedCount = 0;

    for (let fileIndex = 0; fileIndex < allBookmarksData.length; fileIndex++) {
      const pbfData = allBookmarksData[fileIndex];
      const { fileName, bookmarks } = pbfData;

      // Create bookmark pairs for this file
      for (let i = 0; i < bookmarks.length - 1; i += 2) {
        const startBookmark = bookmarks[i];
        const endBookmark = bookmarks[i + 1];
        const duration = calculateDurationInSeconds(startBookmark.time, endBookmark.time);
        const pairIndex = Math.floor(i / 2) + 1;
        // Generate output filename using start time as timestamp
        const formattedStartTime = formatTimeForFilename(startBookmark.time);
        const fileBaseName = fileName.replace(/\.[^/.]+$/, '').replace(/[^\w\u4e00-\u9fa5]/g, '_').substring(0, 15);
        const safeBookmarkName = startBookmark.name ?
          startBookmark.name.replace(/[^\w\u4e00-\u9fa5]/g, '_').substring(0, 15) :
          `pair_${pairIndex}`;
        const outputFileName = `${fileBaseName}_${formattedStartTime}.gif`;
        const expectedOutputPath = `D:\\${outputFileName}`;

        // Check if the expected GIF file was actually created
        const fs = require('fs');
        const fileExists = fs.existsSync(expectedOutputPath);

        allResults.push({
          fileName: fileName,
          pairIndex: pairIndex,
          globalPairIndex: processedCount + 1,
          startTime: startBookmark.time,
          endTime: endBookmark.time,
          duration: duration,
          name: startBookmark.name || `片段 ${pairIndex}`,
          success: fileExists, // Actual file existence check
          outputPath: expectedOutputPath,
          actualFileCreated: fileExists
        });

        // Log result for debugging
        if (fileExists) {
          logWithTimestamp(`✅ GIF created successfully: ${expectedOutputPath}`);
        } else {
          logWithTimestamp(`❌ GIF creation failed - file not found: ${expectedOutputPath}`, 'ERROR');
        }

        processedCount++;
      }
    }

    logWithTimestamp(`Script execution summary: Total pairs=${processedCount}, GIF files created=${executionResult.gifCount || 0}, Output directory=${executionResult.outputDir}`);

    processingCompleted = true;

    // Final progress update
    event.sender.send('processing-progress', {
      current: processedCount,
      total: processedCount,
      message: '所有FFmpeg脚本执行完成！'
    });

    logWithTimestamp(`FFmpeg batch processing completed: ${processedCount} GIFs generated`);

    return {
      success: true,
      message: `成功使用FFmpeg生成 ${processedCount} 个GIF`,
      results: allResults
    };

  } catch (error) {
    processingCompleted = false;
    logWithTimestamp(`FFmpeg multiple PBF processing failed: ${error.message}`, 'ERROR');

    return {
      success: false,
      message: `FFmpeg批量书签处理失败: ${error.message}`
    };
  }
}

// Process multiple PBF files for GIF generation with enhanced memory management and sequential processing
async function processMultipleBookmarkGifs(event, pbfFiles, allBookmarksData) {
  logWithTimestamp(`Starting multiple PBF files GIF processing with ${pbfFiles.length} files`);

  try {
    const allResults = [];
    let totalPairs = 0;

    // Calculate total pairs for progress tracking
    allBookmarksData.forEach(pbfData => {
      const pairsCount = Math.floor(pbfData.bookmarks.length / 2);
      totalPairs += pairsCount;
    });

    if (totalPairs === 0) {
      throw new Error('No valid bookmark pairs found in any PBF files. Need at least 2 bookmarks per file to create GIFs.');
    }

    logWithTimestamp(`Found ${totalPairs} total bookmark pairs across ${pbfFiles.length} files`);

    // Send initial progress update to renderer
    event.sender.send('processing-progress', {
      current: 0,
      total: totalPairs,
      message: `准备处理 ${pbfFiles.length} 个文件的 ${totalPairs} 个GIF片段...`
    });

    let processedPairs = 0;

    // Process each PBF file sequentially
    for (let fileIndex = 0; fileIndex < pbfFiles.length; fileIndex++) {
      const pbfFilePath = pbfFiles[fileIndex];
      const pbfData = allBookmarksData[fileIndex];
      const { fileName, bookmarks } = pbfData;

      logWithTimestamp(`Processing PBF file ${fileIndex + 1}/${pbfFiles.length}: ${fileName}`);

      // Create bookmark pairs for this file
      const bookmarkPairs = [];
      for (let i = 0; i < bookmarks.length - 1; i += 2) {
        const startBookmark = bookmarks[i];
        const endBookmark = bookmarks[i + 1];

        // Calculate duration in seconds
        const duration = calculateDurationInSeconds(startBookmark.time, endBookmark.time);

        bookmarkPairs.push({
          start: startBookmark,
          end: endBookmark,
          duration: duration,
          pairIndex: Math.floor(i / 2) + 1,
          globalPairIndex: processedPairs + Math.floor(i / 2) + 1,
          fileName: fileName
        });
      }

      if (bookmarkPairs.length === 0) {
        logWithTimestamp(`No valid bookmark pairs in ${fileName}, skipping`);
        continue;
      }

      // Find corresponding video file for this PBF
      let videoFilePath;
      try {
        videoFilePath = await findVideoFileForPBF(pbfFilePath);
      } catch (error) {
        // If no matching video found, add error results for all pairs in this file
        logWithTimestamp(`No video file found for ${fileName}: ${error.message}`);
        bookmarkPairs.forEach(pair => {
          allResults.push({
            fileName: fileName,
            pairIndex: pair.pairIndex,
            globalPairIndex: pair.globalPairIndex,
            startTime: pair.start.time,
            endTime: pair.end.time,
            duration: pair.duration,
            name: pair.start.name || `片段 ${pair.pairIndex}`,
            success: false,
            error: `未找到对应的视频文件: ${error.message}`
          });
          processedPairs++;
        });
        continue;
      }

      // Process each bookmark pair in this file
      const scriptPath = 'D:\\makeGif.cmd';

      if (!fs.existsSync(scriptPath)) {
        throw new Error(`Script file does not exist: ${scriptPath}`);
      }

      for (let pairIndex = 0; pairIndex < bookmarkPairs.length; pairIndex++) {
        const pair = bookmarkPairs[pairIndex];

        try {
          logWithTimestamp(`Processing ${fileName} - pair ${pair.pairIndex}: ${pair.start.time} -> ${pair.end.time} (${pair.duration}s)`);

          // Update progress
          event.sender.send('processing-progress', {
            current: processedPairs,
            total: totalPairs,
            message: `正在处理 ${fileName} - 第 ${pair.pairIndex} 个片段: ${pair.start.name || `片段 ${pair.pairIndex}`}`
          });

          // Convert time format for script
          const scriptTime = convertTimeFormat(pair.start.time);

          // Generate output filename with file name prefix
          const outputFileName = generateMultipleBookmarkGifName(fileName, pair.start.name, pair.pairIndex, pair.globalPairIndex, pair.start.time);
          const outputPath = `D:\\${outputFileName}`;

          // Execute script with memory management
          logWithTimestamp(`Executing GIF generation for ${fileName} - pair ${pair.pairIndex}`);

          await executeScript(scriptPath, [videoFilePath, scriptTime, pair.duration.toString(), outputFileName], 'gif');

          // Force garbage collection between processes
          if (global.gc) {
            global.gc();
          }

          allResults.push({
            fileName: fileName,
            pairIndex: pair.pairIndex,
            globalPairIndex: pair.globalPairIndex,
            startTime: pair.start.time,
            endTime: pair.end.time,
            duration: pair.duration,
            name: pair.start.name || `片段 ${pair.pairIndex}`,
            outputPath: outputPath,
            success: true
          });

          logWithTimestamp(`Successfully completed GIF generation for ${fileName} - pair ${pair.pairIndex}`);

        } catch (error) {
          logWithTimestamp(`Failed to process ${fileName} - pair ${pair.pairIndex}: ${error.message}`, 'ERROR');

          allResults.push({
            fileName: fileName,
            pairIndex: pair.pairIndex,
            globalPairIndex: pair.globalPairIndex,
            startTime: pair.start.time,
            endTime: pair.end.time,
            duration: pair.duration,
            name: pair.start.name || `片段 ${pair.pairIndex}`,
            success: false,
            error: error.message
          });
        }

        processedPairs++;

        // Small delay between processes to prevent system overload
        await new Promise(resolve => setTimeout(resolve, 1000));
      }

      logWithTimestamp(`Completed processing for ${fileName} (${bookmarkPairs.length} pairs)`);
    }

    processingCompleted = true;

    // Final progress update
    event.sender.send('processing-progress', {
      current: totalPairs,
      total: totalPairs,
      message: '所有文件处理完成！'
    });

    const successCount = allResults.filter(r => r.success).length;
    const failureCount = allResults.length - successCount;

    logWithTimestamp(`Multiple PBF processing completed: ${successCount} successful, ${failureCount} failed`);

    return {
      success: true,
      message: `成功生成 ${successCount} 个GIF${failureCount > 0 ? `，失败 ${failureCount} 个` : ''}`,
      results: allResults
    };

  } catch (error) {
    processingCompleted = false;
    logWithTimestamp(`Multiple PBF processing failed: ${error.message}`, 'ERROR');

    return {
      success: false,
      message: `批量书签处理失败: ${error.message}`
    };
  }
}

// Process bookmark-based GIF generation using FFmpeg scripts
async function processBookmarkGifsWithFFmpeg(event, pbfFilePath, bookmarks, options = {}) {
  logWithTimestamp(`Starting bookmark-based GIF processing with FFmpeg scripts: ${bookmarks.length} bookmarks`);

  try {
    // Initialize bookmark processor
    const processor = new BookmarkProcessor({
      outputDir: options.outputDir || 'D:\\',
      defaultWidth: options.width || 480,
      defaultHeight: options.height || 270,
      defaultFps: options.fps || 15,
      defaultQuality: options.quality || 20
    });

    // Generate scripts for all bookmark pairs
    const scriptResult = await processor.processSinglePBFFile(pbfFilePath, bookmarks, options);

    if (!scriptResult.success) {
      throw new Error(scriptResult.error);
    }

    logWithTimestamp(`Generated FFmpeg scripts: ${scriptResult.masterScriptPath}`);
    logWithTimestamp(`Total bookmark pairs to process: ${scriptResult.totalScripts}`);

    // Send progress update to renderer
    event.sender.send('processing-progress', {
      current: 0,
      total: scriptResult.totalScripts,
      message: `已生成FFmpeg脚本，准备处理 ${scriptResult.totalScripts} 个GIF片段...`
    });

    // Execute master script
    await processor.executeScripts(scriptResult.masterScriptPath);

    // Collect results
    const results = [];
    for (let i = 0; i < bookmarks.length - 1; i += 2) {
      const startBookmark = bookmarks[i];
      const endBookmark = bookmarks[i + 1];
      const duration = calculateDurationInSeconds(startBookmark.time, endBookmark.time);
      const pairIndex = Math.floor(i / 2) + 1;

      const expectedOutputPath = scriptResult.scripts[i/2]?.outputPath || `D:\\bookmark_${pairIndex}.gif`;
      const fs = require('fs');
      const fileExists = fs.existsSync(expectedOutputPath);

      results.push({
        pairIndex: pairIndex,
        startTime: startBookmark.time,
        endTime: endBookmark.time,
        duration: duration,
        name: startBookmark.name || `片段 ${pairIndex}`,
        success: fileExists, // Check actual file existence
        outputPath: expectedOutputPath,
        actualFileCreated: fileExists
      });

      // Log result for debugging
      if (fileExists) {
        logWithTimestamp(`✅ GIF created successfully: ${expectedOutputPath}`);
      } else {
        logWithTimestamp(`❌ GIF creation failed - file not found: ${expectedOutputPath}`, 'ERROR');
      }
    }

    processingCompleted = true;

    // Final progress update
    event.sender.send('processing-progress', {
      current: results.length,
      total: results.length,
      message: 'FFmpeg脚本执行完成！'
    });

    logWithTimestamp(`FFmpeg bookmark processing completed: ${results.length} GIFs generated`);

    return {
      success: true,
      message: `成功使用FFmpeg生成 ${results.length} 个GIF`,
      results: results
    };

  } catch (error) {
    processingCompleted = false;
    logWithTimestamp(`FFmpeg bookmark processing failed: ${error.message}`, 'ERROR');

    return {
      success: false,
      message: `FFmpeg书签处理失败: ${error.message}`
    };
  }
}

// Process bookmark-based GIF generation with enhanced memory management and async processing
async function processBookmarkGifs(event, pbfFilePath, bookmarks) {
  logWithTimestamp(`Starting bookmark-based GIF processing with ${bookmarks.length} bookmarks`);

  try {
    // Group bookmarks into pairs (start, end)
    const bookmarkPairs = [];
    for (let i = 0; i < bookmarks.length - 1; i += 2) {
      const startBookmark = bookmarks[i];
      const endBookmark = bookmarks[i + 1];

      // Calculate duration in seconds
      const duration = calculateDurationInSeconds(startBookmark.time, endBookmark.time);

      bookmarkPairs.push({
        start: startBookmark,
        end: endBookmark,
        duration: duration,
        pairIndex: Math.floor(i / 2) + 1
      });
    }

    if (bookmarkPairs.length === 0) {
      throw new Error('No valid bookmark pairs found. Need at least 2 bookmarks to create a GIF.');
    }

    logWithTimestamp(`Created ${bookmarkPairs.length} bookmark pairs for processing`);

    // Send progress update to renderer
    event.sender.send('processing-progress', {
      current: 0,
      total: bookmarkPairs.length,
      message: `准备处理 ${bookmarkPairs.length} 个GIF片段...`
    });

    // Process each bookmark pair
    const results = [];
    const scriptPath = 'D:\\makeGif.cmd';

    if (!fs.existsSync(scriptPath)) {
      throw new Error(`Script file does not exist: ${scriptPath}`);
    }

    for (let i = 0; i < bookmarkPairs.length; i++) {
      const pair = bookmarkPairs[i];

      try {
        logWithTimestamp(`Processing bookmark pair ${pair.pairIndex}: ${pair.start.time} -> ${pair.end.time} (${pair.duration}s)`);

        // Update progress
        event.sender.send('processing-progress', {
          current: i,
          total: bookmarkPairs.length,
          message: `正在处理第 ${pair.pairIndex} 个片段: ${pair.start.name || `片段 ${pair.pairIndex}`}`
        });

        // Find corresponding video file (assuming same name as PBF but with video extension)
        const videoFilePath = await findVideoFileForPBF(pbfFilePath);

        // Convert time format for script
        const scriptTime = convertTimeFormat(pair.start.time);

        // Generate output filename
        const outputFileName = generateBookmarkGifName(pair.start.name, pair.pairIndex, pair.start.time);
        const outputPath = `D:\\${outputFileName}`;

        // Execute script with memory management
        logWithTimestamp(`Executing GIF generation for pair ${pair.pairIndex}`);

        await executeScript(scriptPath, [videoFilePath, scriptTime, pair.duration.toString(), outputFileName], 'gif');

        // Force garbage collection between processes
        if (global.gc) {
          global.gc();
        }

        results.push({
          pairIndex: pair.pairIndex,
          startTime: pair.start.time,
          endTime: pair.end.time,
          duration: pair.duration,
          name: pair.start.name || `片段 ${pair.pairIndex}`,
          outputPath: outputPath,
          success: true
        });

        logWithTimestamp(`Successfully completed GIF generation for pair ${pair.pairIndex}`);

      } catch (error) {
        logWithTimestamp(`Failed to process bookmark pair ${pair.pairIndex}: ${error.message}`, 'ERROR');

        results.push({
          pairIndex: pair.pairIndex,
          startTime: pair.start.time,
          endTime: pair.end.time,
          duration: pair.duration,
          name: pair.start.name || `片段 ${pair.pairIndex}`,
          success: false,
          error: error.message
        });
      }

      // Small delay between processes to prevent system overload
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    processingCompleted = true;

    // Final progress update
    event.sender.send('processing-progress', {
      current: bookmarkPairs.length,
      total: bookmarkPairs.length,
      message: '处理完成！'
    });

    const successCount = results.filter(r => r.success).length;
    const failureCount = results.length - successCount;

    logWithTimestamp(`Bookmark processing completed: ${successCount} successful, ${failureCount} failed`);

    return {
      success: true,
      message: `成功生成 ${successCount} 个GIF${failureCount > 0 ? `，失败 ${failureCount} 个` : ''}`,
      results: results
    };

  } catch (error) {
    processingCompleted = false;
    logWithTimestamp(`Bookmark processing failed: ${error.message}`, 'ERROR');

    return {
      success: false,
      message: `书签处理失败: ${error.message}`
    };
  }
}

// Format time for filename: 小时-分钟-秒
function formatTimeForFilename(timeString) {
  const timeParts = timeString.split(':');
  if (timeParts.length !== 3) return timeString; // Fallback for unexpected format

  let hours = timeParts[0];
  let minutes = timeParts[1];
  let secondsAndMs = timeParts[2];

  // Remove leading zeros from hours, minutes, and seconds
  hours = hours.replace(/^0+/, '');
  minutes = minutes.replace(/^0+/, '');
  const seconds = secondsAndMs.split('.')[0].replace(/^0+/, '');

  // Format: 小时-分钟-秒 (remove ms)
  return `${hours}-${minutes}-${seconds}`;
}

// Calculate duration between two time strings in seconds
function calculateDurationInSeconds(startTime, endTime) {
  const parseTime = (timeStr) => {
    const parts = timeStr.split(':');
    const hours = parseInt(parts[0]) || 0;
    const minutes = parseInt(parts[1]) || 0;
    const secondsParts = parts[2].split('.');
    const seconds = parseInt(secondsParts[0]) || 0;
    const milliseconds = parseInt(secondsParts[1]) || 0;

    return hours * 3600 + minutes * 60 + seconds + milliseconds / 1000;
  };

  const startSeconds = parseTime(startTime);
  const endSeconds = parseTime(endTime);

  return Math.max(1, Math.round(endSeconds - startSeconds)); // Minimum 1 second
}

// Convert time format from HH:MM:SS.mmm to HH:MM:SS
function convertTimeFormat(timeStr) {
  const parts = timeStr.split(':');
  return `${parts[0]}:${parts[1]}:${parts[2].split('.')[0]}`;
}

// Generate output filename for bookmark GIF
function generateBookmarkGifName(bookmarkName, pairIndex, startTime) {
  const formattedStartTime = formatTimeForFilename(startTime);
  const safeName = bookmarkName ?
    bookmarkName.replace(/[^\w\u4e00-\u9fa5]/g, '_').substring(0, 20) :
    `bookmark_${pairIndex}`;
  return `${safeName}_${formattedStartTime}.gif`;
}

// Generate output filename for multiple PBF bookmark GIF with file prefix
function generateMultipleBookmarkGifName(fileName, bookmarkName, pairIndex, globalPairIndex, startTime) {
  const formattedStartTime = formatTimeForFilename(startTime);

  // Extract file base name without extension
  const fileBaseName = fileName.replace(/\.[^/.]+$/, '').replace(/[^\w\u4e00-\u9fa5]/g, '_').substring(0, 15);

  const safeBookmarkName = bookmarkName ?
    bookmarkName.replace(/[^\w\u4e00-\u9fa5]/g, '_').substring(0, 15) :
    `pair_${pairIndex}`;

  return `${fileBaseName}_${formattedStartTime}.gif`;
}

// Find corresponding video file for PBF file
async function findVideoFileForPBF(pbfFilePath) {
  const path = require('path');
  const fs = require('fs');

  const pbfDir = path.dirname(pbfFilePath);
  const pbfBaseName = path.basename(pbfFilePath, '.pbf');

  // Common video extensions to try
  const videoExtensions = ['mp4', 'avi', 'mov', 'mkv', 'wmv', 'flv', 'webm'];

  // Try same base name with different extensions
  for (const ext of videoExtensions) {
    const videoPath = path.join(pbfDir, `${pbfBaseName}.${ext}`);
    if (fs.existsSync(videoPath)) {
      logWithTimestamp(`Found corresponding video file: ${videoPath}`);
      return videoPath;
    }
  }

  // If no matching file found, ask user to select video file
  logWithTimestamp('No matching video file found, will prompt user to select');
  throw new Error('未找到对应的视频文件，请确保视频文件与PBF文件同名（扩展名不同）');
}

// Detect subtitles in video file
async function detectSubtitles(videoPath) {
  return new Promise((resolve, reject) => {
    const { exec } = require('child_process');
    const path = require('path');

    logWithTimestamp(`Detecting subtitles in: ${videoPath}`);

    // Use ffprobe to detect subtitle streams
    const settings = loadSettings();
    const defaultBinPaths = getBundledFFmpegBinPaths();
    const ffprobePath = quoteCommandPath(getFFmpegToolPath(settings, 'ffprobe', { defaultBinPaths }));
    const command = `${ffprobePath} -v error -select_streams s -show_entries stream=index,codec_name,codec_tag_string:stream_tags=language,title -of csv=p=0 "${videoPath}"`;

    exec(command, { encoding: 'utf8', env: getFFmpegToolEnvironment(settings, process.env, { defaultBinPaths }) }, (error, stdout, stderr) => {
      if (error) {
        // No subtitles is not an error, just return empty array
        if (stderr.includes('No such file')) {
          logWithTimestamp('Video file not found for subtitle detection');
          reject(new Error('视频文件不存在'));
        } else {
          logWithTimestamp('No subtitle streams found or other error');
          resolve([]); // Return empty array for no subtitles
        }
        return;
      }

      try {
        const subtitles = [];
        const lines = stdout.trim().split('\n');

        lines.forEach((line, index) => {
          if (line.trim()) {
            const parts = line.split(',');
            subtitles.push({
              index: index,
              codec_name: parts[1] || 'Unknown',
              codec_tag: parts[2] || '',
              language: parts[3] || 'Unknown',
              title: parts[4] || '无'
            });
          }
        });

        logWithTimestamp(`Found ${subtitles.length} subtitle streams`);
        resolve(subtitles);
      } catch (parseError) {
        logWithTimestamp(`Error parsing subtitle data: ${parseError.message}`);
        reject(new Error(`字幕数据解析失败: ${parseError.message}`));
      }
    });
  });
}

// Extract subtitle from video file
async function extractSubtitle(videoPath, streamIndex, language) {
  return new Promise((resolve, reject) => {
    const { exec } = require('child_process');
    const path = require('path');

    logWithTimestamp(`Extracting subtitle ${streamIndex} from: ${videoPath}`);

    // Generate output filename with video name and language
    const videoBaseName = path.basename(videoPath, path.extname(videoPath));
    const outputFileName = `${videoBaseName}_${language || 'subtitle'}_${streamIndex}.srt`;
    const outputPath = path.join('D:', outputFileName); // Output to D drive root

    const settings = loadSettings();
    const defaultBinPaths = getBundledFFmpegBinPaths();
    const ffmpegPath = quoteCommandPath(getFFmpegToolPath(settings, 'ffmpeg', { defaultBinPaths }));
    const command = `${ffmpegPath} -i "${videoPath}" -map 0:s:${streamIndex} -c:s srt "${outputPath}"`;

    exec(command, { encoding: 'utf8', env: getFFmpegToolEnvironment(settings, process.env, { defaultBinPaths }) }, (error, stdout, stderr) => {
      if (error) {
        logWithTimestamp(`Subtitle extraction failed: ${error.message}`);
        reject(new Error(`字幕提取失败: ${error.message}`));
        return;
      }

      // Check if output file was created
      const fs = require('fs');
      if (fs.existsSync(outputPath)) {
        logWithTimestamp(`Subtitle extracted successfully to: ${outputPath}`);
        resolve(outputPath);
      } else {
        logWithTimestamp('Subtitle extraction completed but output file not found');
        reject(new Error('字幕提取完成但输出文件未找到'));
      }
    });
  });
}

// Compress folder using 7Zip with 100MB volumes
async function compressWith7Zip(folderPath, event = null) {
  const path = require('path');
  const { spawn } = require('child_process');

  return new Promise((resolve, reject) => {
    try {
      logWithTimestamp(`Starting 7Zip compression for folder: ${folderPath}`);

      // Generate output archive name based on folder name
      const folderName = path.basename(folderPath);
      const outputArchive = path.join('D:\\', `${folderName}.7z`);

      // 7Zip command with compression and volume settings
      // -mx9: maximum compression
      // -v100m: split into 100MB volumes
      // -t7z: use 7z format
      const args = [
        'a',                    // add to archive
        '-mx9',                 // maximum compression level
        '-v100m',               // create 100MB volumes
        '-t7z',                 // use 7z format
        outputArchive,          // output archive path
        folderPath + '\\*'      // folder contents (using * to avoid including the folder itself)
      ];

      logWithTimestamp(`Executing 7z command: 7z ${args.join(' ')}`);

      const process = spawn('7z', args, {
        cwd: 'D:\\',
        stdio: ['pipe', 'pipe', 'pipe'],
        shell: true
      });

      let output = '';
      let errorOutput = '';

      process.stdout.on('data', (data) => {
        const text = data.toString();
        output += text;
        logWithTimestamp(`7Zip stdout: ${text.trim()}`);

        // Send progress updates to renderer
        if (event && text.includes('%')) {
          try {
            const progressMatch = text.match(/(\d+)%/);
            if (progressMatch) {
              const progress = parseInt(progressMatch[1]);
              event.sender.send('processing-progress', {
                current: progress,
                total: 100,
                message: `压缩进度: ${progress}%`
              });
            }
          } catch (e) {
            // Ignore progress parsing errors
          }
        }
      });

      process.stderr.on('data', (data) => {
        const text = data.toString();
        errorOutput += text;
        logWithTimestamp(`7Zip stderr: ${text.trim()}`);
      });

      process.on('close', (code) => {
        if (code === 0) {
          logWithTimestamp(`7Zip compression completed successfully`);
          logWithTimestamp(`Output archive: ${outputArchive}`);

          // Check if volume files were created
          const fs = require('fs');
          const volumePattern = outputArchive.replace('.7z', '.7z.001');
          const volumeExists = fs.existsSync(volumePattern) || fs.existsSync(outputArchive);

          if (volumeExists) {
            resolve({
              success: true,
              outputPath: outputArchive,
              volumes: fs.existsSync(volumePattern) ? 'split into volumes' : 'single file',
              message: `文件夹压缩成功: ${folderName}`
            });
          } else {
            reject(new Error('7Zip completed but no output files found'));
          }
        } else {
          logWithTimestamp(`7Zip failed with exit code: ${code}`, 'ERROR');
          logWithTimestamp(`Error output: ${errorOutput}`, 'ERROR');
          reject(new Error(`7Zip压缩失败，退出代码: ${code}\n${errorOutput}`));
        }
      });

      process.on('error', (error) => {
        logWithTimestamp(`7Zip process error: ${error.message}`, 'ERROR');
        reject(new Error(`7Zip进程错误: ${error.message}\n请确保7z命令行工具已正确安装并添加到系统PATH环境变量中`));
      });

      // Set timeout for 7Zip process (30 minutes)
      const timeout = setTimeout(() => {
        if (!process.killed) {
          process.kill();
          reject(new Error('7Zip压缩超时，请检查文件夹大小或减少压缩级别'));
        }
      }, 30 * 60 * 1000); // 30 minutes

      process.on('close', () => {
        clearTimeout(timeout);
      });

    } catch (error) {
      logWithTimestamp(`7Zip compression setup error: ${error.message}`, 'ERROR');
      reject(new Error(`7Zip压缩设置错误: ${error.message}`));
    }
  });
}

// Process file prefixes (add or remove)
async function processFilePrefixes(folderPath, operation, prefix, event = null) {
  const path = require('path');
  const fs = require('fs');

  return new Promise((resolve, reject) => {
    try {
      logWithTimestamp(`Starting ${operation} prefix operation for folder: ${folderPath}`);
      logWithTimestamp(`Prefix to ${operation}: "${prefix}"`);

      if (!fs.existsSync(folderPath)) {
        throw new Error(`文件夹不存在: ${folderPath}`);
      }

      // Read all files in the directory (exclude directories)
      const files = fs.readdirSync(folderPath);
      const fileItems = files.filter(file => {
        const filePath = path.join(folderPath, file);
        return fs.statSync(filePath).isFile(); // Only process files, not directories
      });

      logWithTimestamp(`Found ${fileItems.length} files to process`);

      if (fileItems.length === 0) {
        resolve({
          success: true,
          message: '文件夹中没有找到文件',
          processedFiles: [],
          skippedFiles: []
        });
        return;
      }

      let processedFiles = [];
      let skippedFiles = [];

      fileItems.forEach((file, index) => {
        const oldFilePath = path.join(folderPath, file);

        try {
          let newFileName;

          if (operation === 'add') {
            // Add prefix if not already present
            if (!file.startsWith(prefix)) {
              newFileName = prefix + file;
            } else {
              // File already has the prefix
              skippedFiles.push({
                fileName: file,
                reason: '文件已有此前缀'
              });
              return;
            }
          } else {
            // Remove prefix if present
            if (file.startsWith(prefix)) {
              newFileName = file.substring(prefix.length);
            } else {
              // File doesn't have the prefix
              skippedFiles.push({
                fileName: file,
                reason: '文件没有此前缀'
              });
              return;
            }
          }

          // Ensure new filename is not empty
          if (!newFileName || newFileName.trim() === '') {
            skippedFiles.push({
              fileName: file,
              reason: '新文件名为空'
            });
            return;
          }

          const newFilePath = path.join(folderPath, newFileName);

          // Check if target file already exists
          if (fs.existsSync(newFilePath) && newFilePath !== oldFilePath) {
            skippedFiles.push({
              fileName: file,
              reason: '目标文件已存在'
            });
            return;
          }

          // Rename the file
          if (newFilePath !== oldFilePath) {
            fs.renameSync(oldFilePath, newFilePath);
            processedFiles.push({
              oldName: file,
              newName: newFileName,
              operation: operation
            });
            logWithTimestamp(`Renamed: ${file} -> ${newFileName}`);
          } else {
            skippedFiles.push({
              fileName: file,
              reason: '文件名无需更改'
            });
          }

        } catch (error) {
          logWithTimestamp(`Error processing file ${file}: ${error.message}`, 'ERROR');
          skippedFiles.push({
            fileName: file,
            reason: `处理失败: ${error.message}`
          });
        }

        // Send progress update
        if (event && index % 10 === 0) { // Update progress every 10 files
          const progress = Math.round(((index + 1) / fileItems.length) * 100);
          event.sender.send('processing-progress', {
            current: progress,
            total: 100,
            message: `处理文件: ${index + 1}/${fileItems.length} - ${file}`
          });
        }
      });

      logWithTimestamp(`${operation} prefix operation completed`);
      logWithTimestamp(`Processed: ${processedFiles.length} files`);
      logWithTimestamp(`Skipped: ${skippedFiles.length} files`);

      resolve({
        success: true,
        message: `成功${operation === 'add' ? '添加' : '删除'}前缀 ${processedFiles.length} 个文件，跳过 ${skippedFiles.length} 个文件`,
        processedFiles: processedFiles,
        skippedFiles: skippedFiles
      });

    } catch (error) {
      logWithTimestamp(`Prefix operation failed: ${error.message}`, 'ERROR');
      reject(new Error(`前缀操作失败: ${error.message}`));
    }
  });
}

// Handle video processing request with prefix parameter
ipcMain.handle('process-video-with-prefix', async (event, { filePath, format, startTime, duration, bookmarks, pbfFiles, allBookmarks }, prefix) => {
  processingCompleted = false;
  processCount++;

  // Enhanced memory logging
  const memoryUsage = process.memoryUsage();
  logWithTimestamp(`Process #${processCount} - Memory: RSS=${Math.round(memoryUsage.rss / 1024 / 1024)}MB, Heap=${Math.round(memoryUsage.heapUsed / 1024 / 1024)}MB, External=${Math.round(memoryUsage.external / 1024 / 1024)}MB`);

  // Check if this is prefix operations
  if (format === 'add-prefix' || format === 'remove-prefix') {
    logWithTimestamp(`Starting ${format === 'add-prefix' ? 'add' : 'remove'} prefix operation`);

    try {
      const prefixToUse = prefix || '';
      if (!prefixToUse) {
        throw new Error('前缀不能为空');
      }

      const result = await processFilePrefixes(filePath, format === 'add-prefix' ? 'add' : 'remove', prefixToUse, event);

      if (result.success) {
        processingCompleted = true;
        logWithTimestamp(`${format === 'add-prefix' ? 'Add' : 'Remove'} prefix operation completed successfully`);

        return {
          success: true,
          message: result.message,
          processedFiles: result.processedFiles,
          skippedFiles: result.skippedFiles
        };
      } else {
        throw new Error(result.error || `${format === 'add-prefix' ? 'Add' : 'Remove'} prefix operation failed`);
      }
    } catch (error) {
      logWithTimestamp(`${format === 'add-prefix' ? 'Add' : 'Remove'} prefix operation failed: ${error.message}`, 'ERROR');
      throw error;
    }
  }

  // For other formats, fall back to normal processing
  return await ipcMain.handle('process-video', event, { filePath, format, startTime, duration, bookmarks, pbfFiles, allBookmarks, prefix });
});
