
(function () {
  const LIGHT_BG_COLOR = 0xffffff;
  const DARK_BG_COLOR = 0x050713;

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

  function getUrlExt(url) {
    if (!url) return "";
    const s = String(url);
    const i = s.lastIndexOf(".");
    if (i < 0) return "";
    return s.slice(i + 1).split("?")[0].toLowerCase();
  }

  function getAnyExt() {
    for (let i = 0; i < arguments.length; i++) {
      const ext = getUrlExt(arguments[i]);
      if (ext) return ext;
    }
    return "";
  }

  function patchLoadModel(app) {
    if (!app || typeof app.loadModel !== "function") return;
    if (app.__revitget_style_patched) return;
    app.__revitget_style_patched = true;
    const original = app.loadModel.bind(app);
    app.loadModel = function (cfg, ...rest) {
      try {
        const ext = getAnyExt(cfg && cfg.url, cfg && cfg.fileName, cfg && cfg.name);
        if (ext) {
          window.__revitget_last_model_ext = ext;
        }
      } catch {}
      return original(cfg, ...rest);
    };
  }

  function getActiveExt(app) {
    try {
      const doc = app.activeDocument || app._activeDocument || null;
      if (!doc) return "";
      return getAnyExt(doc.url, doc._url, doc.fileName, doc._fileName, doc.name, doc._name);
    } catch {
      return "";
    }
  }

  function applyStyle() {
    const root = window.webView ?? window;
    const app = tryGet(root, ["app"]) || tryGet(root, ["webView", "app"]);
    if (!app) return false;

    patchLoadModel(app);

    const view = app.view || app.viewer || app._view;
    if (!view) return false;

    const scene = view.scene || view._scene;
    const renderer = view.renderer || view._renderer;

    if (!scene || !renderer) return false;

    let ext = String(window.__revitget_last_model_ext || "").toLowerCase();
    if (!ext) {
      ext = getActiveExt(app);
      if (ext) {
        window.__revitget_last_model_ext = ext;
      }
    }
    const isGlb = ext === "glb";

    if (renderer.__revitget_orig_clear === undefined) {
      try {
        const THREE = root.THREE;
        if (THREE && typeof THREE.Color === "function" && typeof renderer.getClearColor === "function") {
          const c = new THREE.Color();
          renderer.getClearColor(c);
          renderer.__revitget_orig_clear = c.getHex();
        } else {
          renderer.__revitget_orig_clear = null;
        }
      } catch {
        renderer.__revitget_orig_clear = null;
      }
    }
    if (renderer.__revitget_orig_exposure === undefined) {
      renderer.__revitget_orig_exposure = typeof renderer.toneMappingExposure === "number" ? renderer.toneMappingExposure : null;
    }
    if (scene.__revitget_orig_bg === undefined) {
      scene.__revitget_orig_bg = scene.background;
    }

    if (typeof renderer.setClearColor === "function") {
      if (isGlb) {
        renderer.setClearColor(LIGHT_BG_COLOR, 1);
        try {
          const THREE = root.THREE;
          if (THREE && typeof THREE.Color === "function") {
            scene.background = new THREE.Color(LIGHT_BG_COLOR);
          } else {
            scene.background = null;
          }
        } catch {
          scene.background = null;
        }
        if (renderer.__revitget_orig_exposure !== null && typeof renderer.toneMappingExposure === "number") {
          renderer.toneMappingExposure = Math.max(renderer.__revitget_orig_exposure, 1.0) * 1.15;
        }
        scene.__revitget_glb_applied = true;
      } else if (scene.__revitget_glb_applied) {
        const orig = renderer.__revitget_orig_clear;
        renderer.setClearColor(orig == null ? DARK_BG_COLOR : orig, 1);
        scene.background = scene.__revitget_orig_bg;
        if (renderer.__revitget_orig_exposure !== null && typeof renderer.toneMappingExposure === "number") {
          renderer.toneMappingExposure = renderer.__revitget_orig_exposure;
        }
        scene.__revitget_glb_applied = false;
      }
    }

    return true;
  }

  setInterval(() => {
    applyStyle();
  }, 800);
  applyStyle();
})();
