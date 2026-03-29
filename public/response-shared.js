(function () {
  function pathJoin(parent, segment) {
    if (parent === "" || parent == null) return String(segment);
    return `${parent}.${segment}`;
  }

  /**
   * True if this path should be stripped. Supports:
   * - exact / prefix matches (e.g. hiding "results" hides "results.0.foo")
   * - two-segment keys "arrayKey.fieldKey" meaning: under an array at arrayKey, omit fieldKey
   *   on every element (paths like "results.0.companyName").
   */
  function isPathHidden(path, hiddenSet) {
    if (hiddenSet.has(path)) return true;
    for (const h of hiddenSet) {
      if (path === h || path.startsWith(h + ".")) return true;
    }
    for (const h of hiddenSet) {
      const dot = h.indexOf(".");
      if (dot <= 0 || dot === h.length - 1) continue;
      if (h.indexOf(".", dot + 1) >= 0) continue;
      const parentKey = h.slice(0, dot);
      const childKey = h.slice(dot + 1);
      const prefix = parentKey + ".";
      if (!path.startsWith(prefix)) continue;
      const rest = path.slice(prefix.length);
      const m = /^(\d+)\.(.+)$/.exec(rest);
      if (!m) continue;
      const restKey = m[2];
      if (restKey === childKey || restKey.startsWith(childKey + ".")) return true;
    }
    return false;
  }

  function filterByHidden(obj, basePath, hiddenSet) {
    if (isPathHidden(basePath, hiddenSet)) return undefined;
    if (obj === null || typeof obj !== "object") return obj;
    if (Array.isArray(obj)) {
      const out = [];
      obj.forEach((item, i) => {
        const p = pathJoin(basePath, i);
        if (isPathHidden(p, hiddenSet)) return;
        const v = filterByHidden(item, p, hiddenSet);
        if (v !== undefined) out.push(v);
      });
      return out;
    }
    const out = {};
    for (const key of Object.keys(obj)) {
      const p = pathJoin(basePath, key);
      if (isPathHidden(p, hiddenSet)) continue;
      const v = filterByHidden(obj[key], p, hiddenSet);
      if (v !== undefined) out[key] = v;
    }
    return out;
  }

  function parseTreeRoot(bodyText, bodyParsed) {
    if (bodyParsed !== undefined && bodyParsed !== null) {
      if (typeof bodyParsed === "object") return bodyParsed;
      if (
        typeof bodyParsed === "string" ||
        typeof bodyParsed === "number" ||
        typeof bodyParsed === "boolean"
      ) {
        return bodyParsed;
      }
    }
    const t = (bodyText || "")
      .trim()
      .replace(/^\uFEFF/, "");
    if (!t || t === "(empty)") return null;
    try {
      return JSON.parse(t);
    } catch {
      return null;
    }
  }

  /** Top-level keys (objects) or indices (arrays), or [""] for a JSON primitive. */
  function getTopLevelPaths(value) {
    if (value === null || value === undefined) return [];
    if (Array.isArray(value)) return value.map((_, i) => String(i));
    if (typeof value === "object") return Object.keys(value);
    return [""];
  }

  function formatPathLabel(path) {
    if (path === "") return "Value";
    if (/^\d+$/.test(path)) return `[${path}]`;
    return path;
  }

  function previewNodeValue(nodeVal) {
    if (nodeVal === null) return "null";
    if (nodeVal === undefined) return "undefined";
    if (typeof nodeVal === "object") {
      return Array.isArray(nodeVal)
        ? `Array · ${nodeVal.length} item${nodeVal.length === 1 ? "" : "s"}`
        : `Object · ${Object.keys(nodeVal).length} key${Object.keys(nodeVal).length === 1 ? "" : "s"}`;
    }
    const s =
      typeof nodeVal === "string" ? JSON.stringify(nodeVal) : String(nodeVal);
    return s.length > 56 ? s.slice(0, 53) + "…" : s;
  }

  function nodeAtPath(root, path) {
    if (path === "") return root;
    if (Array.isArray(root)) return root[Number(path)];
    if (root && typeof root === "object") return root[path];
    return undefined;
  }

  /** Union of object keys seen on non-array object elements (sampled for very large arrays). */
  function getArrayElementObjectKeys(arr) {
    if (!Array.isArray(arr) || arr.length === 0) return [];
    const keys = new Set();
    const limit = Math.min(arr.length, 2000);
    for (let i = 0; i < limit; i++) {
      const item = arr[i];
      if (item && typeof item === "object" && !Array.isArray(item)) {
        for (const k of Object.keys(item)) keys.add(k);
      }
    }
    return Array.from(keys).sort();
  }

  /** Drop hidden paths that no longer apply to this root (top-level or array child keys). */
  function pruneHiddenPaths(root, hiddenSet) {
    if (root === null || root === undefined) return;
    const topSet = new Set(getTopLevelPaths(root));
    for (const h of [...hiddenSet]) {
      const d = h.indexOf(".");
      if (d < 0) {
        if (!topSet.has(h)) hiddenSet.delete(h);
        continue;
      }
      const parent = h.slice(0, d);
      const child = h.slice(d + 1);
      if (child.includes(".")) {
        hiddenSet.delete(h);
        continue;
      }
      if (!topSet.has(parent)) {
        hiddenSet.delete(h);
        continue;
      }
      const node = nodeAtPath(root, parent);
      const keys = getArrayElementObjectKeys(node);
      if (!keys.includes(child)) hiddenSet.delete(h);
    }
  }

  function syncParentHiddenClass(block, parentPath, hiddenSet) {
    block.classList.toggle("json-path-block--parent-hidden", hiddenSet.has(parentPath));
  }

  /**
   * One checkbox per top-level field; for values that are arrays of objects, one row per field inside those objects.
   */
  function renderTopLevelJsonFilters(container, root, hiddenSet, onChange) {
    container.replaceChildren();
    const paths = getTopLevelPaths(root);
    if (paths.length === 0) {
      const p = document.createElement("p");
      p.className = "hint";
      p.textContent = "Empty JSON object — nothing to filter.";
      container.appendChild(p);
      return;
    }

    const list = document.createElement("div");
    list.className = "json-path-list";

    paths.forEach((path) => {
      const block = document.createElement("div");
      block.className = "json-path-block";

      const row = document.createElement("label");
      row.className = "json-path-row";

      const cb = document.createElement("input");
      cb.type = "checkbox";
      cb.checked = !hiddenSet.has(path);
      cb.addEventListener("change", () => {
        if (cb.checked) hiddenSet.delete(path);
        else hiddenSet.add(path);
        syncParentHiddenClass(block, path, hiddenSet);
        if (typeof onChange === "function") onChange(hiddenSet);
      });

      const nameEl = document.createElement("span");
      nameEl.className = "json-path-name";
      nameEl.textContent = formatPathLabel(path);

      const preview = document.createElement("span");
      preview.className = "json-path-preview";
      preview.textContent = previewNodeValue(nodeAtPath(root, path));

      row.appendChild(cb);
      row.appendChild(nameEl);
      row.appendChild(preview);
      block.appendChild(row);

      const node = nodeAtPath(root, path);
      const childKeys = getArrayElementObjectKeys(node);
      if (childKeys.length > 0) {
        const sub = document.createElement("div");
        sub.className = "json-path-sublist";
        childKeys.forEach((ck) => {
          const childPath = pathJoin(path, ck);
          const subRow = document.createElement("label");
          subRow.className = "json-path-row json-path-row--nested";

          const subCb = document.createElement("input");
          subCb.type = "checkbox";
          subCb.checked = !hiddenSet.has(childPath);
          subCb.addEventListener("change", () => {
            if (subCb.checked) hiddenSet.delete(childPath);
            else hiddenSet.add(childPath);
            if (typeof onChange === "function") onChange(hiddenSet);
          });

          const subName = document.createElement("span");
          subName.className = "json-path-name";
          subName.textContent = `${formatPathLabel(path)} → ${ck}`;

          let pv = "—";
          if (Array.isArray(node)) {
            for (const it of node) {
              if (
                it &&
                typeof it === "object" &&
                !Array.isArray(it) &&
                Object.prototype.hasOwnProperty.call(it, ck)
              ) {
                pv = previewNodeValue(it[ck]);
                break;
              }
            }
          }

          const subPreview = document.createElement("span");
          subPreview.className = "json-path-preview";
          subPreview.textContent = pv;

          subRow.appendChild(subCb);
          subRow.appendChild(subName);
          subRow.appendChild(subPreview);
          sub.appendChild(subRow);
        });
        block.appendChild(sub);
      }

      syncParentHiddenClass(block, path, hiddenSet);
      list.appendChild(block);
    });

    container.appendChild(list);
  }

  window.HttpClientResponse = {
    pathJoin,
    isPathHidden,
    filterByHidden,
    parseTreeRoot,
    getTopLevelPaths,
    getArrayElementObjectKeys,
    pruneHiddenPaths,
    renderTopLevelJsonFilters,
  };
})();
