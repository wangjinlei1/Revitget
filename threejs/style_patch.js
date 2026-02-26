
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
  const RE_NO_BATCH = params && (params.get("nobatch") === "1" || params.get("revitget_batch") === "0");
  const BATCH_MAX_MESHES = params && params.get("batch_max_meshes") ? Math.max(0, parseInt(params.get("batch_max_meshes"), 10) || 0) : 15000;
  const BATCH_MAX_NODES = params && params.get("batch_max_nodes") ? Math.max(0, parseInt(params.get("batch_max_nodes"), 10) || 0) : 60000;
  try {
    window.__revitget_flags = { patchOff: false, noBatch: !!RE_NO_BATCH, batchMaxMeshes: BATCH_MAX_MESHES, batchMaxNodes: BATCH_MAX_NODES };
  } catch {}

  const LIGHT_BG_COLOR = 0xf2f3f5;
  const DARK_BG_COLOR = 0x050713;
  const objectUrlToExt = new Map();
  const LIGHT_GL = { r: 242 / 255, g: 243 / 255, b: 245 / 255, a: 1 };
  if (typeof window.__revitget_last_model_ext !== "string") window.__revitget_last_model_ext = "";
  if (typeof window.__revitget_force_glb_light_bg !== "boolean") window.__revitget_force_glb_light_bg = false;

  (function patchCreateObjectURL() {
    const U = window.URL || window.webkitURL;
    if (!U || typeof U.createObjectURL !== "function") return;
    if (U.__revitget_patched_createObjectURL) return;
    U.__revitget_patched_createObjectURL = true;
    const orig = U.createObjectURL.bind(U);
    U.createObjectURL = function (obj) {
      const url = orig(obj);
      try {
        const name = obj && typeof obj === "object" ? obj.name : "";
        const ext = getUrlExt(name);
        if (ext) {
          objectUrlToExt.set(url, ext);
          window.__revitget_last_model_ext = ext;
        }
      } catch {}
      return url;
    };
  })();

  function applyPageBg(isGlb) {
    const c = isGlb ? "#f2f3f5" : "";
    try {
      if (document && document.documentElement && document.documentElement.style) {
        document.documentElement.style.backgroundColor = c;
      }
    } catch {}
    try {
      if (document && document.body && document.body.style) {
        document.body.style.backgroundColor = c;
      }
    } catch {}
    try {
      const appEl = document && document.getElementById && document.getElementById("app");
      if (appEl && appEl.style) appEl.style.backgroundColor = c;
    } catch {}
  }

  (function patchWebGLClearColor() {
    if (window.__revitget_patched_gl_clearColor) return;
    window.__revitget_patched_gl_clearColor = true;

    function wrapProto(Proto) {
      if (!Proto) return;
      if (Proto.__revitget_patched_clearColor) return;
      Proto.__revitget_patched_clearColor = true;
      const origClearColor = typeof Proto.clearColor === "function" ? Proto.clearColor : null;
      const origClear = typeof Proto.clear === "function" ? Proto.clear : null;
      if (origClearColor) {
        Proto.clearColor = function (r, g, b, a) {
          try {
            if (window.__revitget_force_glb_light_bg) {
              return origClearColor.call(this, LIGHT_GL.r, LIGHT_GL.g, LIGHT_GL.b, LIGHT_GL.a);
            }
          } catch {}
          return origClearColor.call(this, r, g, b, a);
        };
      }
      if (origClear) {
        Proto.clear = function (mask) {
          try {
            if (window.__revitget_force_glb_light_bg) {
              const bit = this && this.COLOR_BUFFER_BIT;
              if (bit && (mask & bit)) {
                if (origClearColor) origClearColor.call(this, LIGHT_GL.r, LIGHT_GL.g, LIGHT_GL.b, LIGHT_GL.a);
              }
            }
          } catch {}
          return origClear.call(this, mask);
        };
      }
    }

    try {
      wrapProto(window.WebGLRenderingContext && window.WebGLRenderingContext.prototype);
    } catch {}
    try {
      wrapProto(window.WebGL2RenderingContext && window.WebGL2RenderingContext.prototype);
    } catch {}
  })();

  function setActiveExt(ext) {
    const e = String(ext || "").toLowerCase();
    if (e) window.__revitget_last_model_ext = e;
    window.__revitget_force_glb_light_bg = window.__revitget_last_model_ext === "glb";
    applyPageBg(window.__revitget_force_glb_light_bg);
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
        const ext = getAnyExt(
          cfg && cfg.url,
          cfg && cfg.fileName,
          cfg && cfg.name,
          cfg && cfg.file && cfg.file.name,
          cfg && cfg.blob && cfg.blob.name
        );
        if (ext) setActiveExt(ext);
      } catch {}
      return original(cfg, ...rest);
    };
  }

  function getActiveExt(app) {
    try {
      const doc = app.activeDocument || app._activeDocument || null;
      if (!doc) return "";
      const url = doc.url || doc._url || "";
      const mapped = objectUrlToExt.get(url);
      return getAnyExt(url, mapped, doc.fileName, doc._fileName, doc.name, doc._name);
    } catch {
      return "";
    }
  }

  function patchFormatButtons() {
    if (window.__revitget_format_btn_patched) return;
    window.__revitget_format_btn_patched = true;
    document.addEventListener(
      "click",
      (e) => {
        const t = e.target;
        if (!t) return;
        const el = t.closest ? t.closest("button,a") : null;
        const text = String((el && el.textContent) || "").trim().toLowerCase();
        if (!text) return;
        if (text.includes("glb")) setActiveExt("glb");
        else if (text.includes("gltf")) setActiveExt("gltf");
        else if (text.includes("ifc")) setActiveExt("ifc");
        else if (text.includes("fbx")) setActiveExt("fbx");
        else if (text.includes("rhino") || text.includes("3dm")) setActiveExt("3dm");
        else if (text.includes("dwg") || text.includes("dxf")) setActiveExt("dwg");
        else if (text.includes("3dtiles") || text.includes("tiles")) setActiveExt("tiles");
      },
      { passive: true, capture: true }
    );
  }

  function patchFileInputs() {
    if (window.__revitget_file_input_patched) return;
    window.__revitget_file_input_patched = true;
    document.addEventListener(
      "change",
      (e) => {
        const t = e.target;
        if (!t || !t.files || !t.files.length) return;
        const file = t.files[0];
        const ext = getUrlExt(file && file.name);
        if (ext) setActiveExt(ext);
      },
      { passive: true, capture: true }
    );
    document.addEventListener(
      "drop",
      (e) => {
        try {
          const dt = e.dataTransfer;
          if (!dt || !dt.files || !dt.files.length) return;
          const file = dt.files[0];
          const ext = getUrlExt(file && file.name);
          if (ext) setActiveExt(ext);
        } catch {}
      },
      { passive: true, capture: true }
    );
  }

  function ensureRendererGuard(renderer) {
    if (!renderer || typeof renderer.setClearColor !== "function") return;
    if (renderer.__revitget_patched_setClearColor) return;
    renderer.__revitget_patched_setClearColor = true;
    const orig = renderer.setClearColor.bind(renderer);
    renderer.setClearColor = function (color, alpha) {
      try {
        if (typeof renderer.__revitget_force_clear === "number") {
          return orig(renderer.__revitget_force_clear, 1);
        }
      } catch {}
      return orig(color, alpha);
    };
  }

  function isAppCandidate(o) {
    if (!o || typeof o !== "object") return false;
    if (typeof o.loadModel !== "function") return false;
    let v = null;
    try {
      v = o.view || o._view || o.viewer || null;
    } catch {
      v = null;
    }
    if (!v || typeof v !== "object") return false;
    try {
      const r = v.renderer || v._renderer || null;
      const s = v.scene || v._scene || null;
      return !!(r || s);
    } catch {
      return false;
    }
  }

  function deepFind(root, predicate, maxDepth = 7, maxNodes = 4000) {
    if (!root || typeof root !== "object") return null;
    const visited = new WeakSet();
    const queue = [{ value: root, depth: 0 }];
    let nodes = 0;
    while (queue.length) {
      const cur = queue.shift();
      const value = cur.value;
      const depth = cur.depth;
      if (!value || typeof value !== "object") continue;
      if (visited.has(value)) continue;
      visited.add(value);
      try {
        if (predicate(value)) return value;
      } catch {}
      if (depth >= maxDepth) continue;
      nodes += 1;
      if (nodes > maxNodes) return null;
      let keys = [];
      try {
        keys = Object.getOwnPropertyNames(value);
      } catch {
        keys = [];
      }
      for (const k of keys) {
        let child = null;
        try {
          child = value[k];
        } catch {
          continue;
        }
        if (child && typeof child === "object") {
          queue.push({ value: child, depth: depth + 1 });
        }
      }
    }
    return null;
  }

  function patchBatchAndInstance() {
    if (window.__revitget_batch_patched) return true;
    const cand = deepFind(
      window,
      (o) => o && typeof o === "object" && typeof o.BatchAndInstance === "function",
      6,
      25000
    );
    if (!cand) return false;
    const orig = cand.BatchAndInstance;
    if (orig && orig.__revitget_wrapped) {
      window.__revitget_batch_patched = true;
      return true;
    }
    function countScene(scene) {
      let nodes = 0;
      let meshes = 0;
      const stack = [];
      stack.push(scene);
      while (stack.length && nodes <= BATCH_MAX_NODES && meshes <= BATCH_MAX_MESHES) {
        const n = stack.pop();
        if (!n || typeof n !== "object") continue;
        nodes += 1;
        try {
          if (n.isMesh || n.isSkinnedMesh || n.isInstancedMesh) meshes += 1;
        } catch {}
        try {
          const ch = n.children;
          if (ch && ch.length) {
            for (let i = 0; i < ch.length; i++) stack.push(ch[i]);
          }
        } catch {}
      }
      return { nodes, meshes };
    }
    const wrapped = function (scene, doc) {
      const dbg = (window.__revitget_dbg = window.__revitget_dbg || {});
      try {
        dbg.batch = dbg.batch || {};
        dbg.batch.ts = Date.now();
      } catch {}
      if (RE_NO_BATCH) {
        try {
          dbg.batch.skip = true;
          dbg.batch.reason = "param";
        } catch {}
        return;
      }
      let stats = null;
      try {
        stats = scene ? countScene(scene) : null;
      } catch {
        stats = null;
      }
      if (stats && (stats.nodes > BATCH_MAX_NODES || stats.meshes > BATCH_MAX_MESHES)) {
        try {
          dbg.batch.skip = true;
          dbg.batch.reason = "too_big";
          dbg.batch.nodes = stats.nodes;
          dbg.batch.meshes = stats.meshes;
        } catch {}
        return;
      }
      try {
        dbg.batch.skip = false;
        dbg.batch.reason = "run";
        if (stats) {
          dbg.batch.nodes = stats.nodes;
          dbg.batch.meshes = stats.meshes;
        }
      } catch {}
      return orig.call(this, scene, doc);
    };
    wrapped.__revitget_wrapped = true;
    try {
      cand.BatchAndInstance = wrapped;
      window.__revitget_batch_patched = true;
      window.__revitget_batch_utils = cand;
      return true;
    } catch {
      return false;
    }
  }

  function getVueProxy() {
    const el = document.getElementById("app");
    if (!el) return null;
    try {
      const vueApp = el.__vue_app__ || el.__vue_app || null;
      const inst = vueApp && (vueApp._instance || vueApp._container?._vnode?.component || null);
      const proxy = inst && inst.proxy;
      if (proxy) return proxy;
    } catch {}
    try {
      const pc = el.__vueParentComponent || null;
      const proxy = pc && pc.proxy;
      if (proxy) return proxy;
    } catch {}
    return null;
  }

  function resolveApp() {
    if (window.__revitget_app && isAppCandidate(window.__revitget_app)) return window.__revitget_app;
    const direct = tryGet(window, ["app"]);
    if (direct && isAppCandidate(direct)) {
      window.__revitget_app = direct;
      return direct;
    }
    const vueProxy = getVueProxy();
    if (vueProxy) {
      const found = deepFind(vueProxy, isAppCandidate, 8, 6000);
      if (found) {
        window.__revitget_app = found;
        return found;
      }
    }
    if (!window.__revitget_app_global_search_done) {
      window.__revitget_app_global_search_done = true;
      try {
        const found = deepFind(window, isAppCandidate, 5, 25000);
        if (found) {
          window.__revitget_app = found;
          return found;
        }
      } catch {}
    }
    return null;
  }

  function isRendererCandidate(r) {
    if (!r || typeof r !== "object") return false;
    if (typeof r.setClearColor !== "function") return false;
    const canvas = r.domElement || null;
    return !!(canvas && canvas.tagName === "CANVAS");
  }

  function resolveView(app) {
    try {
      return app.view || app._view || app.viewer || null;
    } catch {
      return null;
    }
  }

  function resolveRenderer(app, view) {
    try {
      const r = (view && (view.renderer || view._renderer)) || null;
      if (isRendererCandidate(r)) return r;
    } catch {}
    const foundInView = view ? deepFind(view, isRendererCandidate, 7, 5000) : null;
    if (foundInView) return foundInView;
    return app ? deepFind(app, isRendererCandidate, 8, 7000) : null;
  }

  function isThreeRenderer(r) {
    if (!r || typeof r !== "object") return false;
    const canvas = r.domElement || null;
    if (!(canvas && canvas.tagName === "CANVAS")) return false;
    if (typeof r.render !== "function") return false;
    return true;
  }

  function findRendererGlobal() {
    try {
      return deepFind(window, isThreeRenderer, 5, 25000);
    } catch {
      return null;
    }
  }

  const meshOrigMat = new WeakMap();
  const matVariantCache = new WeakMap();
  let __revitget_tune_ver = 1;

  function nodeNameChain(node, maxUp = 3) {
    let out = "";
    let cur = node;
    let i = 0;
    while (cur && i < maxUp) {
      const n = cur && cur.name ? String(cur.name) : "";
      if (n) out += " " + n;
      cur = cur.parent || null;
      i += 1;
    }
    return out.trim().toLowerCase();
  }

  function classifyMesh(node) {
    const n = nodeNameChain(node, 4);
    if (!n) return "";
    if (
      n.includes("steel") ||
      n.includes("metal") ||
      n.includes("stainless") ||
      n.includes("rebar") ||
      n.includes("beam") ||
      n.includes("girder") ||
      n.includes("pipe") ||
      n.includes("duct") ||
      n.includes("不锈") ||
      n.includes("金属") ||
      n.includes("钢") ||
      n.includes("梁") ||
      n.includes("筋")
    ) {
      return "metal";
    }
    if (
      n.includes("concrete") ||
      n.includes("cement") ||
      n.includes("slab") ||
      n.includes("wall") ||
      n.includes("floor") ||
      n.includes("foundation") ||
      n.includes("混凝土") ||
      n.includes("砼") ||
      n.includes("楼板") ||
      n.includes("墙") ||
      n.includes("基础")
    ) {
      return "concrete";
    }
    return "";
  }

  function getMeshOrigMaterial(mesh) {
    if (!mesh) return null;
    if (meshOrigMat.has(mesh)) return meshOrigMat.get(mesh);
    try {
      const cur = mesh.material;
      if (cur) meshOrigMat.set(mesh, cur);
      return cur || null;
    } catch {
      return null;
    }
  }

  function getMaterialVariant(origMat, type) {
    if (!origMat || typeof origMat !== "object") return origMat;
    if (!type) return origMat;
    let rec = matVariantCache.get(origMat);
    if (!rec) {
      rec = {};
      matVariantCache.set(origMat, rec);
    }
    if (rec[type]) return rec[type];
    let cloned = origMat;
    try {
      if (typeof origMat.clone === "function") cloned = origMat.clone();
    } catch {}
    try {
      tuneOneMaterial(cloned, type);
    } catch {}
    rec[type] = cloned;
    return cloned;
  }

  function geomHeuristicType(mesh) {
    try {
      const g = mesh && mesh.geometry;
      if (!g || typeof g !== "object") return "";
      if (!g.boundingBox && typeof g.computeBoundingBox === "function") g.computeBoundingBox();
      const bb = g.boundingBox;
      if (!bb || !bb.min || !bb.max) return "";
      const dx = Math.abs(bb.max.x - bb.min.x);
      const dy = Math.abs(bb.max.y - bb.min.y);
      const dz = Math.abs(bb.max.z - bb.min.z);
      const max = Math.max(dx, dy, dz);
      const min = Math.min(dx, dy, dz);
      if (!isFinite(max) || max <= 0) return "";
      const ratio = min / max;
      if (ratio < 0.08) return "metal";
      return "concrete";
    } catch {
      return "";
    }
  }

  function tuneMeshMaterials(mesh) {
    if (!mesh || typeof mesh !== "object") return;
    if (!mesh.material) return;
    if (mesh.__revitget_tuned_ver === __revitget_tune_ver) return;
    const forced = classifyMesh(mesh);
    const heuristicForMesh = forced ? "" : geomHeuristicType(mesh);
    const origMat = getMeshOrigMaterial(mesh) || mesh.material;
    const mats = Array.isArray(origMat) ? origMat : [origMat];
    const out = [];
    for (const m of mats) {
      if (!m) {
        out.push(m);
        continue;
      }
      const mName = String(m && m.name ? m.name : "").trim().toLowerCase();
      const hinted = forced || classifyMaterial(m);
      const byParams = (typeof m.metalness === "number" && m.metalness > 0.6) || mName.includes("metal") ? "metal" : "";
      const type = hinted || byParams || heuristicForMesh || "concrete";
      const needVariant = !!(forced || heuristicForMesh);
      out.push(needVariant ? getMaterialVariant(m, type) : (tuneOneMaterial(m, type), m));
    }
    try {
      mesh.material = Array.isArray(origMat) ? out : out[0];
    } catch {}
    try {
      mesh.__revitget_tuned_ver = __revitget_tune_ver;
    } catch {}
  }

  function applyMaterialTuningFromScene(scene) {
    if (!scene || typeof scene !== "object" || typeof scene.traverse !== "function") return;
    scene.traverse((node) => {
      if (!node) return;
      if (node.isMesh || node.isSkinnedMesh || node.isInstancedMesh) {
        tuneMeshMaterials(node);
      }
    });
  }

  function applyMaterialTuningFromSceneAsync(scene) {
    if (!scene || typeof scene !== "object") return;
    if (scene.__revitget_tuning_ver === __revitget_tune_ver) return;
    if (scene.__revitget_tuning_inflight) return;
    scene.__revitget_tuning_inflight = true;
    const stack = [scene];
    const step = (deadline) => {
      let iter = 0;
      while (stack.length) {
        let node = null;
        try {
          node = stack.pop();
        } catch {
          break;
        }
        if (!node) continue;
        try {
          const ch = node.children;
          if (ch && ch.length) {
            for (let i = 0; i < ch.length; i++) stack.push(ch[i]);
          }
        } catch {}
        try {
          if (node.isMesh || node.isSkinnedMesh || node.isInstancedMesh) tuneMeshMaterials(node);
        } catch {}
        iter++;
        if (deadline && typeof deadline.timeRemaining === "function") {
          if (iter >= 350 && deadline.timeRemaining() < 4) break;
        } else if (iter >= 350) {
          break;
        }
      }
      if (stack.length) {
        if (typeof requestIdleCallback === "function") requestIdleCallback(step, { timeout: 800 });
        else setTimeout(() => step(null), 0);
      } else {
        scene.__revitget_tuning_inflight = false;
        scene.__revitget_tuning_ver = __revitget_tune_ver;
      }
    };
    if (typeof requestIdleCallback === "function") requestIdleCallback(step, { timeout: 800 });
    else setTimeout(() => step(null), 0);
  }

  function restoreMaterialTuningFromScene(scene) {
    if (!scene || typeof scene !== "object" || typeof scene.traverse !== "function") return;
    scene.traverse((node) => {
      if (!node || !meshOrigMat.has(node)) return;
      try {
        node.material = meshOrigMat.get(node);
      } catch {}
    });
    __revitget_tune_ver += 1;
    try {
      matVariantCache && matVariantCache.clear && matVariantCache.clear();
    } catch {}
  }

  function patchRendererRender(renderer) {
    if (!renderer || renderer.__revitget_patched_render) return;
    if (typeof renderer.render !== "function") return;
    renderer.__revitget_patched_render = true;
    const orig = renderer.render.bind(renderer);
    renderer.render = function (scene, camera) {
      try {
        window.__revitget_dbg = window.__revitget_dbg || {};
        window.__revitget_dbg.renderer = renderer;
        window.__revitget_dbg.scene = scene || null;
        window.__revitget_dbg.camera = camera || null;
        if (scene && !window.__revitget_dbg.materials) window.__revitget_dbg.materials = collectMaterials({ root: scene }, scene, 120);
      } catch {}
      try {
        if (window.__revitget_force_glb_light_bg && scene) {
          applyMaterialTuningFromSceneAsync(scene);
        }
      } catch {}
      return orig(scene, camera);
    };
  }

  function ensureRendererHooked() {
    if (window.__revitget_renderer_hooked) return;
    const r = findRendererGlobal();
    if (!r) return;
    window.__revitget_renderer_hooked = true;
    patchRendererRender(r);
    try {
      window.__revitget_dbg = window.__revitget_dbg || {};
      window.__revitget_dbg.renderer = r;
    } catch {}
  }

  function applyGlbEnvTuning(app) {
    if (!app || typeof app.setEmviormentParameter !== "function") return;
    const keys = ["roughnessPower", "radianceIntensity", "envPower", "smoothingPower"];
    if (!window.__revitget_env_orig) {
      const orig = {};
      for (const k of keys) {
        try {
          if (typeof app.getEmviormentParameter === "function") orig[k] = app.getEmviormentParameter(k);
        } catch {}
      }
      window.__revitget_env_orig = orig;
    }
    try {
      app.setEmviormentParameter("roughnessPower", 1.0);
    } catch {}
    try {
      app.setEmviormentParameter("radianceIntensity", 0.5);
    } catch {}
    try {
      app.setEmviormentParameter("envPower", 0.6);
    } catch {}
    try {
      app.setEmviormentParameter("smoothingPower", 0.6);
    } catch {}
  }

  function restoreEnvTuning(app) {
    const orig = window.__revitget_env_orig;
    if (!orig || !app || typeof app.setEmviormentParameter !== "function") return;
    for (const k of Object.keys(orig)) {
      try {
        if (orig[k] !== undefined) app.setEmviormentParameter(k, orig[k]);
      } catch {}
    }
  }

  function classifyMaterial(mat) {
    const n = String(mat && mat.name ? mat.name : "").toLowerCase();
    if (!n) return "";
    if (n.includes("concrete") || n.includes("cement") || n.includes("混凝土") || n.includes("砼")) return "concrete";
    if (
      n.includes("steel") ||
      n.includes("metal") ||
      n.includes("stainless") ||
      n.includes("aluminum") ||
      n.includes("铝") ||
      n.includes("不锈") ||
      n.includes("金属") ||
      n.includes("钢")
    ) {
      return "metal";
    }
    return "";
  }

  const materialOrig = new WeakMap();

  function tuneOneMaterial(mat, forcedType) {
    if (!mat || typeof mat !== "object") return;
    const hasPbr = "roughness" in mat || "metalness" in mat || "envMapIntensity" in mat;
    const hasPhong = "shininess" in mat || "specular" in mat || "reflectivity" in mat;
    if (!hasPbr && !hasPhong) return;
    if (!materialOrig.has(mat)) {
      let colorHex = null;
      try {
        if (mat.color && typeof mat.color.getHex === "function") colorHex = mat.color.getHex();
      } catch {}
      materialOrig.set(mat, {
        roughness: mat.roughness,
        metalness: mat.metalness,
        envMapIntensity: mat.envMapIntensity,
        clearcoat: mat.clearcoat,
        clearcoatRoughness: mat.clearcoatRoughness,
        sheen: mat.sheen,
        sheenRoughness: mat.sheenRoughness,
        specularIntensity: mat.specularIntensity,
        shininess: mat.shininess,
        reflectivity: mat.reflectivity,
        colorHex
      });
    }
    const type = forcedType || classifyMaterial(mat);
    const metalness = typeof mat.metalness === "number" ? mat.metalness : 0;
    const roughness = typeof mat.roughness === "number" ? mat.roughness : 1;
    const env = typeof mat.envMapIntensity === "number" ? mat.envMapIntensity : 1;

    if (type === "concrete") {
      mat.metalness = 0;
      mat.roughness = 1.0;
      mat.envMapIntensity = Math.min(env, 0.12);
      if ("clearcoat" in mat) mat.clearcoat = 0;
      if ("clearcoatRoughness" in mat) mat.clearcoatRoughness = 1.0;
      if ("sheen" in mat) mat.sheen = 0;
      if ("sheenRoughness" in mat) mat.sheenRoughness = 1.0;
      if ("specularIntensity" in mat) mat.specularIntensity = Math.min(typeof mat.specularIntensity === "number" ? mat.specularIntensity : 1, 0.2);
      if ("shininess" in mat) mat.shininess = 0;
      if ("reflectivity" in mat) mat.reflectivity = 0;
      try {
        if (mat.specular && typeof mat.specular.setRGB === "function") mat.specular.setRGB(0, 0, 0);
      } catch {}
      try {
        if (mat.color && typeof mat.color.getHex === "function") {
          const hex = mat.color.getHex();
          const r = ((hex >> 16) & 255) / 255;
          const g = ((hex >> 8) & 255) / 255;
          const b = (hex & 255) / 255;
          const l = 0.2126 * r + 0.7152 * g + 0.0722 * b;
          if (l < 0.18 && typeof mat.color.setHex === "function") mat.color.setHex(0xbfc3c7);
        }
      } catch {}
    } else if (type === "metal" || metalness > 0.6) {
      mat.metalness = Math.max(metalness, 0.9);
      mat.roughness = Math.min(roughness, 0.35);
      mat.envMapIntensity = Math.max(env, 0.9);
      if ("shininess" in mat) mat.shininess = Math.max(typeof mat.shininess === "number" ? mat.shininess : 30, 30);
    } else {
      mat.metalness = Math.min(metalness, 0.1);
      mat.roughness = Math.max(roughness, 0.85);
      mat.envMapIntensity = Math.min(env, 0.4);
      if ("shininess" in mat) mat.shininess = Math.min(typeof mat.shininess === "number" ? mat.shininess : 10, 10);
    }
    try {
      mat.needsUpdate = true;
    } catch {}
  }

  function traverseMaterials(root, fn) {
    if (!root || typeof root !== "object") return;
    const visit = (node) => {
      if (!node || typeof node !== "object") return;
      const mat = node.material;
      if (Array.isArray(mat)) {
        for (const m of mat) fn(m);
      } else if (mat) {
        fn(mat);
      }
    };
    if (typeof root.traverse === "function") {
      root.traverse(visit);
    } else {
      visit(root);
    }
  }

  function collectMaterials(view, scene, limit = 80) {
    const root = (view && (view.root || view._root)) || scene;
    if (!root || typeof root !== "object") return [];
    const map = new Map();
    traverseMaterials(root, (m) => {
      if (!m || typeof m !== "object") return;
      const name = (m.name && String(m.name).trim()) || "(no-name)";
      const type = m.type || "";
      const key = name + "|" + type;
      const rec = map.get(key) || {
        name,
        type,
        count: 0,
        metalness: typeof m.metalness === "number" ? m.metalness : null,
        roughness: typeof m.roughness === "number" ? m.roughness : null,
        envMapIntensity: typeof m.envMapIntensity === "number" ? m.envMapIntensity : null
      };
      rec.count += 1;
      map.set(key, rec);
    });
    return [...map.values()].sort((a, b) => b.count - a.count).slice(0, limit);
  }

  function applyMaterialTuning(view, scene) {
    const root = (view && (view.root || view._root)) || scene;
    traverseMaterials(root, tuneOneMaterial);
  }

  function restoreMaterialTuning(view, scene) {
    const root = (view && (view.root || view._root)) || scene;
    traverseMaterials(root, (mat) => {
      const o = materialOrig.get(mat);
      if (!o) return;
      try {
        mat.roughness = o.roughness;
        mat.metalness = o.metalness;
        mat.envMapIntensity = o.envMapIntensity;
        if ("clearcoat" in mat) mat.clearcoat = o.clearcoat;
        if ("clearcoatRoughness" in mat) mat.clearcoatRoughness = o.clearcoatRoughness;
        if ("sheen" in mat) mat.sheen = o.sheen;
        if ("sheenRoughness" in mat) mat.sheenRoughness = o.sheenRoughness;
        if ("specularIntensity" in mat) mat.specularIntensity = o.specularIntensity;
        if ("shininess" in mat) mat.shininess = o.shininess;
        if ("reflectivity" in mat) mat.reflectivity = o.reflectivity;
        try {
          if (o.colorHex !== null && mat.color && typeof mat.color.setHex === "function") mat.color.setHex(o.colorHex);
        } catch {}
        mat.needsUpdate = true;
      } catch {}
    });
  }

  function applyStyle() {
    try {
      window.__revitget_dbg = window.__revitget_dbg || {};
      window.__revitget_dbg.ts = Date.now();
      window.__revitget_dbg.last_model_ext = window.__revitget_last_model_ext;
      window.__revitget_dbg.force_glb_light_bg = window.__revitget_force_glb_light_bg;
    } catch {}
    try {
      patchBatchAndInstance();
    } catch {}

    const app = resolveApp();
    if (!app) {
      try {
        window.__revitget_dbg = window.__revitget_dbg || {};
        window.__revitget_dbg.app = null;
      } catch {}
      try {
        ensureRendererHooked();
      } catch {}
      return false;
    }

    patchLoadModel(app);

    const view = resolveView(app);
    if (!view) return false;

    const renderer = resolveRenderer(app, view);
    if (!renderer) {
      try {
        window.__revitget_dbg = window.__revitget_dbg || {};
        window.__revitget_dbg.app = app;
        window.__revitget_dbg.view = view;
        window.__revitget_dbg.renderer = null;
      } catch {}
      try {
        ensureRendererHooked();
      } catch {}
      return false;
    }
    const scene = view.scene || view._scene || null;
    try {
      window.__revitget_dbg = { app, view, renderer, scene };
    } catch {}
    try {
      patchRendererRender(renderer);
    } catch {}

    patchFormatButtons();
    patchFileInputs();
    ensureRendererGuard(renderer);

    let ext = String(window.__revitget_last_model_ext || "").toLowerCase();
    if (!ext) {
      ext = getActiveExt(app);
      if (ext) {
        setActiveExt(ext);
      }
    }
    const isGlb = ext === "glb";
    setActiveExt(isGlb ? "glb" : ext);

    if (renderer.__revitget_orig_clear === undefined) {
      try {
        if (typeof renderer.getClearColor === "function" && typeof renderer.getClearAlpha === "function") {
          renderer.__revitget_orig_clear = null;
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
    if (scene && scene.__revitget_orig_bg === undefined) scene.__revitget_orig_bg = scene.background;

    if (typeof renderer.setClearColor === "function") {
      if (isGlb) {
        applyGlbEnvTuning(app);
        renderer.__revitget_force_clear = LIGHT_BG_COLOR;
        renderer.setClearColor(LIGHT_BG_COLOR, 1);
        try {
          const canvas = renderer.domElement;
          if (canvas && canvas.style) {
            canvas.style.backgroundColor = "#f2f3f5";
          }
        } catch {}
        try {
          const host = renderer.domElement && renderer.domElement.parentElement;
          if (host && host.style) host.style.backgroundColor = "#f2f3f5";
        } catch {}
        applyPageBg(true);
        applyMaterialTuning(view, scene);
        try {
          window.__revitget_dbg = { app, view, renderer, scene, materials: collectMaterials(view, scene, 120) };
        } catch {}
        if (scene) {
          try {
            if (scene.background && scene.background.isColor && typeof scene.background.setHex === "function") {
              scene.background.setHex(LIGHT_BG_COLOR);
            }
          } catch {}
        }
        if (renderer.__revitget_orig_exposure !== null && typeof renderer.toneMappingExposure === "number") {
          renderer.toneMappingExposure = renderer.__revitget_orig_exposure;
        }
        renderer.__revitget_glb_applied = true;
      } else if (renderer.__revitget_glb_applied) {
        restoreEnvTuning(app);
        renderer.__revitget_force_clear = null;
        const orig = renderer.__revitget_orig_clear;
        renderer.setClearColor(orig == null ? DARK_BG_COLOR : orig, 1);
        try {
          const canvas = renderer.domElement;
          if (canvas && canvas.style) {
            canvas.style.backgroundColor = "";
          }
        } catch {}
        try {
          const host = renderer.domElement && renderer.domElement.parentElement;
          if (host && host.style) host.style.backgroundColor = "";
        } catch {}
        applyPageBg(false);
        restoreMaterialTuning(view, scene);
        try {
          if (window.__revitget_dbg) window.__revitget_dbg.materials = collectMaterials(view, scene, 120);
        } catch {}
        if (scene && scene.__revitget_orig_bg !== undefined) {
          try {
            scene.background = scene.__revitget_orig_bg;
          } catch {}
        }
        if (renderer.__revitget_orig_exposure !== null && typeof renderer.toneMappingExposure === "number") {
          renderer.toneMappingExposure = renderer.__revitget_orig_exposure;
        }
        renderer.__revitget_glb_applied = false;
      }
    }

    return true;
  }

  setInterval(() => {
    applyStyle();
  }, 800);
  patchFormatButtons();
  patchFileInputs();
  applyStyle();
})();
