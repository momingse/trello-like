import {
  app,
  shell,
  BrowserWindow,
  BrowserViewConstructorOptions as WindowOptions,
  ipcMain
} from 'electron'
import { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import icon from '../../resources/icon.png?asset'
import { createFileRoute, createURLRoute } from 'electron-router-dom'
import TrayGenerator from './TrayGenerator'
import Store from 'electron-store'
// import { getAutoLaunchState, updateAutoLaunch } from './AutoLaunch'

function createWindow(id: string, option: WindowOptions = {}): void {
  // Create the browser window.
  const mainWindow = new BrowserWindow({
    width: 900,
    height: 670,
    show: false,
    autoHideMenuBar: true,
    ...(process.platform === 'linux' ? { icon } : {}),
    ...option
  })

  const devServerURL = createURLRoute(process.env['ELECTRON_RENDERER_URL']!, id)

  const fileRoute = createFileRoute(join(__dirname, '../renderer/index.html'), id)

  mainWindow.on('ready-to-show', () => {
    mainWindow.show()
  })

  mainWindow.on('close', (e) => {
    e.preventDefault()
    mainWindow.hide()
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  // HMR for renderer base on electron-vite cli.
  // Load the remote URL for development or the local html file for production.
  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(devServerURL)
  } else {
    mainWindow.loadFile(...fileRoute)
  }

  if (is.dev) {
    mainWindow.webContents.openDevTools()
  }
}

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.whenReady().then(async () => {
  // Set app user model id for windows
  electronApp.setAppUserModelId('com.electron')

  // Default open or close DevTools by F12 in development
  // and ignore CommandOrControl + R in production.
  // see https://github.com/alex8088/electron-toolkit/tree/master/packages/utils
  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  // await updateAutoLaunch(await getAutoLaunchState())
  createWindow('main', {
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false
    }
  })

  // app.on('activate', function () {
  //   // On macOS it's common to re-create a window in the app when the
  //   // dock icon is clicked and there are no other windows open.
  //   if (BrowserWindow.getAllWindows().length === 0)
  //     createWindow('main', {
  //       webPreferences: {
  //         preload: join(__dirname, '../preload/index.js'),
  //         sandbox: false
  //       }
  //     })
  // })

  const scheme = {
    launchAtLogin: false
  }

  const store = new Store<Record<string, unknown>>({ defaults: scheme })

  const Tray = new TrayGenerator(BrowserWindow.getAllWindows()[0], store)
  Tray.createTray()

  app.setLoginItemSettings({
    openAtLogin: store.get('launchAtLogin') as boolean
  })

  app.on('before-quit', function () {
    Tray.destroy()
  })

  // In this file you can include the rest of your app"s specific main process
  // code. You can also put them in separate files and require them here.
  ipcMain.on('set-launch-at-login', (event, value) => {
    if (process.platform === 'linux') {
      event.returnValue = false
      return
    }

    store.set('launchAtLogin', value)
    Tray!.updateMenu()
    event.returnValue = true
  })

  ipcMain.on('get-launch-at-login', (event) => {
    event.returnValue = store.get('launchAtLogin')
  })
})

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})
