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

  const WASM_PATH = "threejs/lib/dwgApi/DwgApi.wasm";

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
    app.__revitget_dwg_wasm_patched = true;

    const original = app.loadModel.bind(app);
    app.loadModel = function (cfg, ...rest) {
      try {
        if (cfg && typeof cfg === "object") {
          const url = cfg.url || cfg.fileUrl || cfg.path || "";
          if (url && (/\.(dwg|dxf)$/i.test(url) || cfg.format === "dwg" || cfg.format === "dxf")) {
            const patched = Object.assign({}, cfg);
            patched.locateFile = function (file) {
              if (/DwgApi\.wasm$/i.test(file)) {
                return WASM_PATH;
              }
              return file;
            };
            return original(patched, ...rest);
          }
        }
      } catch {}
      return original(cfg, ...rest);
    };

    return true;
  }

  let tries = 0;
  const timer = setInterval(() => {
    tries += 1;
    if (patch() || tries > 300) clearInterval(timer);
  }, 200);
})();
