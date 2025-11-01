const { contextBridge, ipcRenderer } = require('electron');

// 暴露安全的API给渲染进程
contextBridge.exposeInMainWorld('electronAPI', {
  selectFile: (format) => ipcRenderer.invoke('select-file', format),
  processVideo: (data) => ipcRenderer.invoke('process-video', data),
  parsePBFBookmarks: (pbfFilePath) => ipcRenderer.invoke('parse-pbf-bookmarks', pbfFilePath),
  onProgressUpdate: (callback) => ipcRenderer.on('progress-update', callback),
  onProcessingProgress: (callback) => ipcRenderer.on('processing-progress', callback),
  removeProgressListener: () => ipcRenderer.removeAllListeners('progress-update'),
  removeProcessingProgressListener: () => ipcRenderer.removeAllListeners('processing-progress'),
  saveSettings: (settings) => ipcRenderer.invoke('save-settings', settings),
  loadSettings: () => ipcRenderer.invoke('load-settings'),
  onPotPlayerTimeUpdate: (callback) => ipcRenderer.on('potplayer-time-update', callback)
});