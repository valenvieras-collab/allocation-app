const { app, BrowserWindow, ipcMain, dialog, shell, Menu } = require("electron");
const path = require("path");
const fs = require("fs");

const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36";
const storeFile = () => path.join(app.getPath("userData"), "allocation.json");
const SHELL_VERSION = 1;
const REMOTE = "https://raw.githubusercontent.com/valenvieras-collab/allocation-app/main/renderer/";
const cacheDir = () => path.join(app.getPath("userData"), "renderer-cache");
let loadedUI = { version: 0, source: "incluida" };

function readVersion(dir) { try { return JSON.parse(fs.readFileSync(path.join(dir, "version.json"), "utf8")); } catch (e) { return null; } }
async function fetchText(url, ms) {
  const ctl = new AbortController(); const t = setTimeout(() => ctl.abort(), ms);
  try { const r = await fetch(url + "?t=" + Date.now(), { signal: ctl.signal, headers: { "User-Agent": UA, "Cache-Control": "no-cache" } }); if (!r.ok) throw new Error("HTTP " + r.status); return await r.text(); }
  finally { clearTimeout(t); }
}
/* Busca una interfaz más nueva en GitHub; si la hay, la guarda en caché. Devuelve la carpeta a usar. */
async function pickRenderer() {
  const bundledDir = path.join(__dirname, "renderer");
  const bundled = readVersion(bundledDir) || { version: 0 };
  let best = { dir: bundledDir, v: bundled, source: "incluida" };
  const cached = readVersion(cacheDir());
  if (cached && cached.version > best.v.version && (cached.minShell || 1) <= SHELL_VERSION && fs.existsSync(path.join(cacheDir(), "index.html")))
    best = { dir: cacheDir(), v: cached, source: "actualización guardada" };
  try {
    const remote = JSON.parse(await fetchText(REMOTE + "version.json", 4000));
    if (remote && remote.version > best.v.version && (remote.minShell || 1) <= SHELL_VERSION) {
      const html = await fetchText(REMOTE + "index.html", 8000);
      if (html.includes("<html") && html.length > 5000) {
        fs.mkdirSync(cacheDir(), { recursive: true });
        fs.writeFileSync(path.join(cacheDir(), "index.html"), html);
        fs.writeFileSync(path.join(cacheDir(), "version.json"), JSON.stringify(remote));
        best = { dir: cacheDir(), v: remote, source: "actualizada desde GitHub" };
      }
    } else if (remote && (remote.minShell || 1) > SHELL_VERSION) {
      best.needsReinstall = true;
    }
  } catch (e) { /* sin conexión: se usa la mejor versión local */ }
  loadedUI = { version: best.v.version, notes: best.v.notes || "", source: best.source, needsReinstall: !!best.needsReinstall };
  return best.dir;
}

function readStore() {
  try { return JSON.parse(fs.readFileSync(storeFile(), "utf8")); }
  catch (e) {
    try { return JSON.parse(fs.readFileSync(path.join(__dirname, "seed.json"), "utf8")); }
    catch (e2) { return { holdings: {}, config: null }; }
  }
}
function writeStore(data) {
  const f = storeFile(); const tmp = f + ".tmp";
  fs.mkdirSync(path.dirname(f), { recursive: true });
  fs.writeFileSync(tmp, JSON.stringify(data, null, 1));
  fs.renameSync(tmp, f);
  return true;
}

async function getJSON(url) {
  const r = await fetch(url, { headers: { "User-Agent": UA, "Accept": "application/json" } });
  if (!r.ok) throw new Error("HTTP " + r.status);
  return r.json();
}
const hosts = ["https://query1.finance.yahoo.com", "https://query2.finance.yahoo.com"];
async function yahoo(pathq) {
  let last;
  for (const h of hosts) { try { return await getJSON(h + pathq); } catch (e) { last = e; } }
  throw last;
}

async function chart(symbol, range, interval) {
  const j = await yahoo(`/v8/finance/chart/${encodeURIComponent(symbol)}?range=${range}&interval=${interval}&includePrePost=false&events=div%2Csplit`);
  const r = j && j.chart && j.chart.result && j.chart.result[0];
  if (!r) throw new Error((j && j.chart && j.chart.error && j.chart.error.description) || "sin datos");
  return r;
}

