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

  function patch() {
    const root = window.webView ?? window;
    const app = tryGet(root, ["app"]) || tryGet(root, ["webView", "app"]);
    if (!app || typeof app.loadModel !== "function") return false;
    if (app.__revitget_dwg_patched) return true;
    app.__revitget_dwg_patched = true;

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

  let tries = 0;
  const timer = setInterval(() => {
    tries += 1;
    if (patch() || tries > 300) clearInterval(timer);
  }, 200);
})();
