const { app, BrowserWindow } = require("electron")

let win

function createWindow() {
  win = new BrowserWindow({
    width: 420,
    height: 720,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    webPreferences: {
      nodeIntegration: false
    }
  })

  win.loadURL("http://localhost:3000")
}

app.whenReady().then(createWindow)
