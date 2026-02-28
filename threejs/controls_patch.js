let bound = false;
let controls = null;
let originalLeftAction = null;
let ACTION = null;
let shiftPressed = false;
let pointerActive = false;
const originalLeftByControls = new WeakMap();
const originalEnableRotateByControls = new WeakMap();

function isActionEnum(a) {
  return a && typeof a === "object" && "ROTATE" in a;
}

function isControlsCandidate(c) {
  if (!c || typeof c !== "object") return false;
  const a = c?.constructor?.ACTION || c?.constructor?.MOUSE || c?.MOUSE;
  if (!isActionEnum(a)) return false;
  const mb = c.mouseButtons;
  if (!mb || typeof mb !== "object") return false;
  return "left" in mb || "LEFT" in mb;
}

function getLeftKey(c) {
  try {
    const mb = c && c.mouseButtons;
    if (!mb || typeof mb !== "object") return "left";
    if ("left" in mb) return "left";
    if ("LEFT" in mb) return "LEFT";
  } catch {}
  return "left";
}

function ensureEnableRotate(c, on) {
  try {
    if (!c || typeof c !== "object") return;
    if (!("enableRotate" in c)) return;
    if (!originalEnableRotateByControls.has(c)) {
      originalEnableRotateByControls.set(c, c.enableRotate);
    }
    c.enableRotate = !!on;
  } catch {}
}

function restoreEnableRotate(c) {
  try {
    if (!c || typeof c !== "object") return;
    if (!originalEnableRotateByControls.has(c)) return;
    const v = originalEnableRotateByControls.get(c);
    originalEnableRotateByControls.delete(c);
    c.enableRotate = v;
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

function deepFindControls(root, maxDepth = 6, maxNodes = 2500) {
  if (!root || typeof root !== "object") return null;
  const visited = new WeakSet();
  const queue = [{ value: root, depth: 0 }];
  let nodes = 0;

  while (queue.length) {
    const { value, depth } = queue.shift();
    if (!value || typeof value !== "object") continue;
    if (visited.has(value)) continue;
    visited.add(value);

    if (isControlsCandidate(value)) return value;
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

function resolveControls() {
  const root = window.webView ?? window;

  const directCandidates = [
    tryGet(root, ["app", "view", "controls"]),
    tryGet(root, ["app", "view", "viewer", "controls"]),
    tryGet(root, ["app", "controls"]),
    tryGet(root, ["app", "viewer", "controls"]),
    tryGet(root, ["webView", "app", "view", "controls"]),
    tryGet(window, ["webView", "app", "view", "controls"])
  ].filter(Boolean);

  for (const c of directCandidates) {
    if (isControlsCandidate(c)) return { controls: c, ACTION: c.constructor.ACTION || c.constructor.MOUSE || c.MOUSE };
  }

  const appView = tryGet(root, ["app", "view"]);
  const deep1 = deepFindControls(appView);
  if (deep1) return { controls: deep1, ACTION: deep1.constructor.ACTION || deep1.constructor.MOUSE || deep1.MOUSE };

  const app = tryGet(root, ["app"]);
  const deep2 = deepFindControls(app);
  if (deep2) return { controls: deep2, ACTION: deep2.constructor.ACTION || deep2.constructor.MOUSE || deep2.MOUSE };

  return null;
}

function refreshControls() {
  const found = resolveControls();
  if (!found) return null;
  if (controls !== found.controls) {
    controls = found.controls;
    ACTION = found.ACTION;
    originalLeftAction = null;
  }
  return controls;
}

function setLeft(action) {
  if (!controls?.mouseButtons) return;
  const k = getLeftKey(controls);
  controls.mouseButtons[k] = action;
}

function restoreLeft() {
  const c = refreshControls();
  if (!c) return;
  const original = originalLeftByControls.get(c) ?? originalLeftAction;
  if (original == null) return;
  const k = getLeftKey(c);
  controls.mouseButtons[k] = original;
  restoreEnableRotate(c);
}

function bindOnce() {
  if (bound) return;
  bound = true;

  window.addEventListener(
    "keydown",
    (e) => {
      if (e.key !== "Shift") return;
      shiftPressed = true;
      const c = refreshControls();
      if (!c || !ACTION || !c.mouseButtons) return;
      const k = getLeftKey(c);
      if (!originalLeftByControls.has(c)) {
        originalLeftByControls.set(c, c.mouseButtons[k]);
      }
      originalLeftAction = originalLeftByControls.get(c);
      ensureEnableRotate(c, true);
      c.mouseButtons[k] = ACTION.ROTATE;
    },
    { passive: true }
  );

  window.addEventListener(
    "keyup",
    (e) => {
      if (e.key !== "Shift") return;
      shiftPressed = false;
      if (!pointerActive) restoreLeft();
    },
    { passive: true }
  );

  window.addEventListener(
    "blur",
    () => {
      shiftPressed = false;
      pointerActive = false;
      restoreLeft();
    },
    { passive: true }
  );

  window.addEventListener(
    "pointerdown",
    (e) => {
      pointerActive = true;
      if (!e.shiftKey) return;
      shiftPressed = true;
      const c = refreshControls();
      if (!c || !ACTION || !c.mouseButtons) return;
      const k = getLeftKey(c);
      if (!originalLeftByControls.has(c)) {
        originalLeftByControls.set(c, c.mouseButtons[k]);
      }
      originalLeftAction = originalLeftByControls.get(c);
      ensureEnableRotate(c, true);
      c.mouseButtons[k] = ACTION.ROTATE;
    },
    { passive: true, capture: true }
  );

  window.addEventListener(
    "pointerup",
    () => {
      pointerActive = false;
      if (!shiftPressed) restoreLeft();
    },
    { passive: true, capture: true }
  );

  window.addEventListener(
    "pointercancel",
    () => {
      pointerActive = false;
      if (!shiftPressed) restoreLeft();
    },
    { passive: true, capture: true }
  );
}

function tick() {
  const c = refreshControls();
  if (c && c.mouseButtons && !originalLeftByControls.has(c)) {
    const k = getLeftKey(c);
    originalLeftByControls.set(c, c.mouseButtons[k]);
  }
  if (c && shiftPressed && ACTION && c.mouseButtons) {
    const k = getLeftKey(c);
    c.mouseButtons[k] = ACTION.ROTATE;
  }
  requestAnimationFrame(tick);
}
requestAnimationFrame(tick);

let tries = 0;
const timer = setInterval(() => {
  tries += 1;
  const c = refreshControls();
  if (c) {
    if (c.mouseButtons && !originalLeftByControls.has(c)) {
      const k = getLeftKey(c);
      originalLeftByControls.set(c, c.mouseButtons[k]);
    }
    bindOnce();
    if (shiftPressed && ACTION && c.mouseButtons) {
      const k = getLeftKey(c);
      c.mouseButtons[k] = ACTION.ROTATE;
    }
  }
  if (!controls && tries > 300) clearInterval(timer);
}, 250);

