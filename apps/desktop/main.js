const { app, BrowserWindow, shell, nativeTheme } = require('electron');
const path = require('path');

// Force dark mode
nativeTheme.themeSource = 'dark';

let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1000,
    height: 700,
    minWidth: 480,
    minHeight: 500,
    backgroundColor: '#212121',
    titleBarStyle: 'hiddenInset', // macOS: traffic lights embedded
    trafficLightPosition: { x: 12, y: 12 },
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
    },
    show: false, // Show after ready to avoid white flash
  });

  // Load the built web app — bundled inside the app
  const webDistPath = path.join(__dirname, 'web-dist', 'index.html');
  mainWindow.loadFile(webDistPath);

  // Show when ready — no white flash
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

app.whenReady().then(createWindow);

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
