const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('updateAPI', {
  startDownload:  (exeUrl, version) => ipcRenderer.invoke('update:startDownload', exeUrl, version),
  onProgress:     (cb)              => ipcRenderer.on('update:progress', (_, data) => cb(data)),
  launchInstaller:()                => ipcRenderer.invoke('update:launchInstaller'),
  cancelInstall:  ()                => ipcRenderer.invoke('update:cancelInstall'),
  openRelease:    (url)             => ipcRenderer.invoke('update:openRelease', url),
});
