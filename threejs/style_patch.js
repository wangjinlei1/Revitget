
(function () {
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

  function tuneOneMaterial(mat) {
    if (!mat || typeof mat !== "object") return;
    if (!("roughness" in mat) && !("metalness" in mat)) return;
    if (!materialOrig.has(mat)) {
      materialOrig.set(mat, {
        roughness: mat.roughness,
        metalness: mat.metalness,
        envMapIntensity: mat.envMapIntensity,
        clearcoat: mat.clearcoat,
        clearcoatRoughness: mat.clearcoatRoughness,
        sheen: mat.sheen,
        sheenRoughness: mat.sheenRoughness,
        specularIntensity: mat.specularIntensity
      });
    }
    const type = classifyMaterial(mat);
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
    } else if (type === "metal" || metalness > 0.6) {
      mat.metalness = Math.max(metalness, 0.9);
      mat.roughness = Math.min(roughness, 0.35);
      mat.envMapIntensity = Math.max(env, 0.9);
    } else {
      mat.metalness = Math.min(metalness, 0.1);
      mat.roughness = Math.max(roughness, 0.85);
      mat.envMapIntensity = Math.min(env, 0.4);
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
        mat.needsUpdate = true;
      } catch {}
    });
  }

  function applyStyle() {
    const app = resolveApp();
    if (!app) return false;

    patchLoadModel(app);

    const view = resolveView(app);
    if (!view) return false;

    const renderer = resolveRenderer(app, view);
    if (!renderer) return false;
    const scene = view.scene || view._scene || null;
    try {
      window.__revitget_dbg = { app, view, renderer, scene };
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
