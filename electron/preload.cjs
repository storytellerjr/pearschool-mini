const { contextBridge, ipcRenderer, webUtils } = require('electron')

contextBridge.exposeInMainWorld('pear', {
  version: ipcRenderer.sendSync('get-version'),
  send: (msg) => ipcRenderer.send('to-worker', msg),
  on: (cb) => ipcRenderer.on('from-worker', (_, data) => cb(data)),
  onPearEvent: (cb) => ipcRenderer.on('pear-event', (_, event) => cb(event)),
  getPathForFile: (file) => webUtils.getPathForFile(file)
})