ipcMain.handle("store:load", () => readStore());
ipcMain.handle("store:save", (_e, data) => writeStore(data));
ipcMain.handle("store:path", () => storeFile());
ipcMain.handle("app:info", () => ({ ...loadedUI, shell: SHELL_VERSION, appVersion: app.getVersion() }));

ipcMain.handle("yahoo:quote", async (_e, symbols) => {
  const out = {};
  await Promise.all(symbols.map(async (s) => {
    try {
      const r = await chart(s, "5d", "1d");
      const m = r.meta || {};
      out[s] = { ok: true, price: m.regularMarketPrice, time: m.regularMarketTime, currency: m.currency,
        type: m.instrumentType, name: m.longName || m.shortName || "", exchange: m.fullExchangeName || m.exchangeName || "",
        prevClose: m.chartPreviousClose ?? m.previousClose };
    } catch (e) { out[s] = { ok: false, error: String(e.message || e) }; }
  }));
  return out;
});

ipcMain.handle("yahoo:history", async (_e, symbols, range) => {
  const out = {};
  await Promise.all(symbols.map(async (s) => {
    try {
      const r = await chart(s, range || "1y", "1d");
      const ts = r.timestamp || [];
      const adj = (r.indicators && r.indicators.adjclose && r.indicators.adjclose[0] && r.indicators.adjclose[0].adjclose) ||
                  (r.indicators && r.indicators.quote && r.indicators.quote[0] && r.indicators.quote[0].close) || [];
      const pts = [];
      for (let i = 0; i < ts.length; i++) if (Number.isFinite(adj[i]) && adj[i] > 0) pts.push([ts[i], adj[i]]);
      out[s] = { ok: true, points: pts };
    } catch (e) { out[s] = { ok: false, error: String(e.message || e) }; }
  }));
  return out;
});

ipcMain.handle("yahoo:search", async (_e, q) => {
  try {
    const j = await yahoo(`/v1/finance/search?q=${encodeURIComponent(q)}&quotesCount=6&newsCount=0&listsCount=0`);
    return { ok: true, quotes: (j.quotes || []).map(x => ({ symbol: x.symbol, name: x.longname || x.shortname || "", type: x.quoteType,
      exchange: x.exchDisp || x.exchange || "", sector: x.sector || x.sectorDisp || "", industry: x.industry || x.industryDisp || "" })) };
  } catch (e) { return { ok: false, error: String(e.message || e) }; }
});

ipcMain.handle("file:export", async (_e, data) => {
  const r = await dialog.showSaveDialog({ title: "Exportar cartera", defaultPath: "allocation-backup.json", filters: [{ name: "JSON", extensions: ["json"] }] });
  if (r.canceled || !r.filePath) return false;
  fs.writeFileSync(r.filePath, JSON.stringify(data, null, 1)); return true;
});
ipcMain.handle("file:import", async () => {
  const r = await dialog.showOpenDialog({ title: "Importar cartera", properties: ["openFile"], filters: [{ name: "JSON", extensions: ["json"] }] });
  if (r.canceled || !r.filePaths[0]) return null;
  return JSON.parse(fs.readFileSync(r.filePaths[0], "utf8"));
});

async function createWindow() {
  const dir = await pickRenderer();
  const win = new BrowserWindow({
    width: 1320, height: 900, minWidth: 900, minHeight: 640, title: "Allocation",
    backgroundColor: "#0F1724", show: false,
    webPreferences: { preload: path.join(__dirname, "preload.js"), contextIsolation: true, nodeIntegration: false, sandbox: true }
  });
  win.once("ready-to-show", () => win.show());
  win.webContents.setWindowOpenHandler(({ url }) => { if (/^https?:/.test(url)) shell.openExternal(url); return { action: "deny" }; });
  win.loadFile(path.join(dir, "index.html"));
}

app.setName("Allocation");
app.whenReady().then(() => {
  Menu.setApplicationMenu(Menu.buildFromTemplate([
    { role: "appMenu" }, { role: "editMenu" },
    { label: "Ver", submenu: [{ role: "reload", label: "Recargar" }, { role: "togglefullscreen", label: "Pantalla completa" }, { type: "separator" }, { role: "resetZoom" }, { role: "zoomIn" }, { role: "zoomOut" }] },
    { role: "windowMenu" }
  ]));
  createWindow();
  app.on("activate", () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
});
app.on("window-all-closed", () => { if (process.platform !== "darwin") app.quit(); });
