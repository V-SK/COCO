const { app, BrowserWindow, shell, nativeTheme, protocol, net } = require('electron');
const path = require('path');
const fs = require('fs');

// Force dark mode
nativeTheme.themeSource = 'dark';

let mainWindow;

function createWindow() {
  const webDistPath = path.join(__dirname, 'web-dist');

  mainWindow = new BrowserWindow({
    width: 1000,
    height: 700,
    minWidth: 480,
    minHeight: 500,
    backgroundColor: '#212121',
    titleBarStyle: 'hiddenInset',
    trafficLightPosition: { x: 12, y: 12 },
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
    },
    show: false,
  });

  // Load the built web app
  mainWindow.loadFile(path.join(webDistPath, 'index.html'));

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  // Open external links in system browser
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.whenReady().then(() => {
  // Intercept file:// requests to fix asset loading from asar
  protocol.interceptFileProtocol('file', (request, callback) => {
    let filePath = decodeURIComponent(request.url.replace('file://', ''));

    // On Windows, remove leading slash from /C:/...
    if (process.platform === 'win32' && filePath.startsWith('/')) {
      filePath = filePath.substring(1);
    }

    // Try the original path first
    if (fs.existsSync(filePath)) {
      callback({ path: filePath });
      return;
    }

    // If file is inside .asar and not found, try the unpacked or web-dist path
    const webDistPath = path.join(__dirname, 'web-dist');
    const basename = path.basename(filePath);

    // Try finding the file in web-dist root (for images like coco-welcome.jpg)
    const webDistFile = path.join(webDistPath, basename);
    if (fs.existsSync(webDistFile)) {
      callback({ path: webDistFile });
      return;
    }

    // Try assets subfolder
    const assetsFile = path.join(webDistPath, 'assets', basename);
    if (fs.existsSync(assetsFile)) {
      callback({ path: assetsFile });
      return;
    }

    // Fallback: return original path (will 404 naturally)
    callback({ path: filePath });
  });

  createWindow();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (mainWindow === null) {
    createWindow();
  }
});
