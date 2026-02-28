(function () {
  function tryGet(obj, path) {
    let cur = obj;
    for (const key of path) {
      if (!cur) return null;
      try {
        cur = cur[key];
      } catch {
        return null;
      }
    }
    return cur ?? null;
  }

  function log(msg) {
    try {
      console.log("[DWG_PATCH]", msg);
    } catch {}
  }

  function errToString(e) {
    try {
      if (e && typeof e === "object") {
        if (e.stack) return String(e.stack);
        if (e.message) return String(e.message);
      }
      return String(e);
    } catch {
      return "";
    }
  }

  function logError(e, prefix) {
    try {
      const s = errToString(e);
      if (s) console.error("[DWG_PATCH]" + (prefix ? " " + prefix : ""), s);
      else console.error("[DWG_PATCH]" + (prefix ? " " + prefix : ""), e);
    } catch {}
  }

  const REVITGET_VERSION = "dxftext_v2";

  function ensureDxfLoaderPrototypePatched(app) {
    try {
      if (!app || app.__revitget_dxf_proto_patched) return;
      const mp = app._loaderPlugin;
      if (!mp || typeof mp.entries !== "function") return;

      let DxfPlugin = null;
      for (const [, Plugin] of mp.entries()) {
        if (!Plugin) continue;
        try {
          if (Plugin.name === "DxfLoaderPlugin") {
            DxfPlugin = Plugin;
            break;
          }
        } catch {}
        try {
          if (Plugin.prototype && typeof Plugin.prototype.loadDxf === "function") {
            DxfPlugin = Plugin;
          }
        } catch {}
      }
      if (!DxfPlugin || !DxfPlugin.prototype || typeof DxfPlugin.prototype.load !== "function") return;
      if (DxfPlugin.prototype.__revitget_load_patched) {
        app.__revitget_dxf_proto_patched = true;
        return;
      }

      const origLoad = DxfPlugin.prototype.load;
      DxfPlugin.prototype.load = function (cfg, progress) {
        try {
          if (cfg && typeof cfg.dxfText === "string" && cfg.dxfText) {
            let txt = cfg.dxfText;
            try {
              txt = String(txt || "").replace(/\0/g, "");
            } catch {}
            return Promise.resolve(this.loadDxf(txt, cfg))
              .then((doc) => {
                try {
                  doc.config = cfg;
                } catch {}
                return doc;
              })
              .catch((e) => {
                logError(e, "DxfLoaderPlugin.load(dxfText) failed");
                return Promise.reject(e);
              });
          }
        } catch (e) {
          logError(e, "DxfLoaderPlugin.load(dxfText) threw");
          return Promise.reject(e);
        }
        try {
          return Promise.resolve(origLoad.call(this, cfg, progress)).catch((e) => {
            logError(e, "DxfLoaderPlugin.load(fetch) failed");
            return Promise.reject(e);
          });
        } catch (e) {
          logError(e, "DxfLoaderPlugin.load(fetch) threw");
          return Promise.reject(e);
        }
      };
      DxfPlugin.prototype.__revitget_load_patched = true;
      app.__revitget_dxf_proto_patched = true;
      log("Patched DxfLoaderPlugin.load for dxfText");
    } catch {}
  }

  function ensureGetLoaderPatched(app) {
    try {
      if (!app || app.__revitget_getloader_patched) return;
      if (typeof app._getLoader !== "function") return;
      ensureDxfLoaderPrototypePatched(app);
      const originalGetLoader = app._getLoader.bind(app);
      app._getLoader = function (cfg) {
        try {
          const url = cfg && cfg.url ? String(cfg.url) : "";
          if (url && url.startsWith("blob:")) {
            const fileName = String(
              (cfg && (cfg.fileName || cfg.name)) ||
                (cfg && cfg.file && cfg.file.name) ||
                (cfg && cfg.blob && cfg.blob.name) ||
                ""
            );
            const ext = fileName.split(".").pop().toLowerCase();
            if (ext === "dxf") {
              const loader = originalGetLoader({ url: "revitget.dxf" });
              if (loader) return loader;
            }
            if (ext === "dwg") {
              const loader = originalGetLoader({ url: "revitget.dwg" });
              if (loader) return loader;
            }
          }
        } catch {}
        const loader = originalGetLoader(cfg);
        return loader;
      };
      app.__revitget_getloader_patched = true;
      log("Patched app._getLoader for blob files");
    } catch {}
  }

  function loadDxf(app, payload) {
    ensureGetLoaderPatched(app);
    ensureDxfLoaderPrototypePatched(app);
    log("Trying DXF load via patched _getLoader");
    const url = payload && typeof payload === "object" ? payload.url : payload;
    const dxfText = payload && typeof payload === "object" ? payload.dxfText : null;

    if (typeof dxfText === "string" && dxfText) {
      log("Using dxfText length=" + dxfText.length);
      const pseudoUrl = "revitget_" + Date.now() + ".dxf";
      return Promise.resolve(app.loadModel({ url: pseudoUrl, fileName: "revitget.dxf", dxfText }));
    }

    try {
      if (url && typeof url === "string" && url.startsWith("blob:")) {
        log("Fetching blob DXF as text fallback");
        return fetch(url)
          .then((r) => r.text())
          .then((t) => {
            log("Fetched dxfText length=" + (t ? t.length : 0));
            const pseudoUrl = "revitget_" + Date.now() + ".dxf";
            return app.loadModel({ url: pseudoUrl, fileName: "revitget.dxf", dxfText: t });
          });
      }
    } catch {}
    return Promise.resolve(app.loadModel({ url, fileName: "revitget.dxf" }));
  }

  function patch() {
    const root = window.webView ?? window;
    const app = tryGet(root, ["app"]) || tryGet(root, ["webView", "app"]);
    if (!app || typeof app.loadModel !== "function") return false;
    if (app.__revitget_dwg_patched) return true;
    app.__revitget_dwg_patched = true;
    log("Patched app.loadModel for DWG/DXF");

    const original = app.loadModel.bind(app);
    app.loadModel = function (cfg, ...rest) {
      try {
        if (cfg && Array.isArray(cfg.fontsUrls)) {
          const hasSimfang = cfg.fontsUrls.some((u) => /simfang\.ttf/i.test(String(u)));
          if (hasSimfang) {
            cfg = Object.assign({}, cfg, { fontsUrls: [] });
          }
        }
      } catch {}
      return original(cfg, ...rest);
    };

    return true;
  }

  function hookWorker() {
    try {
      const originalWorker = window.Worker;
      window.Worker = function (scriptURL, options) {
        try {
          const urlStr = String(scriptURL);
          if (/dwg2dxf\.js(\?|#|$)/i.test(urlStr)) {
            let workerUrl = scriptURL;
            try {
              if (!/revitget_v=/.test(urlStr)) {
                const sep = urlStr.includes("?") ? "&" : "?";
                workerUrl = urlStr + sep + "revitget_v=" + encodeURIComponent(REVITGET_VERSION);
              }
            } catch {}
            log("Creating DWG Worker for: " + String(workerUrl));
            const worker = new originalWorker(workerUrl, options);
            try {
              const baseUrl = new URL("./lib/dwgApi/", location.href).href;
              worker.postMessage({ __revitget_init: 1, baseUrl });
            } catch {}
            worker.addEventListener("message", function (e) {
              try {
                if (e.data && e.data.status === 0 && e.data.url) {
                  log("DWG Worker success, DXF URL: " + e.data.url);
                  const root = window.webView ?? window;
                  const app = tryGet(root, ["app"]) || tryGet(root, ["webView", "app"]);
                  if (app && typeof app.loadModel === "function") {
                    log("Auto-loading DXF from blob URL: " + e.data.url);
                    setTimeout(() => {
                      try {
                        loadDxf(app, e.data)
                          .then(() => {
                            if (typeof URL !== "undefined" && URL.revokeObjectURL && String(e.data.url).startsWith("blob:")) {
                              const delay = typeof e.data.revokeAfterMs === "number" ? e.data.revokeAfterMs : 60000;
                              setTimeout(() => {
                                try {
                                  URL.revokeObjectURL(e.data.url);
                                  log("Revoked DXF blob URL: " + e.data.url);
                                } catch {}
                              }, Math.max(0, delay));
                            }
                          })
                          .catch((err) => {
                            logError(err, "DXF load failed");
                          });
                      } catch (err) {
                        logError(err, "Error auto-loading DXF");
                      }
                    }, 100);
                  }
                } else if (e.data && e.data.status === 1) {
                  log("DWG Worker error: " + e.data.dxfData);
                }
              } catch {}
            });
            return worker;
          }
        } catch (e) {
          log("Error in Worker hook: " + e);
        }
        return new originalWorker(scriptURL, options);
      };
      window.Worker.prototype = originalWorker.prototype;
      window.Worker.prototype.constructor = window.Worker;
      log("Hooked global Worker constructor");
    } catch (e) {
      log("Error setting up Worker hook: " + e);
    }
  }

  let tries = 0;
  const timer = setInterval(() => {
    tries += 1;
    if (patch() || tries > 300) clearInterval(timer);
  }, 200);

  hookWorker();
})();
