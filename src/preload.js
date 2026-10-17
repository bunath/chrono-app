const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  // Plein écran
  toggleFullscreen:   ()            => ipcRenderer.invoke('fullscreen-toggle'),
  // Double écran
  getDisplays:        ()            => ipcRenderer.invoke('get-displays'),
  moveToSecondScreen: ()            => ipcRenderer.invoke('move-to-second-screen'),
  restorePrimary:     ()            => ipcRenderer.invoke('restore-primary-screen'),
  // DB
  dbGetPresets:       ()            => ipcRenderer.invoke('db-get-presets'),
  dbSavePreset:       (name, secs)  => ipcRenderer.invoke('db-save-preset', name, secs),
  dbDeletePreset:     (id)          => ipcRenderer.invoke('db-delete-preset', id),
  dbGetSetting:       (key)         => ipcRenderer.invoke('db-get-setting', key),
  dbSetSetting:       (key, val)    => ipcRenderer.invoke('db-set-setting', key, val),
  // Musique
  pickMusicFile:      ()            => ipcRenderer.invoke('pick-music-file'),
  // MAJ (ouvre la fenêtre dédiée)
  checkForUpdates:    ()            => ipcRenderer.invoke('check-for-updates'),
  // Événements main → renderer
  onAppEvent: (cb) => ipcRenderer.on('app-event', (_e, data) => cb(data)),
});
