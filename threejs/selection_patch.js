let patched = false;
const processedScenes = new WeakSet();
const objectBaseline = new WeakMap();
const materialBaseline = new WeakMap();
let baselineSceneRef = null;
let baselineSceneState = null;
let baselineRendererRef = null;
let baselineRendererState = null;
let baselineCanvasStyle = null;
let baselineCanvasComputed = null;
let baselineDomBg = null;
let baselineRootBg = null;
let baselineDomComputedBg = null;
let baselineRootComputedBg = null;
let baselineAppComputedBg = null;
let baselineOverlayChain = null;
let restoreScheduled = false;
let baselineCaptured = false;
let restoreFramesLeft = 0;
let baselineClearRGBA = null;
let webglClearHooked = false;
const sanitizedEls = new WeakSet();
let cachedCanvas = null;
let cachedCanvasRect = null;
let canvasCacheFrames = 0;

function hookWebglClearOnce() {
  if (webglClearHooked) return;
  webglClearHooked = true;

  function wrap(Proto) {
    if (!Proto || Proto.__revitget_sel_patched_clearColor) return;
    Proto.__revitget_sel_patched_clearColor = true;
    const origClearColor = typeof Proto.clearColor === "function" ? Proto.clearColor : null;
    const origClear = typeof Proto.clear === "function" ? Proto.clear : null;
    if (origClearColor) {
      Proto.clearColor = function (r, g, b, a) {
        try {
          const f = window.__revitget_force_clear_rgba;
          if (f && typeof f.r === "number" && typeof f.g === "number" && typeof f.b === "number") {
            return origClearColor.call(this, f.r, f.g, f.b, typeof f.a === "number" ? f.a : 1);
          }
        } catch {}
        return origClearColor.call(this, r, g, b, a);
      };
    }
    if (origClear) {
      Proto.clear = function (mask) {
        try {
          const f = window.__revitget_force_clear_rgba;
          const bit = this && this.COLOR_BUFFER_BIT;
          if (f && bit && (mask & bit) && origClearColor) {
            origClearColor.call(this, f.r, f.g, f.b, typeof f.a === "number" ? f.a : 1);
          }
        } catch {}
        return origClear.call(this, mask);
      };
    }
  }

  try {
    wrap(window.WebGLRenderingContext && window.WebGLRenderingContext.prototype);
  } catch {}
  try {
    wrap(window.WebGL2RenderingContext && window.WebGL2RenderingContext.prototype);
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

function getComputedBg(el) {
  if (!el || typeof window.getComputedStyle !== "function") return null;
  try {
    const cs = window.getComputedStyle(el);
    return cs ? cs.backgroundColor ?? null : null;
  } catch {
    return null;
  }
}

function getComputedOverlayStyle(el) {
  if (!el || typeof window.getComputedStyle !== "function") return null;
  try {
    const cs = window.getComputedStyle(el);
    if (!cs) return null;
    return {
      background: cs.background ?? null,
      backgroundColor: cs.backgroundColor ?? null,
      backgroundImage: cs.backgroundImage ?? null,
      filter: cs.filter ?? null,
      backdropFilter: cs.backdropFilter ?? cs.webkitBackdropFilter ?? null,
      mixBlendMode: cs.mixBlendMode ?? null,
      opacity: cs.opacity ?? null
    };
  } catch {
    return null;
  }
}

function setOverlayImportant(el, st) {
  if (!el || !el.style || typeof el.style.setProperty !== "function") return;
  if (!st) return;
  try {
    if (st.background != null) el.style.setProperty("background", st.background, "important");
    if (st.backgroundColor != null) el.style.setProperty("background-color", st.backgroundColor, "important");
    if (st.backgroundImage != null) el.style.setProperty("background-image", st.backgroundImage, "important");
    if (st.filter != null) el.style.setProperty("filter", st.filter, "important");
    if (st.filter != null) el.style.setProperty("-webkit-filter", st.filter, "important");
    if (st.backdropFilter != null) el.style.setProperty("backdrop-filter", st.backdropFilter, "important");
    if (st.backdropFilter != null) el.style.setProperty("-webkit-backdrop-filter", st.backdropFilter, "important");
    if (st.mixBlendMode != null) el.style.setProperty("mix-blend-mode", st.mixBlendMode, "important");
    if (st.opacity != null) el.style.setProperty("opacity", st.opacity, "important");
  } catch {}
}

function setBgImportant(el, color) {
  if (!el || !el.style || typeof el.style.setProperty !== "function") return;
  if (color == null) return;
  try {
    el.style.setProperty("background-color", color, "important");
  } catch {}
}

function buildOverlayChain(renderer) {
  const chain = [];
  try {
    const canvas = renderer && renderer.domElement ? renderer.domElement : null;
    if (canvas) {
      let cur = canvas;
      let depth = 0;
      while (cur && depth < 8) {
        chain.push(cur);
        cur = cur.parentElement || null;
        depth += 1;
      }
    }
  } catch {}
  try {
    const appEl = document && document.getElementById ? document.getElementById("app") : null;
    if (appEl && !chain.includes(appEl)) chain.push(appEl);
  } catch {}
  try {
    if (document && document.body && !chain.includes(document.body)) chain.push(document.body);
  } catch {}
  try {
    if (document && document.documentElement && !chain.includes(document.documentElement)) chain.push(document.documentElement);
  } catch {}
  return chain;
}

function getRectArea(r) {
  if (!r) return 0;
  const w = Math.max(0, r.width || 0);
  const h = Math.max(0, r.height || 0);
  return w * h;
}

function rectNear(a, b, tol = 12) {
  if (!a || !b) return false;
  return (
    Math.abs((a.left || 0) - (b.left || 0)) <= tol &&
    Math.abs((a.top || 0) - (b.top || 0)) <= tol &&
    Math.abs((a.width || 0) - (b.width || 0)) <= tol &&
    Math.abs((a.height || 0) - (b.height || 0)) <= tol
  );
}

function findViewportCanvas(renderer) {
  const el = renderer && renderer.domElement ? renderer.domElement : null;
  if (el && el.tagName === "CANVAS") return el;
  try {
    const appEl = document && document.getElementById ? document.getElementById("app") : null;
    if (!appEl || typeof appEl.querySelectorAll !== "function") return null;
    let best = null;
    let bestArea = 0;
    const canvases = appEl.querySelectorAll("canvas");
    for (let i = 0; i < canvases.length; i++) {
      const c = canvases[i];
      if (!c) continue;
      let r = null;
      try {
        r = c.getBoundingClientRect();
      } catch {
        r = null;
      }
      const area = getRectArea(r);
      if (area > bestArea) {
        best = c;
        bestArea = area;
      }
    }
    return best;
  } catch {
    return null;
  }
}

function sanitizeViewportOverlays(renderer) {
  const canvas = cachedCanvas && canvasCacheFrames > 0 ? cachedCanvas : findViewportCanvas(renderer);
  if (!canvas) return;
  cachedCanvas = canvas;
  canvasCacheFrames = 20;
  let canvasRect = null;
  try {
    canvasRect = canvas.getBoundingClientRect();
  } catch {
    canvasRect = null;
  }
  if (!canvasRect || getRectArea(canvasRect) < 20000) return;
  cachedCanvasRect = canvasRect;

  const appEl = document && document.getElementById ? document.getElementById("app") : null;
  if (!appEl || typeof appEl.querySelectorAll !== "function") return;

  let nodes = [];
  try {
    nodes = appEl.querySelectorAll("*");
  } catch {
    nodes = [];
  }
  const max = Math.min(nodes.length || 0, 3000);
  for (let i = 0; i < max; i++) {
    const el = nodes[i];
    if (!el || el === canvas) continue;
    if (sanitizedEls.has(el)) continue;
    let r = null;
    try {
      r = el.getBoundingClientRect();
    } catch {
      r = null;
    }
    if (!r) continue;
    if (!rectNear(r, canvasRect, 14)) continue;
    let cs = null;
    try {
      cs = window.getComputedStyle ? window.getComputedStyle(el) : null;
    } catch {
      cs = null;
    }
    const bg = cs ? cs.backgroundColor : null;
    const filter = cs ? cs.filter : null;
    const bf = cs ? (cs.backdropFilter ?? cs.webkitBackdropFilter ?? null) : null;
    const hasBg = bg && bg !== "transparent" && bg !== "rgba(0, 0, 0, 0)";
    const hasFilter = filter && filter !== "none";
    const hasBackdrop = bf && bf !== "none";
    if (!hasBg && !hasFilter && !hasBackdrop) continue;
    try {
      if (el.style && typeof el.style.setProperty === "function") {
        el.style.setProperty("background-color", "transparent", "important");
        el.style.setProperty("filter", "none", "important");
        el.style.setProperty("-webkit-filter", "none", "important");
        el.style.setProperty("backdrop-filter", "none", "important");
        el.style.setProperty("-webkit-backdrop-filter", "none", "important");
      }
    } catch {}
    try {
      sanitizedEls.add(el);
    } catch {}
  }
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
    if (baselineClearRGBA == null) {
      let hex = null;
      let alpha = null;
      try {
        const clearColor = renderer && renderer._clearColor ? renderer._clearColor : null;
        hex = getHexSafe(clearColor);
      } catch {
        hex = null;
      }
      try {
        alpha =
          typeof renderer.getClearAlpha === "function"
            ? renderer.getClearAlpha()
            : typeof renderer._clearAlpha === "number"
              ? renderer._clearAlpha
              : null;
      } catch {
        alpha = null;
      }
      if (typeof hex === "number") {
        baselineClearRGBA = {
          r: ((hex >> 16) & 255) / 255,
          g: ((hex >> 8) & 255) / 255,
          b: (hex & 255) / 255,
          a: typeof alpha === "number" ? alpha : 1
        };
        try {
          window.__revitget_force_clear_rgba = baselineClearRGBA;
        } catch {}
      }
    }
  } catch {
    baselineClearRGBA = baselineClearRGBA ?? null;
  }
  try {
    const el = renderer && renderer.domElement ? renderer.domElement : null;
    if (el && baselineCanvasStyle == null) {
      const s = el.style || null;
      baselineCanvasStyle = s
        ? {
            backgroundColor: s.backgroundColor ?? null,
            filter: s.filter ?? null,
            webkitFilter: s.webkitFilter ?? null,
            opacity: s.opacity ?? null,
            mixBlendMode: s.mixBlendMode ?? null
          }
        : null;
    }
  } catch {
    baselineCanvasStyle = baselineCanvasStyle ?? null;
  }
  try {
    const el = renderer && renderer.domElement ? renderer.domElement : null;
    if (el && baselineCanvasComputed == null && typeof window.getComputedStyle === "function") {
      const cs = window.getComputedStyle(el);
      baselineCanvasComputed = cs
        ? {
            filter: cs.filter ?? null,
            opacity: cs.opacity ?? null,
            backgroundColor: cs.backgroundColor ?? null,
            mixBlendMode: cs.mixBlendMode ?? null
          }
        : null;
    }
  } catch {
    baselineCanvasComputed = baselineCanvasComputed ?? null;
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
  try {
    if (baselineDomComputedBg == null) baselineDomComputedBg = getComputedBg(document && document.body ? document.body : null);
  } catch {
    baselineDomComputedBg = baselineDomComputedBg ?? null;
  }
  try {
    if (baselineRootComputedBg == null) baselineRootComputedBg = getComputedBg(document && document.documentElement ? document.documentElement : null);
  } catch {
    baselineRootComputedBg = baselineRootComputedBg ?? null;
  }
  try {
    if (baselineAppComputedBg == null) {
      const appEl = document && document.getElementById ? document.getElementById("app") : null;
      baselineAppComputedBg = getComputedBg(appEl);
    }
  } catch {
    baselineAppComputedBg = baselineAppComputedBg ?? null;
  }
  try {
    if (baselineOverlayChain == null) {
      const chain = buildOverlayChain(renderer);
      baselineOverlayChain = chain.map((el) => ({ el, bg: getComputedBg(el), st: getComputedOverlayStyle(el) }));
    }
  } catch {
    baselineOverlayChain = baselineOverlayChain ?? null;
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
    baselineCanvasComputed = null;
    baselineDomComputedBg = null;
    baselineRootComputedBg = null;
    baselineAppComputedBg = null;
    baselineOverlayChain = null;
  }
  ensureUniqueMaterials(scene);
  hookWebglClearOnce();
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
    if (baselineClearRGBA) window.__revitget_force_clear_rgba = baselineClearRGBA;
  } catch {}
  try {
    if (baselineCanvasStyle) {
      const el = renderer && renderer.domElement ? renderer.domElement : null;
      const s = el && el.style ? el.style : null;
      if (s) {
        if (baselineCanvasStyle.backgroundColor != null) s.backgroundColor = baselineCanvasStyle.backgroundColor;
        if (baselineCanvasStyle.filter != null) s.filter = baselineCanvasStyle.filter;
        if (baselineCanvasStyle.webkitFilter != null) s.webkitFilter = baselineCanvasStyle.webkitFilter;
        if (baselineCanvasStyle.opacity != null) s.opacity = baselineCanvasStyle.opacity;
        if (baselineCanvasStyle.mixBlendMode != null) s.mixBlendMode = baselineCanvasStyle.mixBlendMode;
      }
    }
  } catch {}
  try {
    const el = renderer && renderer.domElement ? renderer.domElement : null;
    if (el && el.style && typeof el.style.setProperty === "function") {
      const f = baselineCanvasComputed ? baselineCanvasComputed.filter : null;
      const o = baselineCanvasComputed ? baselineCanvasComputed.opacity : null;
      const bg = baselineCanvasComputed ? baselineCanvasComputed.backgroundColor : null;
      const mb = baselineCanvasComputed ? baselineCanvasComputed.mixBlendMode : null;

      el.style.setProperty("filter", f != null ? f : "none", "important");
      el.style.setProperty("-webkit-filter", f != null ? f : "none", "important");
      if (o != null) el.style.setProperty("opacity", o, "important");
      if (bg != null) el.style.setProperty("background-color", bg, "important");
      if (mb != null) el.style.setProperty("mix-blend-mode", mb, "important");
    }
  } catch {}
  try {
    if (document && document.body && document.body.style && baselineDomBg != null) document.body.style.backgroundColor = baselineDomBg;
  } catch {}
  try {
    if (document && document.documentElement && document.documentElement.style && baselineRootBg != null) document.documentElement.style.backgroundColor = baselineRootBg;
  } catch {}
  try {
    if (baselineDomComputedBg != null && document && document.body) setBgImportant(document.body, baselineDomComputedBg);
  } catch {}
  try {
    if (baselineRootComputedBg != null && document && document.documentElement) setBgImportant(document.documentElement, baselineRootComputedBg);
  } catch {}
  try {
    if (baselineAppComputedBg != null && document && document.getElementById) {
      const appEl = document.getElementById("app");
      if (appEl) setBgImportant(appEl, baselineAppComputedBg);
    }
  } catch {}
  try {
    if (baselineOverlayChain && baselineOverlayChain.length) {
      for (const item of baselineOverlayChain) {
        const el = item && item.el ? item.el : null;
        const bg = item ? item.bg : null;
        const st = item ? item.st : null;
        if (el) {
          if (st) setOverlayImportant(el, st);
          else if (bg != null) setBgImportant(el, bg);
        }
      }
    }
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
    try {
      const view = getView(app);
      const renderer = getRenderer(view);
      if (renderer) sanitizeViewportOverlays(renderer);
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

let threeModPromise = null;
let threeMod = null;
let pickBound = false;
let downX = 0;
let downY = 0;
let downT = 0;
let moved = false;
let highlightedObj = null;
const originalMaterialByObject = new WeakMap();
const HIGHLIGHT_HEX = 0xffa500;

function loadThree() {
  if (threeMod) return Promise.resolve(threeMod);
  if (threeModPromise) return threeModPromise;
  threeModPromise = import("./assets/three@0.172.0-D3jjpEWA.js")
    .then((m) => {
      threeMod = m;
      return m;
    })
    .catch(() => null);
  return threeModPromise;
}

function isPickable(o) {
  if (!o || typeof o !== "object") return false;
  if (o.isMesh) return true;
  if (o.isLineSegments || o.isLine) return true;
  if (o.isPoints) return true;
  return false;
}

function restoreHighlight() {
  if (!highlightedObj) return;
  const orig = originalMaterialByObject.get(highlightedObj);
  if (orig) {
    try {
      highlightedObj.material = orig;
    } catch {}
  }
  highlightedObj = null;
}

function applyHighlight(obj) {
  if (!obj) return;
  if (highlightedObj === obj) return;
  restoreHighlight();
  try {
    if (!originalMaterialByObject.has(obj)) {
      originalMaterialByObject.set(obj, obj.material);
    }
  } catch {}
  const mat = obj.material;
  const make = (m) => {
    if (!m || typeof m !== "object" || !m.isMaterial) return m;
    let c = null;
    try {
      c = m.clone();
    } catch {
      c = m;
    }
    try {
      if (c.emissive && typeof c.emissive.setHex === "function") {
        c.emissive.setHex(HIGHLIGHT_HEX);
        if (typeof c.emissiveIntensity === "number") c.emissiveIntensity = Math.max(1, c.emissiveIntensity);
      } else if (c.color && typeof c.color.setHex === "function") {
        c.color.setHex(HIGHLIGHT_HEX);
      }
    } catch {}
    try {
      c.needsUpdate = true;
    } catch {}
    return c;
  };
  try {
    if (Array.isArray(mat)) obj.material = mat.map(make);
    else obj.material = make(mat);
  } catch {}
  highlightedObj = obj;
}

async function pickAndHighlight(app, clientX, clientY) {
  const view = getView(app);
  const scene = getScene(view);
  const camera = view && (view.camera || view._camera || null);
  const renderer = getRenderer(view);
  if (!scene || !camera || !renderer) return;
  const three = await loadThree();
  if (!three || !three.Raycaster || !three.Vector2) return;
  const canvas = renderer.domElement;
  if (!canvas || typeof canvas.getBoundingClientRect !== "function") return;
  const rect = canvas.getBoundingClientRect();
  const x = ((clientX - rect.left) / rect.width) * 2 - 1;
  const y = -(((clientY - rect.top) / rect.height) * 2 - 1);
  const raycaster = new three.Raycaster();
  raycaster.setFromCamera(new three.Vector2(x, y), camera);
  let intersects = [];
  try {
    intersects = raycaster.intersectObjects(scene.children || [], true) || [];
  } catch {
    intersects = [];
  }
  let hit = null;
  for (const it of intersects) {
    const o = it && it.object ? it.object : null;
    if (isPickable(o)) {
      hit = o;
      break;
    }
  }
  if (hit) applyHighlight(hit);
  else restoreHighlight();
}

function bindSelectionGuard(app) {
  if (!app || app.__revitget_sel_guard_bound) return;
  app.__revitget_sel_guard_bound = true;
  const view = getView(app);
  const renderer = getRenderer(view);
  const el = renderer && renderer.domElement ? renderer.domElement : null;
  const target = el || window;

  if (!pickBound) {
    pickBound = true;
    try {
      target.addEventListener(
        "pointerdown",
        (e) => {
          try {
            downX = e.clientX || 0;
            downY = e.clientY || 0;
            downT = Date.now();
            moved = false;
          } catch {}
        },
        { capture: true }
      );
      target.addEventListener(
        "pointermove",
        (e) => {
          try {
            const dx = (e.clientX || 0) - downX;
            const dy = (e.clientY || 0) - downY;
            if (dx * dx + dy * dy > 25) moved = true;
          } catch {}
        },
        { capture: true, passive: true }
      );
      target.addEventListener(
        "pointerup",
        async (e) => {
          try {
            const dt = Date.now() - downT;
            if (moved || dt > 350) return;
            if (e.button != null && e.button !== 0) return;
            if (e.ctrlKey || e.metaKey || e.altKey) return;
            e.stopImmediatePropagation();
            e.stopPropagation();
            e.preventDefault();
            await pickAndHighlight(app, e.clientX, e.clientY);
          } catch {}
        },
        { capture: true }
      );
      target.addEventListener(
        "click",
        (e) => {
          try {
            e.stopImmediatePropagation();
            e.stopPropagation();
            e.preventDefault();
          } catch {}
        },
        { capture: true }
      );
    } catch {}
  }
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
      if (baselineCaptured) {
        const view = getView(app);
        const scene = getScene(view);
        const renderer = getRenderer(view);
        try {
          if (canvasCacheFrames > 0) canvasCacheFrames -= 1;
        } catch {}
        try {
          if (baselineClearRGBA) window.__revitget_force_clear_rgba = baselineClearRGBA;
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
          if (renderer && baselineRendererState) {
            if (baselineRendererState.toneMappingExposure != null && typeof renderer.toneMappingExposure === "number") {
              renderer.toneMappingExposure = baselineRendererState.toneMappingExposure;
            }
            if (baselineRendererState.toneMapping != null && typeof renderer.toneMapping === "number") {
              renderer.toneMapping = baselineRendererState.toneMapping;
            }
          }
        } catch {}
        try {
          if (renderer) sanitizeViewportOverlays(renderer);
        } catch {}
      }
    }
  } catch {}
  requestAnimationFrame(tick);
}
requestAnimationFrame(tick);
