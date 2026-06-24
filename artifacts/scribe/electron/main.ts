import { app, BrowserWindow, shell, ipcMain, dialog, session } from "electron";
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
      // Allow SharedArrayBuffer — required by ONNX Runtime WASM (Whisper)
      // The Express server sets COOP/COEP headers so Chromium enables it.
      sandbox: false,
    },
    backgroundColor: "#FAFAF8",
    title: "Journal",
  });

  const isDev = !app.isPackaged;

  if (isDev) {
    // Dev: Vite dev server
    mainWindow.loadURL("http://localhost:5173");
    mainWindow.webContents.openDevTools();
  } else {
    // Production: serve from the Electron Express server over HTTP.
    // This is intentional — loading over file:// would break /ort/ WASM paths
    // inside Web Workers. HTTP serving makes all relative paths work correctly.
    mainWindow.loadURL(`http://127.0.0.1:${port}`);
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
  // Allow SharedArrayBuffer across all sessions (required by ONNX Runtime WASM threads)
  app.commandLine.appendSwitch("enable-features", "SharedArrayBuffer");

  const port = await createServer();
  serverPort = port;

  app.whenReady().then(() => {
    // Set COOP/COEP on the default session so SharedArrayBuffer is enabled
    // even if some ORT builds check the browser context.
    session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
      callback({
        responseHeaders: {
          ...details.responseHeaders,
          "Cross-Origin-Opener-Policy": ["same-origin"],
          "Cross-Origin-Embedder-Policy": ["require-corp"],
        },
      });
    });

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
