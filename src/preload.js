const { contextBridge, ipcRenderer } = require("electron");
contextBridge.exposeInMainWorld("api", {
  load: () => ipcRenderer.invoke("store:load"),
  save: (d) => ipcRenderer.invoke("store:save", d),
  storePath: () => ipcRenderer.invoke("store:path"),
  quote: (s) => ipcRenderer.invoke("yahoo:quote", s),
  history: (s, r) => ipcRenderer.invoke("yahoo:history", s, r),
  search: (q) => ipcRenderer.invoke("yahoo:search", q),
  exportData: (d) => ipcRenderer.invoke("file:export", d),
  importData: () => ipcRenderer.invoke("file:import"),
  appInfo: () => ipcRenderer.invoke("app:info")
});
