const { app, BrowserWindow, ipcMain, Menu } = require("electron");
const path = require("path");
const { executeProxyRequest } = require("./proxy-core");
const { readHistory, appendHistory, clearHistory } = require("./history-store");

let mainWindow = null;
let historyWindow = null;

function broadcastHistoryUpdated() {
  BrowserWindow.getAllWindows().forEach((w) => {
    if (!w.isDestroyed()) w.webContents.send("history:updated");
  });
}

ipcMain.handle("http:proxy", async (_event, payload) => {
  return executeProxyRequest(payload);
});

ipcMain.handle("history:get", () => readHistory(app));

ipcMain.handle("history:append", (_event, entry) => {
  const list = appendHistory(app, entry);
  broadcastHistoryUpdated();
  return list;
});

ipcMain.handle("history:clear", () => {
  clearHistory(app);
  broadcastHistoryUpdated();
  return [];
});

function openHistoryWindow() {
  if (historyWindow && !historyWindow.isDestroyed()) {
    historyWindow.focus();
    return;
  }
  historyWindow = new BrowserWindow({
    width: 960,
    height: 720,
    minWidth: 520,
    minHeight: 400,
    show: false,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
    },
  });
  historyWindow.once("ready-to-show", () => historyWindow.show());
  historyWindow.loadFile(path.join(__dirname, "public", "history-window.html"));
  historyWindow.on("closed", () => {
    historyWindow = null;
  });
}

function createApplicationMenu() {
  const isMac = process.platform === "darwin";
  const template = [
    ...(isMac
      ? [
          {
            label: app.name,
            submenu: [
              { role: "about" },
              { type: "separator" },
              { role: "services" },
              { type: "separator" },
              { role: "hide" },
              { role: "hideOthers" },
              { role: "unhide" },
              { type: "separator" },
              { role: "quit" },
            ],
          },
        ]
      : []),
    {
      label: "File",
      submenu: [
        {
          label: "View request history…",
          accelerator: "CmdOrCtrl+Shift+H",
          click: () => openHistoryWindow(),
        },
        { type: "separator" },
        {
          label: "Close window",
          accelerator: "CmdOrCtrl+W",
          click: () => {
            const w = BrowserWindow.getFocusedWindow();
            if (w && !w.isDestroyed()) w.close();
          },
        },
        ...(!isMac
          ? [
              { type: "separator" },
              { role: "quit", label: "Exit" },
            ]
          : []),
      ],
    },
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

async function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1100,
    height: 820,
    minWidth: 720,
    minHeight: 520,
    show: false,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
    },
  });

  mainWindow.once("ready-to-show", () => {
    mainWindow.show();
    mainWindow.maximize();
  });

  mainWindow.webContents.setWindowOpenHandler(() => ({
    action: "allow",
    overrideBrowserWindowOptions: {
      width: 1100,
      height: 800,
      minWidth: 720,
      minHeight: 480,
      webPreferences: {
        preload: path.join(__dirname, "preload.js"),
        nodeIntegration: false,
        contextIsolation: true,
        sandbox: true,
      },
    },
  }));

  await mainWindow.loadFile(path.join(__dirname, "public", "index.html"));

  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}

app.whenReady().then(() => {
  createApplicationMenu();
  createWindow().catch((err) => {
    console.error(err);
    app.quit();
  });
});

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow().catch((err) => {
      console.error(err);
      app.quit();
    });
  }
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});
