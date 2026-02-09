let bound = false;
let controls = null;
let originalLeftAction = null;
let ACTION = null;
let shiftPressed = false;
let pointerActive = false;
const originalLeftByControls = new WeakMap();

function isActionEnum(a) {
  return a && typeof a === "object" && "ROTATE" in a;
}

function isControlsCandidate(c) {
  if (!c || typeof c !== "object") return false;
  const a = c?.constructor?.ACTION;
  if (!isActionEnum(a)) return false;
  const mb = c.mouseButtons;
  if (!mb || typeof mb !== "object") return false;
  return "left" in mb;
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
    if (isControlsCandidate(c)) return { controls: c, ACTION: c.constructor.ACTION };
  }

  const appView = tryGet(root, ["app", "view"]);
  const deep1 = deepFindControls(appView);
  if (deep1) return { controls: deep1, ACTION: deep1.constructor.ACTION };

  const app = tryGet(root, ["app"]);
  const deep2 = deepFindControls(app);
  if (deep2) return { controls: deep2, ACTION: deep2.constructor.ACTION };

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
  controls.mouseButtons.left = action;
}

function restoreLeft() {
  const c = refreshControls();
  if (!c) return;
  const original = originalLeftByControls.get(c) ?? originalLeftAction;
  if (original == null) return;
  controls.mouseButtons.left = original;
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
      if (!originalLeftByControls.has(c)) {
        originalLeftByControls.set(c, c.mouseButtons.left);
      }
      originalLeftAction = originalLeftByControls.get(c);
      c.mouseButtons.left = ACTION.ROTATE;
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
      if (!originalLeftByControls.has(c)) {
        originalLeftByControls.set(c, c.mouseButtons.left);
      }
      originalLeftAction = originalLeftByControls.get(c);
      c.mouseButtons.left = ACTION.ROTATE;
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
    originalLeftByControls.set(c, c.mouseButtons.left);
  }
  if (c && shiftPressed && ACTION && c.mouseButtons) {
    c.mouseButtons.left = ACTION.ROTATE;
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
      originalLeftByControls.set(c, c.mouseButtons.left);
    }
    bindOnce();
    if (shiftPressed && ACTION && c.mouseButtons) {
      c.mouseButtons.left = ACTION.ROTATE;
    }
  }
  if (!controls && tries > 300) clearInterval(timer);
}, 250);

