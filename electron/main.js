import { app, BrowserWindow, ipcMain } from 'electron'
import path from 'path'
import { fileURLToPath } from 'url'
import PearRuntime from 'pear-runtime'
import { createRequire } from 'module'

const require = createRequire(import.meta.url)
const pkg = require('../package.json')
const __dirname = path.dirname(fileURLToPath(import.meta.url))

let win, ipc

async function createWindow () {
  const pear = new PearRuntime({
    dir: path.join(app.getPath('userData'), 'pear'),
    version: pkg.version,
    upgrade: pkg.upgrade,
    name: pkg.productName
  })

  pear.updater.on('updating', () => win?.webContents.send('pear-event', { type: 'updating' }))
  pear.updater.on('updated', () => pear.updater.applyUpdate())

  ipc = pear.run(path.join(__dirname, '../workers/main.js'), [pear.storage])

  win = new BrowserWindow({
    width: 1000,
    height: 500,
    minWidth: 500,
    backgroundColor: '#1F2430',
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false
    }
  })

  win.loadFile('index.html')

  // Dev only: auto-open DevTools and forward renderer console / crashes to forge stdout
  if (!app.isPackaged) {
    win.webContents.openDevTools({ mode: 'detach' })
    win.webContents.on('console-message', (_e, level, message, line, sourceId) => {
      console.log(`[renderer:${level}] ${sourceId}:${line} ${message}`)
    })
    win.webContents.on('render-process-gone', (_e, details) => {
      console.error('[renderer crashed]', details)
    })
  }

  // Worker → Renderer (raw bytes — HRPC framed-stream is binary)
  ipc.on('data', (data) => win?.webContents.send('from-worker', data))

  // Renderer → Worker
  ipcMain.on('to-worker', (_, msg) => ipc.write(msg))

  win.on('closed', async () => { await pear.close(); win = null })
}

app.whenReady().then(createWindow)
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit() })
app.on('activate', () => { if (!win) createWindow() })
