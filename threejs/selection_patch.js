let patched = false;
const processedScenes = new WeakSet();
const objectBaseline = new WeakMap();
const materialBaseline = new WeakMap();
let baselineSceneRef = null;
let baselineSceneState = null;
let baselineRendererRef = null;
let baselineRendererState = null;
let baselineCanvasStyle = null;
let baselineDomBg = null;
let baselineRootBg = null;
let restoreScheduled = false;
let baselineCaptured = false;
let restoreFramesLeft = 0;

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

function getView(app) {
  if (!app) return null;
  return app.view || app._view || app.viewer || app._viewer || null;
}

function getRenderer(view) {
  if (!view) return null;
  return view.renderer || view._renderer || null;
}

function getScene(view) {
  if (!view) return null;
  return view.scene || view._scene || null;
}

function getHexSafe(colorObj) {
  try {
    return colorObj && typeof colorObj.getHex === "function" ? colorObj.getHex() : null;
  } catch {
    return null;
  }
}

function setHexSafe(colorObj, hex) {
  if (hex == null) return;
  try {
    if (colorObj && typeof colorObj.setHex === "function") colorObj.setHex(hex);
  } catch {}
}

function snapshotMaterial(m) {
  if (!m || typeof m !== "object" || !m.isMaterial) return;
  if (materialBaseline.has(m)) return;
  materialBaseline.set(m, {
    color: getHexSafe(m.color),
    emissive: getHexSafe(m.emissive),
    opacity: typeof m.opacity === "number" ? m.opacity : null,
    transparent: typeof m.transparent === "boolean" ? m.transparent : null,
    depthWrite: typeof m.depthWrite === "boolean" ? m.depthWrite : null,
    depthTest: typeof m.depthTest === "boolean" ? m.depthTest : null,
    visible: typeof m.visible === "boolean" ? m.visible : null
  });
}

function snapshotObject(o) {
  if (!o || typeof o !== "object") return;
  if (!("material" in o)) return;
  if (objectBaseline.has(o)) return;
  const mat = o.material;
  if (Array.isArray(mat)) mat.forEach(snapshotMaterial);
  else snapshotMaterial(mat);
  objectBaseline.set(o, { material: mat, visible: typeof o.visible === "boolean" ? o.visible : null });
}

function snapshotRendererAndPage(renderer, scene) {
  if (!renderer || typeof renderer !== "object") return;
  if (baselineRendererRef !== renderer) baselineRendererRef = renderer;
  if (baselineSceneRef !== scene) {
    baselineSceneRef = scene;
    baselineSceneState = null;
  }
  try {
    if (scene && baselineSceneState == null) {
      const bg = scene.background ?? null;
      const bgHex = getHexSafe(bg);
      baselineSceneState = {
        background: bg,
        backgroundHex: bgHex,
        environment: scene.environment ?? null,
        fog: scene.fog ?? null
      };
    }
  } catch {
    baselineSceneState = baselineSceneState ?? null;
  }
  try {
    if (baselineRendererState == null || baselineRendererRef !== renderer) {
      const clearColor = renderer && renderer._clearColor ? renderer._clearColor : null;
      baselineRendererState = {
        clearHex: getHexSafe(clearColor),
        clearAlpha:
          typeof renderer.getClearAlpha === "function"
            ? renderer.getClearAlpha()
            : typeof renderer._clearAlpha === "number"
              ? renderer._clearAlpha
              : null,
        toneMappingExposure:
          typeof renderer.toneMappingExposure === "number"
            ? renderer.toneMappingExposure
            : null,
        toneMapping: typeof renderer.toneMapping === "number" ? renderer.toneMapping : null,
        outputColorSpace:
          typeof renderer.outputColorSpace === "string" ? renderer.outputColorSpace : null
      };
    }
  } catch {
    baselineRendererState = baselineRendererState ?? null;
  }
  try {
    const el = renderer && renderer.domElement ? renderer.domElement : null;
    if (el && baselineCanvasStyle == null) {
      const s = el.style || null;
      baselineCanvasStyle = s
        ? {
            backgroundColor: s.backgroundColor ?? null,
            filter: s.filter ?? null,
            opacity: s.opacity ?? null,
            mixBlendMode: s.mixBlendMode ?? null
          }
        : null;
    }
  } catch {
    baselineCanvasStyle = baselineCanvasStyle ?? null;
  }
  try {
    baselineDomBg = document && document.body && document.body.style ? document.body.style.backgroundColor : null;
  } catch {
    baselineDomBg = null;
  }
  try {
    baselineRootBg = document && document.documentElement && document.documentElement.style ? document.documentElement.style.backgroundColor : null;
  } catch {
    baselineRootBg = null;
  }
}

