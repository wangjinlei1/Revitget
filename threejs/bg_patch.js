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

  function applyMode(mode) {
    const isLight = mode === "light";
    const c = isLight ? LIGHT : DARK;
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
      const st = safeGetStorage();
      if (st) st.setItem(KEY, isLight ? "light" : "dark");
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
    wrap.style.top = "12px";
    wrap.style.right = "72px";
    wrap.style.zIndex = "99999";
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
      return b;
    };

    const btnLight = makeBtn("浅色");
    const btnDark = makeBtn("深色");
    wrap.appendChild(btnLight);
    wrap.appendChild(btnDark);
    host.appendChild(wrap);

    const mode = getInitialMode();
    applyMode(mode);
    setActive(btnLight, btnDark, mode);

    btnLight.addEventListener(
      "click",
      () => {
        applyMode("light");
        setActive(btnLight, btnDark, "light");
      },
      { passive: true }
    );
    btnDark.addEventListener(
      "click",
      () => {
        applyMode("dark");
        setActive(btnLight, btnDark, "dark");
      },
      { passive: true }
    );
    return true;
  }

  let tries = 0;
  const timer = setInterval(() => {
    tries += 1;
    if (createUI() || tries > 300) clearInterval(timer);
  }, 100);
})();
