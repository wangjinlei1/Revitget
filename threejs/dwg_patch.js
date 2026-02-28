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

  function ensureGetLoaderPatched(app) {
    try {
      if (!app || app.__revitget_getloader_patched) return;
      if (typeof app._getLoader !== "function") return;
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
        return originalGetLoader(cfg);
      };
      app.__revitget_getloader_patched = true;
      log("Patched app._getLoader for blob files");
    } catch {}
  }

  function loadDxf(app, url) {
    ensureGetLoaderPatched(app);
    log("Trying DXF load via patched _getLoader");
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
            log("Creating DWG Worker for: " + urlStr);
            const worker = new originalWorker(scriptURL, options);
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
                        loadDxf(app, e.data.url)
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
                            log("DXF load failed: " + err);
                          });
                      } catch (err) {
                        log("Error auto-loading DXF: " + err);
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