function captureBaseline(app) {
  const view = getView(app);
  const scene = getScene(view);
  const renderer = getRenderer(view);
  if (!isThreeObject(scene) || !renderer) return false;
  if (baselineSceneRef && baselineSceneRef !== scene) {
    baselineCaptured = false;
    baselineSceneState = null;
    baselineRendererState = null;
    baselineCanvasStyle = null;
  }
  ensureUniqueMaterials(scene);
  snapshotRendererAndPage(renderer, scene);
  try {
    scene.traverse((o) => snapshotObject(o));
  } catch {}
  baselineCaptured = true;
  return true;
}

function restoreMaterial(m) {
  const b = materialBaseline.get(m);
  if (!b) return;
  setHexSafe(m.color, b.color);
  setHexSafe(m.emissive, b.emissive);
  try {
    if (b.opacity != null) m.opacity = b.opacity;
  } catch {}
  try {
    if (b.transparent != null) m.transparent = b.transparent;
  } catch {}
  try {
    if (b.depthWrite != null) m.depthWrite = b.depthWrite;
  } catch {}
  try {
    if (b.depthTest != null) m.depthTest = b.depthTest;
  } catch {}
  try {
    if (b.visible != null) m.visible = b.visible;
  } catch {}
  try {
    if (typeof m.needsUpdate === "boolean") m.needsUpdate = true;
  } catch {}
}

function restoreObject(o) {
  const b = objectBaseline.get(o);
  if (!b) return;
  try {
    if (o.material !== b.material) o.material = b.material;
  } catch {}
  const mat = o.material;
  if (Array.isArray(mat)) mat.forEach(restoreMaterial);
  else restoreMaterial(mat);
  try {
    if (b.visible != null) o.visible = b.visible;
  } catch {}
}

