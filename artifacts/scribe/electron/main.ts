import { app, BrowserWindow, shell, ipcMain, dialog } from "electron";
import path from "path";
import { fileURLToPath } from "url";
import { createServer } from "./server.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

let mainWindow: BrowserWindow | null = null;
let serverPort: number | null = null;

function createWindow(port: number) {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    titleBarStyle: "hiddenInset",
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
    },
    backgroundColor: "#1a1512",
    title: "Scribe",
  });

  const isDev = !app.isPackaged;

  if (isDev) {
    mainWindow.loadURL(`http://localhost:5173`);
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, "../dist/public/index.html"));
  }

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: "deny" };
  });

  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}

async function startApp() {
  const port = await createServer();
  serverPort = port;

  app.whenReady().then(() => {
    createWindow(port);
    app.on("activate", () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow(port);
    });
  });
}

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

ipcMain.handle("get-server-port", () => serverPort);

ipcMain.handle("show-save-dialog", async (_event, opts: { defaultPath?: string; filters?: { name: string; extensions: string[] }[] }) => {
  if (!mainWindow) return null;
  const result = await dialog.showSaveDialog(mainWindow, {
    defaultPath: opts.defaultPath,
    filters: opts.filters ?? [{ name: "Text Files", extensions: ["txt"] }],
  });
  return result.canceled ? null : result.filePath;
});

startApp().catch(console.error);
