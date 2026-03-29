const fs = require("fs");
const path = require("path");

const MAX_ENTRIES = 2000;

function filePath(app) {
  return path.join(app.getPath("userData"), "http-client-run-history.json");
}

function readHistory(app) {
  try {
    const raw = fs.readFileSync(filePath(app), "utf8");
    const data = JSON.parse(raw);
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}

function writeHistory(app, list) {
  fs.writeFileSync(filePath(app), JSON.stringify(list), "utf8");
}

function appendHistory(app, entry) {
  if (!entry || typeof entry !== "object") return readHistory(app);
  const list = readHistory(app);
  list.unshift(entry);
  while (list.length > MAX_ENTRIES) list.pop();
  writeHistory(app, list);
  return list;
}

function clearHistory(app) {
  writeHistory(app, []);
}

module.exports = { readHistory, appendHistory, clearHistory, MAX_ENTRIES };
