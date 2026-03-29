const http = require("http");
const https = require("https");
const { URL } = require("url");
const { assertOutboundUrlAllowed } = require("./security");

function tryParseJsonBody(bodyText) {
  const t = String(bodyText || "")
    .trim()
    .replace(/^\uFEFF/, "");
  if (!t) return null;
  const c = t[0];
  if (
    c !== "{" &&
    c !== "[" &&
    c !== '"' &&
    (c < "0" || c > "9") &&
    c !== "-" &&
    t !== "null" &&
    t !== "true" &&
    t !== "false"
  ) {
    return null;
  }
  try {
    return JSON.parse(t);
  } catch {
    return null;
  }
}

function fetchWithNode(targetUrl, options) {
  return new Promise((resolve, reject) => {
    let parsed;
    try {
      parsed = new URL(targetUrl);
    } catch (e) {
      reject(new Error("Invalid URL"));
      return;
    }

    const isHttps = parsed.protocol === "https:";
    const lib = isHttps ? https : http;
    const defaultPort = isHttps ? 443 : 80;
    const port = parsed.port || defaultPort;

    const reqOptions = {
      hostname: parsed.hostname,
      port,
      path: parsed.pathname + parsed.search,
      method: options.method || "GET",
      headers: options.headers || {},
    };

    const req = lib.request(reqOptions, (res) => {
      const chunks = [];
      res.on("data", (c) => chunks.push(c));
      res.on("end", () => {
        const bodyBuffer = Buffer.concat(chunks);
        let bodyText = bodyBuffer.toString("utf8");
        const contentType = (res.headers["content-type"] || "").toLowerCase();
        let bodyParsed = null;
        if (contentType.includes("application/json")) {
          try {
            bodyParsed = JSON.parse(bodyText);
          } catch {
            bodyParsed = null;
          }
        }
        if (bodyParsed === null) {
          bodyParsed = tryParseJsonBody(bodyText);
        }
        resolve({
          status: res.statusCode,
          statusMessage: res.statusMessage,
          headers: res.headers,
          body: bodyText,
          bodyParsed,
        });
      });
    });

    req.on("error", reject);
    if (options.body != null && options.body !== "") {
      req.write(
        typeof options.body === "string"
          ? options.body
          : JSON.stringify(options.body)
      );
    }
    req.end();
  });
}

/**
 * Executes an outbound HTTP(S) request from the main process (Electron IPC payload shape).
 * @param {{ url?: string, method?: string, headers?: object, body?: unknown }} body
 * @returns {Promise<object>}
 */
async function executeProxyRequest(body) {
  const { url, method, headers, body: reqBody } = body || {};

  if (!url || typeof url !== "string") {
    return { ok: false, error: "Missing or invalid url" };
  }

  const m = (method || "GET").toUpperCase();
  const allowed = ["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS"];
  if (!allowed.includes(m)) {
    return { ok: false, error: "Unsupported method" };
  }

  const forwardHeaders = { ...(headers && typeof headers === "object" ? headers : {}) };
  delete forwardHeaders.host;
  delete forwardHeaders.connection;

  let bodyStr = undefined;
  if (reqBody != null && reqBody !== "" && m !== "GET" && m !== "HEAD") {
    if (typeof reqBody === "string") {
      bodyStr = reqBody;
    } else {
      bodyStr = JSON.stringify(reqBody);
      if (!forwardHeaders["content-type"] && !forwardHeaders["Content-Type"]) {
        forwardHeaders["content-type"] = "application/json";
      }
    }
  }

  try {
    await assertOutboundUrlAllowed(url);
    const result = await fetchWithNode(url.trim(), {
      method: m,
      headers: forwardHeaders,
      body: bodyStr,
    });
    return {
      ok: true,
      status: result.status,
      statusMessage: result.statusMessage,
      headers: result.headers,
      body: result.body,
      bodyParsed: result.bodyParsed,
    };
  } catch (err) {
    return {
      ok: false,
      error: err.message || String(err),
    };
  }
}

module.exports = { fetchWithNode, executeProxyRequest };
