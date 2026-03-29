const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("httpClient", {
  invokeProxy: (payload) => ipcRenderer.invoke("http:proxy", payload),
  historyGet: () => ipcRenderer.invoke("history:get"),
  historyAppend: (entry) => ipcRenderer.invoke("history:append", entry),
  historyClear: () => ipcRenderer.invoke("history:clear"),
  onHistoryUpdated: (callback) => {
    if (typeof callback !== "function") return () => {};
    const listener = () => callback();
    ipcRenderer.on("history:updated", listener);
    return () => ipcRenderer.removeListener("history:updated", listener);
  },
});
