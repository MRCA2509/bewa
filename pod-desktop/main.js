const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const server = require('./server'); // Import express server

let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 900,
    height: 700,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    },
    title: 'BEWA POD Koordinator Server',
    autoHideMenuBar: true
  });

  mainWindow.loadFile(path.join(__dirname, 'desktop', 'index.html'));

  // Start the server when window is created
  server.startServer((port, localIp) => {
    app.cachedServerInfo = { port, localIp };
    mainWindow.webContents.send('server-status', { port, localIp, status: 'running' });
  });

  ipcMain.on('request-server-status', (event) => {
    if (app.cachedServerInfo) {
      event.reply('server-status', { ...app.cachedServerInfo, status: 'running' });
    }
  });

  mainWindow.on('closed', function () {
    mainWindow = null;
  });
}

app.whenReady().then(createWindow);

app.on('window-all-closed', function () {
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', function () {
  if (mainWindow === null) createWindow();
});
