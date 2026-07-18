import { app, BrowserWindow, ipcMain, dialog } from 'electron';
import * as path from 'path';
import { handleEnvWrite, handleEnvSelectDirectory, getSystemInfo } from './handlers';

const isDev = !app.isPackaged;

let mainWindow: BrowserWindow | null = null;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  if (isDev) {
    mainWindow.loadURL('http://localhost:5173');
  } else {
    mainWindow.loadFile(path.join(__dirname, '../../frontend/dist/index.html'));
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

ipcMain.handle('env:write', (_event, args) => handleEnvWrite(args));
ipcMain.handle('env:selectDirectory', () => handleEnvSelectDirectory(dialog as Parameters<typeof handleEnvSelectDirectory>[0]));
ipcMain.handle('system:info', () => getSystemInfo());

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});
