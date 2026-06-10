const { contextBridge, ipcRenderer } = require('electron');

// 暴露安全的API给渲染进程
contextBridge.exposeInMainWorld('electronAPI', {
  selectFile: (format) => ipcRenderer.invoke('select-file', format),
  selectFFmpegPath: () => ipcRenderer.invoke('select-ffmpeg-path'),
  processVideo: (data) => ipcRenderer.invoke('process-video', data),
  processVideoWithPrefix: (data, prefix) => ipcRenderer.invoke('process-video-with-prefix', data, prefix),
  parsePBFBookmarks: (pbfFilePath) => ipcRenderer.invoke('parse-pbf-bookmarks', pbfFilePath),
  onProgressUpdate: (callback) => ipcRenderer.on('progress-update', callback),
  onProcessingProgress: (callback) => ipcRenderer.on('processing-progress', callback),
  removeProgressListener: () => ipcRenderer.removeAllListeners('progress-update'),
  removeProcessingProgressListener: () => ipcRenderer.removeAllListeners('processing-progress'),
  saveSettings: (settings) => ipcRenderer.invoke('save-settings', settings),
  loadSettings: () => ipcRenderer.invoke('load-settings'),
  installPotPlayerExtension: () => ipcRenderer.invoke('install-potplayer-extension'),
  installPotPlayerExtensionElevated: () => ipcRenderer.invoke('install-potplayer-extension-elevated'),
  openPotPlayerExtensionFolder: () => ipcRenderer.invoke('open-potplayer-extension-folder'),
  loadLastPluginRun: () => ipcRenderer.invoke('load-last-plugin-run'),
  onPotPlayerTimeUpdate: (callback) => ipcRenderer.on('potplayer-time-update', callback)
});
