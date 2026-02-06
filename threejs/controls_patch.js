function isObject(value) {
  return value !== null && typeof value === "object";
}

function findFirst(value, predicate, maxDepth = 6) {
  const visited = new WeakSet();
  const queue = [{ value, depth: 0 }];
  while (queue.length) {
    const { value: current, depth } = queue.shift();
    if (!isObject(current)) continue;
    if (visited.has(current)) continue;
    visited.add(current);
    try {
      if (predicate(current)) return current;
    } catch {}
    if (depth >= maxDepth) continue;
    const keys = Object.keys(current);
    for (const key of keys) {
      const next = current[key];
      if (isObject(next)) queue.push({ value: next, depth: depth + 1 });
    }
  }
  return null;
}

function applyBindings(controls, container) {
  const ACTION = controls?.constructor?.ACTION;
  if (!ACTION) return false;

  controls.mouseButtons = controls.mouseButtons || {};
  controls.mouseButtons.right = ACTION.OFFSET;
  controls.mouseButtons.left = ACTION.OFFSET;

  if (!container || container.__revitget_mouse_patch_applied) return true;
  container.__revitget_mouse_patch_applied = true;

  container.addEventListener(
    "contextmenu",
    (e) => {
      e.preventDefault();
    },
    { passive: false }
  );

  container.addEventListener(
    "pointerdown",
    (e) => {
      if (e.button === 0) {
        controls.mouseButtons.left = e.shiftKey ? ACTION.ROTATE : ACTION.OFFSET;
      }
    },
    { passive: true }
  );

  window.addEventListener(
    "keyup",
    (e) => {
      if (e.key === "Shift") {
        controls.mouseButtons.left = ACTION.OFFSET;
      }
    },
    { passive: true }
  );

  return true;
}

function tryPatch() {
  const appEl = document.getElementById("app");
  const vueApp = appEl && appEl.__vue_app__;
  const rootProxy = vueApp && vueApp._instance && vueApp._instance.proxy;
  if (!rootProxy) return false;

  const holder = findFirst(rootProxy, (obj) => {
    const controls = obj?.webView?.app?.view?.controls;
    return !!(controls && controls.mouseButtons && controls.update);
  });
  if (!holder) return false;

  const controls = holder.webView.app.view.controls;
  const container = holder.webView.app.view.goldenContainer || document.body;
  return applyBindings(controls, container);
}

let tries = 0;
const timer = setInterval(() => {
  tries += 1;
  if (tryPatch() || tries > 200) clearInterval(timer);
}, 100);

