let patched = false;
const processedScenes = new WeakSet();

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

function isThreeObject(o) {
  return o && typeof o === "object" && typeof o.traverse === "function";
}

function cloneMaterial(m) {
  if (!m || typeof m !== "object" || !m.isMaterial) return m;
  if (m.userData && m.userData.__revitget_cloned) return m;
  const c = m.clone();
  c.userData = Object.assign({}, c.userData, { __revitget_cloned: true });
  return c;
}

function ensureUniqueMaterials(scene) {
  if (!scene || processedScenes.has(scene)) return;
  processedScenes.add(scene);
  try {
    scene.traverse((o) => {
      const mat = o && o.material;
      if (!mat) return;
      if (Array.isArray(mat)) {
        o.material = mat.map(cloneMaterial);
      } else {
        o.material = cloneMaterial(mat);
      }
    });
  } catch {}
}

function tryPatch() {
  if (patched) return true;
  const root = window.webView ?? window;
  const app = tryGet(root, ["app"]) || tryGet(window, ["app"]);
  if (!app) return false;

  patched = true;

  if (typeof app.loadModel === "function" && !app.__revitget_sel_patched) {
    app.__revitget_sel_patched = true;
    const orig = app.loadModel.bind(app);
    app.loadModel = function () {
      const r = orig.apply(this, arguments);
      try {
        const view = this.view || this._view || this.viewer || this._viewer || null;
        const scene = view && (view.scene || view._scene);
        if (isThreeObject(scene)) ensureUniqueMaterials(scene);
      } catch {}
      return r;
    };
  }

  return true;
}

let tries = 0;
const timer = setInterval(() => {
  tries += 1;
  const ok = tryPatch();
  if (ok || tries > 300) clearInterval(timer);
}, 200);

function tick() {
  try {
    const root = window.webView ?? window;
    const app = tryGet(root, ["app"]) || tryGet(window, ["app"]);
    const view = app && (app.view || app._view || app.viewer || app._viewer || null);
    const scene = view && (view.scene || view._scene);
    if (isThreeObject(scene)) ensureUniqueMaterials(scene);
  } catch {}
  requestAnimationFrame(tick);
}
requestAnimationFrame(tick);
