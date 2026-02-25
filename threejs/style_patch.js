
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

  function patchLoadModel(app) {
    if (!app || typeof app.loadModel !== "function") return;
    if (app.__revitget_style_patched) return;
    app.__revitget_style_patched = true;
    const original = app.loadModel.bind(app);
    app.loadModel = function (cfg, ...rest) {
      try {
        const ext = getUrlExt(cfg && cfg.url);
        window.__revitget_last_model_ext = ext;
      } catch {}
      return original(cfg, ...rest);
    };
  }

  function applyStyle() {
    const root = window.webView ?? window;
    const app = tryGet(root, ["app"]) || tryGet(root, ["webView", "app"]);
    if (!app) return false;

    patchLoadModel(app);

    const view = app.view || app.viewer;
    if (!view) return false;

    const scene = view.scene;
    const renderer = view.renderer;

    if (!scene || !renderer) return false;

    const ext = String(window.__revitget_last_model_ext || "").toLowerCase();
    const isGlb = ext === "glb";

    if (!renderer.__revitget_orig_clear) {
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
    if (scene.__revitget_orig_bg === undefined) {
      scene.__revitget_orig_bg = scene.background;
    }

    if (typeof renderer.setClearColor === "function") {
      if (isGlb) {
        renderer.setClearColor(LIGHT_BG_COLOR, 1);
        scene.background = null;
        scene.__revitget_glb_applied = true;
      } else if (scene.__revitget_glb_applied) {
        const orig = renderer.__revitget_orig_clear;
        renderer.setClearColor(orig == null ? DARK_BG_COLOR : orig, 1);
        scene.background = scene.__revitget_orig_bg;
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
