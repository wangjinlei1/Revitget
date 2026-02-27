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
          if (/dwg2dxf\.js$/i.test(urlStr)) {
            log("Creating DWG Worker for: " + urlStr);
            const worker = new originalWorker(scriptURL, options);
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
                        app.loadModel({ url: e.data.url, format: "dxf" });
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
