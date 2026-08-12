const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('desktop', {
  isDesktop: true,
  platform: process.platform,
  saveFile: (name, bytes) => ipcRenderer.invoke('save-file', { name, bytes }),
  openProject: () => ipcRenderer.invoke('open-project'),
  onMenu: (handler) => {
    const channels = ['menu:new','menu:open','menu:save','menu:export','menu:undo','menu:redo','menu:dupe','menu:delete'];
    channels.forEach((ch) => ipcRenderer.on(ch, () => handler(ch)));
  },
});
