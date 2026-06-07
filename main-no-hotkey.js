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

// Data persistence
const userDataPath = app.getPath('userData');
const settingsPath = path.join(userDataPath, 'settings.json');
const windowStatePath = path.join(userDataPath, 'window-state.json');
const DEFAULT_SELECTION_PATHS = {
  default: 'D:\\',
  gif: 'D:\\',
  video: 'D:\\'
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
    const settingsToSave = mergeSettingsForSave(loadSettings(), settings);

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
    width: 600,
    height: 500,
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
    width: windowState.width || 600,
    height: windowState.height || 600, // Increased height to show all content
    x: windowState.x,
    y: windowState.y,
    minWidth: 550,
    minHeight: 550, // Increased minimum height
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js')
    },
    resizable: true,
    alwaysOnTop: false,
    icon: path.join(__dirname, 'icon.ico')
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
              message: 'Video Processing Tool',
              detail: 'A tool for extracting video segments and creating GIFs.'
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
ipcMain.handle('select-file', async (event, format = 'video') => {
  const result = await dialog.showOpenDialog(mainWindow, {
    title: '选择视频文件',
    defaultPath: getSelectionDefaultPath(format),
    filters: [
      { name: '视频文件', extensions: ['mp4', 'avi', 'mov', 'mkv', 'wmv', 'flv', 'webm'] },
      { name: '所有文件', extensions: ['*'] }
    ],
    properties: ['openFile']
  });

  if (!result.canceled && result.filePaths.length > 0) {
    rememberSelectionPath(format, result.filePaths);
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
ipcMain.handle('process-video', async (event, { filePath, format, startTime, duration }) => {
  processingCompleted = false;
  processCount++;

  // Enhanced memory logging
  const memoryUsage = process.memoryUsage();
  logWithTimestamp(`Process #${processCount} - Memory: RSS=${Math.round(memoryUsage.rss / 1024 / 1024)}MB, Heap=${Math.round(memoryUsage.heapUsed / 1024 / 1024)}MB, External=${Math.round(memoryUsage.external / 1024 / 1024)}MB`);

  logWithTimestamp(`Starting video processing: ${filePath}, format: ${format}, start: ${startTime}, duration: ${duration}`);

  try {
    // Verify file exists
    if (!fs.existsSync(filePath)) {
      throw new Error(`File does not exist: ${filePath}`);
    }

    // Determine script path - use fixed D drive root directory path
    const scriptName = format === 'gif' ? 'makeGif.cmd' : 'extractVideo.cmd';
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
