const { app, BrowserWindow, Menu, dialog, ipcMain, shell } = require('electron');
const path = require('path');
const fs = require('fs');

if (process.platform === 'win32') {
  app.setAppUserModelId('com.aisac.cutterstudio');
}

let mainWindow = null;
let currentProjectPath = null;

function iconPath() {
  const p = path.join(__dirname, '..', 'build', 'icon.png');
  return fs.existsSync(p) ? p : undefined;
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1024,
    minHeight: 700,
    show: false,
    backgroundColor: '#0c0c10',
    icon: iconPath(),
    title: 'CutterStudio Pro',
    autoHideMenuBar: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      spellcheck: false,
      backgroundThrottling: false,
    },
  });

  mainWindow.loadFile(path.join(__dirname, '..', 'app', 'index.html'));
  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
    mainWindow.focus();
  });
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });
  buildMenu();
}

function buildMenu() {
  const isMac = process.platform === 'darwin';
  const template = [
    ...(isMac ? [{ role: 'appMenu' }] : []),
    {
      label: 'File',
      submenu: [
        { label: 'New', accelerator: 'CmdOrCtrl+N', click: () => send('menu:new') },
        { label: 'Open Project…', accelerator: 'CmdOrCtrl+O', click: () => send('menu:open') },
        { label: 'Save Project', accelerator: 'CmdOrCtrl+Shift+S', click: () => send('menu:save') },
        { type: 'separator' },
        { label: 'Export Cut File…', accelerator: 'CmdOrCtrl+S', click: () => send('menu:export') },
        { type: 'separator' },
        isMac ? { role: 'close' } : { role: 'quit' },
      ],
    },
    {
      label: 'Edit',
      submenu: [
        { label: 'Undo', accelerator: 'CmdOrCtrl+Z', click: () => send('menu:undo') },
        { label: 'Redo', accelerator: 'CmdOrCtrl+Y', click: () => send('menu:redo') },
        { type: 'separator' },
        { role: 'cut' }, { role: 'copy' }, { role: 'paste' },
        { type: 'separator' },
        { label: 'Duplicate', accelerator: 'CmdOrCtrl+D', click: () => send('menu:dupe') },
        { label: 'Delete', accelerator: 'Delete', click: () => send('menu:delete') },
      ],
    },
    {
      label: 'View',
      submenu: [
        { role: 'reload' },
        { role: 'toggleDevTools' },
        { type: 'separator' },
        { role: 'resetZoom' },
        { role: 'zoomIn' },
        { role: 'zoomOut' },
        { type: 'separator' },
        { role: 'togglefullscreen' },
      ],
    },
    {
      label: 'Help',
      submenu: [
        {
          label: 'About CutterStudio Pro',
          click: () => {
            dialog.showMessageBox(mainWindow, {
              type: 'info',
              title: 'CutterStudio Pro',
              message: 'CutterStudio Pro — aisac',
              detail: 'Vinyl cutter / plotter studio for Windows and Linux.\nExport: Cut-SVG, DXF (mm), HPGL/PLT, PNG.',
            });
          },
        },
      ],
    },
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

function send(channel) {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send(channel);
  }
}

function filtersFor(name) {
  const ext = path.extname(name || '').replace('.', '').toLowerCase();
  const map = {
    json: [{ name: 'CutterStudio Project', extensions: ['json'] }],
    svg: [{ name: 'SVG', extensions: ['svg'] }],
    png: [{ name: 'PNG image', extensions: ['png'] }],
    dxf: [{ name: 'DXF (CAD / cutter)', extensions: ['dxf'] }],
    plt: [{ name: 'HPGL plot', extensions: ['plt', 'hpgl'] }],
    hpgl: [{ name: 'HPGL plot', extensions: ['plt', 'hpgl'] }],
  };
  return map[ext] || [{ name: 'All files', extensions: ['*'] }];
}

ipcMain.handle('save-file', async (_evt, { name, b64, bytes }) => {
  const { canceled, filePath } = await dialog.showSaveDialog(mainWindow, {
    defaultPath: name || 'export.bin',
    filters: filtersFor(name),
  });
  if (canceled || !filePath) return { ok: false };
  const buf = b64 != null ? Buffer.from(b64, 'base64') : Buffer.from(bytes || []);
  fs.writeFileSync(filePath, buf);
  if ((name || '').endsWith('.json')) currentProjectPath = filePath;
  return { ok: true, filePath };
});

ipcMain.handle('open-project', async () => {
  const { canceled, filePaths } = await dialog.showOpenDialog(mainWindow, {
    filters: [{ name: 'CutterStudio Project', extensions: ['json'] }],
    properties: ['openFile'],
    defaultPath: currentProjectPath || undefined,
  });
  if (canceled || !filePaths[0]) return null;
  currentProjectPath = filePaths[0];
  return fs.readFileSync(filePaths[0], 'utf8');
});

app.whenReady().then(createWindow);
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});
