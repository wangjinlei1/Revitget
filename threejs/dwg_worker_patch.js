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

  function log(msg) {
    try {
      console.log("[DWG_WORKER_PATCH]", msg);
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

  function patch() {
    const root = window.webView ?? window;
    const app = tryGet(root, ["app"]) || tryGet(root, ["webView", "app"]);
    if (!app) return false;
    if (app.__revitget_dwg_worker_patched) return true;
    app.__revitget_dwg_worker_patched = true;
    log("Patched DWG Worker");

    const originalWorker = window.Worker;
    window.Worker = function (scriptURL, options) {
      try {
        const urlStr = String(scriptURL);
        if (/dwg2dxf\.js$/i.test(urlStr)) {
          log("Creating DWG Worker for: " + urlStr);
          const worker = new originalWorker(scriptURL, options);
          const originalPostMessage = worker.postMessage.bind(worker);
          worker.postMessage = function (data, transfer) {
            try {
              log("DWG Worker.postMessage called with data: " + JSON.stringify(data));
            } catch {}
            return originalPostMessage(data, transfer);
          };
          worker.addEventListener("message", function (e) {
            try {
              log("DWG Worker message received: " + JSON.stringify(e.data));
              if (e.data && e.data.status === 1) {
                log("DWG Worker error: " + e.data.dxfData);
              } else if (e.data && e.data.status === 0 && e.data.url) {
                log("DWG Worker success, DXF URL: " + e.data.url);
              }
            } catch {}
          });
          worker.addEventListener("error", function (e) {
            log("DWG Worker error event: " + e.message);
          });
          return worker;
        }
      } catch (e) {
        log("Error in Worker patch: " + e);
      }
      return new originalWorker(scriptURL, options);
    };
    window.Worker.prototype = originalWorker.prototype;
    window.Worker.prototype.constructor = window.Worker;

    return true;
  }

  let tries = 0;
  const timer = setInterval(() => {
    tries += 1;
    if (patch() || tries > 300) {
      if (tries > 300) log("Failed to patch after 300 tries");
      clearInterval(timer);
    }
  }, 200);
})();
