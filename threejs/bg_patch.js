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

  const KEY = "revitget_page_bg";
  const LIGHT = "#f2f3f5";
  const DARK = "";
  const LIGHT_HEX = 0xf2f3f5;
  const VERSION = "v7";
  const SKY_ID = "revitget-bg-sky";
  let retryTimer = null;
  let retryTries = 0;

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

  function resolveApp() {
    const root = window.webView ?? window;
    return tryGet(root, ["app"]) || tryGet(window, ["app"]) || null;
  }

  function resolveView(app) {
    if (!app) return null;
    return app.view || app._view || app.viewer || app._viewer || null;
  }

  function resolveRenderer(app, view) {
    return (view && (view.renderer || view._renderer)) || (app && (app.renderer || app._renderer)) || null;
  }

  function safeGetStorage() {
    try {
      return window.localStorage || null;
    } catch {
      return null;
    }
  }

  function getInitialMode() {
    const q = params ? String(params.get("bg") || "").toLowerCase() : "";
    if (q === "light" || q === "dark") return q;
    const st = safeGetStorage();
    const v = st ? String(st.getItem(KEY) || "").toLowerCase() : "";
    if (v === "light" || v === "dark") return v;
    return "dark";
  }

  function setBg(el, color) {
    if (!el || !el.style) return;
    try {
      el.style.backgroundColor = color;
    } catch {}
  }

  function ensureSkyOverlay() {
    try {
      let el = document.getElementById(SKY_ID);
      if (el) return el;
      const host = document.body || document.documentElement;
      if (!host) return null;
      el = document.createElement("div");
      el.id = SKY_ID;
      el.style.position = "fixed";
      el.style.left = "0";
      el.style.top = "0";
      el.style.right = "0";
      el.style.height = "60vh";
      el.style.pointerEvents = "none";
      el.style.zIndex = "2147482000";
      el.style.background = "linear-gradient(180deg, rgba(255,255,255,0.70) 0%, rgba(255,255,255,0.18) 22%, rgba(255,255,255,0) 55%)";
      el.style.display = "none";
      host.appendChild(el);
      return el;
    } catch {
      return null;
    }
  }

  function applyMode(mode) {
    const isLight = mode === "light";
    const c = isLight ? LIGHT : DARK;
    const app = resolveApp();
    const view = resolveView(app);
    const renderer = resolveRenderer(app, view);
    try {
      const sky = ensureSkyOverlay();
      if (sky && sky.style) sky.style.display = isLight ? "block" : "none";
    } catch {}
    try {
      window.__revitget_force_glb_light_bg = !!isLight;
    } catch {}
    try {
      setBg(document.documentElement, c);
    } catch {}
    try {
      setBg(document.body, c);
    } catch {}
    try {
      const appEl = document.getElementById && document.getElementById("app");
      setBg(appEl, c);
    } catch {}
    try {
      if (renderer && typeof renderer.setClearColor === "function") {
        if (renderer.__revitget_bg_orig_clear == null) {
          try {
            const cc = renderer._clearColor || null;
            const hex = cc && typeof cc.getHex === "function" ? cc.getHex() : null;
            if (typeof hex === "number") renderer.__revitget_bg_orig_clear = hex;
          } catch {}
        }
        if (isLight) {
          renderer.setClearColor(LIGHT_HEX, 1);
        } else {
          const orig = renderer.__revitget_bg_orig_clear;
          if (typeof orig === "number") renderer.setClearColor(orig, 1);
        }
      }
    } catch {}
    try {
      if (renderer && renderer.domElement && renderer.domElement.style) {
        renderer.domElement.style.backgroundColor = c;
      }
    } catch (e) {
      console.warn("[BG_PATCH] Error setting domElement style", e);
    }
    try {
      if (!renderer && retryTimer == null) {
        retryTries = 0;
        retryTimer = setInterval(() => {
          retryTries += 1;
          const a = resolveApp();
          const v = resolveView(a);
          const r = resolveRenderer(a, v);
          if (r && typeof r.setClearColor === "function") {
            try {
              if (r.__revitget_bg_orig_clear == null) {
                const cc = r._clearColor || null;
                const hex = cc && typeof cc.getHex === "function" ? cc.getHex() : null;
                if (typeof hex === "number") r.__revitget_bg_orig_clear = hex;
              }
              if (isLight) r.setClearColor(LIGHT_HEX, 1);
              else if (typeof r.__revitget_bg_orig_clear === "number") r.setClearColor(r.__revitget_bg_orig_clear, 1);
              if (r.domElement && r.domElement.style) r.domElement.style.backgroundColor = c;
            } catch {}
            clearInterval(retryTimer);
            retryTimer = null;
          } else if (retryTries > 25) {
            clearInterval(retryTimer);
            retryTimer = null;
          }
        }, 200);
      }
    } catch {}
    try {
      const st = safeGetStorage();
      if (st) st.setItem(KEY, isLight ? "light" : "dark");
    } catch {}
    try {
      const fn =
        (app && (app.requestRender || app.invalidate || app.renderOnce || app.render)) ||
        (view && (view.requestRender || view.invalidate || view.renderOnce || view.render)) ||
        null;
      if (typeof fn === "function") fn.call(app || view);
    } catch {}
  }

  function setActive(btnLight, btnDark, mode) {
    const isLight = mode === "light";
    try {
      if (btnLight) btnLight.style.opacity = isLight ? "1" : "0.6";
    } catch {}
    try {
      if (btnDark) btnDark.style.opacity = isLight ? "0.6" : "1";
    } catch {}
  }

  function createUI() {
    if (document.getElementById("revitget-bg-toggle")) return true;
    const host = document.body || document.documentElement;
    if (!host) return false;

    const wrap = document.createElement("div");
    wrap.id = "revitget-bg-toggle";
    wrap.style.position = "fixed";
    wrap.style.top = "44px";
    wrap.style.right = "72px";
    wrap.style.zIndex = "2147483647";
    wrap.style.pointerEvents = "auto";
    wrap.style.display = "flex";
    wrap.style.gap = "6px";
    wrap.style.padding = "6px 8px";
    wrap.style.borderRadius = "8px";
    wrap.style.background = "rgba(0,0,0,0.28)";
    wrap.style.backdropFilter = "blur(6px)";
    wrap.style.webkitBackdropFilter = "blur(6px)";

    const makeBtn = (text) => {
      const b = document.createElement("button");
      b.type = "button";
      b.textContent = text;
      b.style.border = "1px solid rgba(255,255,255,0.25)";
      b.style.background = "rgba(255,255,255,0.08)";
      b.style.color = "#fff";
      b.style.padding = "4px 8px";
      b.style.borderRadius = "6px";
      b.style.cursor = "pointer";
      b.style.fontSize = "12px";
      b.style.lineHeight = "16px";
      b.style.pointerEvents = "auto";
      b.style.position = "relative";
      b.style.zIndex = "2147483647";
      return b;
    };

    const btnLight = makeBtn("浅色 " + VERSION);
    const btnDark = makeBtn("深色 " + VERSION);
    wrap.appendChild(btnLight);
    wrap.appendChild(btnDark);
    host.appendChild(wrap);
    try {
      wrap.addEventListener("pointerdown", (e) => {
        try {
          if (e && e.target === wrap) e.stopPropagation();
        } catch {}
      });
      wrap.addEventListener("click", (e) => {
        try {
          if (e && e.target === wrap) e.stopPropagation();
        } catch {}
      });
    } catch {}

    const mode = getInitialMode();
    applyMode(mode);
    setActive(btnLight, btnDark, mode);

    const bind = (btn, mode) => {
      const handler = (e) => {
        try {
          e.stopPropagation();
          e.preventDefault();
          console.log("[BG_PATCH] Button clicked, mode=" + mode);
        } catch {}
        applyMode(mode);
        setActive(btnLight, btnDark, mode);
      };
      btn.addEventListener("mousedown", handler, { capture: true });
      btn.addEventListener("click", handler, { capture: true });
      btn.addEventListener("pointerdown", handler, { capture: true });
    };
    bind(btnLight, "light");
    bind(btnDark, "dark");
    return true;
  }

  let tries = 0;
  const timer = setInterval(() => {
    tries += 1;
    if (createUI() || tries > 300) clearInterval(timer);
  }, 100);
})();