function restoreRendererAndPage(app) {
  const view = getView(app);
  const scene = getScene(view);
  const renderer = getRenderer(view);
  if (!renderer) return;
  try {
    if (baselineRendererState) {
      const cc = renderer && renderer._clearColor ? renderer._clearColor : null;
      if (cc && baselineRendererState.clearHex != null) setHexSafe(cc, baselineRendererState.clearHex);
      if (baselineRendererState.clearAlpha != null) {
        if (typeof renderer.setClearAlpha === "function") renderer.setClearAlpha(baselineRendererState.clearAlpha);
        else if (typeof renderer._clearAlpha === "number") renderer._clearAlpha = baselineRendererState.clearAlpha;
      }
      if (baselineRendererState.toneMappingExposure != null && typeof renderer.toneMappingExposure === "number") {
        renderer.toneMappingExposure = baselineRendererState.toneMappingExposure;
      }
      if (baselineRendererState.toneMapping != null && typeof renderer.toneMapping === "number") {
        renderer.toneMapping = baselineRendererState.toneMapping;
      }
      if (
        baselineRendererState.outputColorSpace != null &&
        typeof renderer.outputColorSpace === "string" &&
        renderer.outputColorSpace !== baselineRendererState.outputColorSpace
      ) {
        renderer.outputColorSpace = baselineRendererState.outputColorSpace;
      }
    }
  } catch {}
  try {
    if (scene && baselineSceneRef === scene && baselineSceneState) {
      const bg = baselineSceneState.background;
      const bgHex = baselineSceneState.backgroundHex;
      if (scene.background !== bg) scene.background = bg;
      if (bgHex != null) {
        const curBg = scene.background;
        if (curBg) setHexSafe(curBg, bgHex);
      }
      if (scene.environment !== baselineSceneState.environment) scene.environment = baselineSceneState.environment;
      if (scene.fog !== baselineSceneState.fog) scene.fog = baselineSceneState.fog;
    }
  } catch {}
  try {
    if (baselineCanvasStyle) {
      const el = renderer && renderer.domElement ? renderer.domElement : null;
      const s = el && el.style ? el.style : null;
      if (s) {
        if (baselineCanvasStyle.backgroundColor != null) s.backgroundColor = baselineCanvasStyle.backgroundColor;
        if (baselineCanvasStyle.filter != null) s.filter = baselineCanvasStyle.filter;
        if (baselineCanvasStyle.opacity != null) s.opacity = baselineCanvasStyle.opacity;
        if (baselineCanvasStyle.mixBlendMode != null) s.mixBlendMode = baselineCanvasStyle.mixBlendMode;
      }
    }
  } catch {}
  try {
    if (document && document.body && document.body.style && baselineDomBg != null) document.body.style.backgroundColor = baselineDomBg;
  } catch {}
  try {
    if (document && document.documentElement && document.documentElement.style && baselineRootBg != null) document.documentElement.style.backgroundColor = baselineRootBg;
  } catch {}
}

function restoreBaseline(app) {
  const view = getView(app);
  const scene = getScene(view);
  if (!isThreeObject(scene)) return;
  try {
    scene.traverse((o) => restoreObject(o));
  } catch {}
  restoreRendererAndPage(app);
}

function scheduleRestore(app) {
  if (!baselineCaptured) captureBaseline(app);
  restoreFramesLeft = Math.max(restoreFramesLeft, 18);
  if (restoreScheduled) return;
  restoreScheduled = true;
  const run = () => {
    try {
      restoreBaseline(app);
    } catch {}
  };
  const tick = () => {
    run();
    restoreFramesLeft -= 1;
    if (restoreFramesLeft > 0) {
      requestAnimationFrame(tick);
    } else {
      restoreScheduled = false;
    }
  };
  requestAnimationFrame(tick);
}

function bindSelectionGuard(app) {
  if (!app || app.__revitget_sel_guard_bound) return;
  app.__revitget_sel_guard_bound = true;
  const attach = () => {
    const view = getView(app);
    const renderer = getRenderer(view);
    const el = renderer && renderer.domElement ? renderer.domElement : null;
    const target = el || window;
    const handler = () => scheduleRestore(app);
    try {
      target.addEventListener("pointerdown", handler, { passive: true, capture: true });
      target.addEventListener("pointerup", handler, { passive: true, capture: true });
      target.addEventListener("click", handler, { passive: true, capture: true });
    } catch {}
  };
  attach();
}

function tryPatch() {
  if (patched) return true;
  const root = window.webView ?? window;
  const app = tryGet(root, ["app"]) || tryGet(window, ["app"]);
  if (!app) return false;

  patched = true;
  bindSelectionGuard(app);

  if (typeof app.loadModel === "function" && !app.__revitget_sel_patched) {
    app.__revitget_sel_patched = true;
    const orig = app.loadModel.bind(app);
    app.loadModel = function () {
      const r = orig.apply(this, arguments);
      try {
        captureBaseline(this);
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
    if (app) {
      bindSelectionGuard(app);
      if (!baselineCaptured) captureBaseline(app);
    }
  } catch {}
  requestAnimationFrame(tick);
}
requestAnimationFrame(tick);
