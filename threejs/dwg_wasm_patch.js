(function () {
  const params = (function () {
    try {
      return new URLSearchParams(String(location && location.search ? location.search : ""));
    } catch {
      return null;
    }
  })();

  const RE_PATCH_OFF = params && (params.get("nopatch") === "1" || params.get("revitget_patch") === "0");
  if (RE_PATCH_OFF) return;

  const WASM_PATH = new URL("./lib/dwgApi/DwgApi.wasm", import.meta.url).href;

  function log(msg) {
    try {
      console.log("[DWG_WASM_PATCH]", msg);
    } catch {}
  }

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

  function patch() {
    const root = window.webView ?? window;
    const app = tryGet(root, ["app"]) || tryGet(root, ["webView", "app"]);
    if (!app) return false;
    if (app.__revitget_dwg_wasm_patched) return true;

    if (typeof app.loadModel !== "function") {
      log("app.loadModel is not a function, skipping patch");
      return false;
    }

    app.__revitget_dwg_wasm_patched = true;
    log("Patched app.loadModel for DWG/DXF");

    const original = app.loadModel.bind(app);
    app.loadModel = function (cfg, ...rest) {
      try {
        if (cfg && typeof cfg === "object") {
          const url = cfg.url || cfg.fileUrl || cfg.path || "";
          const format = cfg.format || "";
          const fileName = cfg.fileName || cfg.name || (cfg.file && cfg.file.name) || (cfg.blob && cfg.blob.name) || "";
          log("loadModel called with url=" + url + " format=" + format + " fileName=" + fileName);
          
          const isBlobDxf = url && url.startsWith("blob:") && format === "dxf";
          if (isBlobDxf) {
            log("Skipping locateFile injection for blob DXF URL");
            return original(cfg, ...rest);
          }
          
          const isDwg =
            (url && /\.dwg$/i.test(url)) ||
            (fileName && /\.dwg$/i.test(fileName)) ||
            format === "dwg";

          const isDwgDxf = 
            (url && /\.(dwg|dxf)$/i.test(url)) ||
            (fileName && /\.(dwg|dxf)$/i.test(fileName)) ||
            format === "dwg" || format === "dxf";
          if (isDwgDxf) {
            log("Detected DWG/DXF file, injecting locateFile");
            const patched = Object.assign({}, cfg);
            patched.locateFile = function (file) {
              if (/DwgApi\.wasm$/i.test(file)) {
                log("locateFile called for " + file + " -> " + WASM_PATH);
                return WASM_PATH;
              }
              return file;
            };
            const p = original(patched, ...rest);
            if (isDwg && url && url.startsWith("blob:") && (!format || format === "dwg")) {
              return Promise.resolve(p).catch((e) => {
                log("Suppressed DWG loadModel error: " + e);
              });
            }
            return p;
          }
        }
      } catch (e) {
        log("Error in loadModel patch: " + e);
      }
      return original(cfg, ...rest);
    };

    return true;
  }

  let tries = 0;
  const timer = setInterval(() => {
    tries += 1;
    if (patch() || tries > 300) {
      if (tries > 300) log("Failed to patch after 300 tries");
      clearInterval(timer);
    }
  }, 200);

  function hookDwgApiGlobal() {
    try {
      const check = setInterval(() => {
        if (window.DwgApi && typeof window.DwgApi === "function") {
          clearInterval(check);
          log("Found global DwgApi constructor");
          const OrigDwgApi = window.DwgApi;
          window.DwgApi = function (cfg) {
            try {
              log("DwgApi constructor called with cfg=" + JSON.stringify(cfg));
              if (cfg && typeof cfg === "object") {
                cfg.locateFile = function (file) {
                  if (/DwgApi\.wasm$/i.test(file)) {
                    log("DwgApi locateFile: " + file + " -> " + WASM_PATH);
                    return WASM_PATH;
                  }
                  return file;
                };
              }
            } catch (e) {
              log("Error in DwgApi hook: " + e);
            }
            return new OrigDwgApi(cfg);
          };
          window.DwgApi.prototype = OrigDwgApi.prototype;
          window.DwgApi.prototype.constructor = window.DwgApi;
          log("Hooked global DwgApi constructor");
        }
      }, 200);
      setTimeout(() => clearInterval(check), 60000);
    } catch (e) {
      log("Error setting up DwgApi global hook: " + e);
    }
  }
  hookDwgApiGlobal();
})();
