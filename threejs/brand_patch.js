function patchBrand() {
  const BRAND = "Revitget";
  const links = Array.from(document.querySelectorAll("a"));
  let target = links.find((a) => {
    const href = (a.getAttribute("href") || "").toLowerCase();
    const text = (a.textContent || "").trim();
    const textLower = text.toLowerCase();
    return (
      text === "Cowboy1997" ||
      textLower.includes("cowboy") ||
      href.includes("cowboy") ||
      href.includes("github.com/cowboy1997/revitget") ||
      href.includes("github.com/wangjinlei1/revitget") ||
      (href.includes("gitcode.com") && textLower.includes("cowboy"))
    );
  });

  if (!target) {
    const nodes = Array.from(document.querySelectorAll("a,span,div,button")).slice(0, 5000);
    target = nodes.find((el) => {
      try {
        const t = String((el && el.textContent) || "").trim();
        if (!t) return false;
        const tl = t.toLowerCase();
        if (!(t === "Cowboy1997" || tl.includes("cowboy"))) return false;
        const r = el.getBoundingClientRect ? el.getBoundingClientRect() : null;
        if (!r) return false;
        if (r.top > 120 || r.left > 260) return false;
        return true;
      } catch {
        return false;
      }
    });
  }

  if (!target) return false;

  try {
    target.textContent = BRAND;
  } catch {}
  try {
    if (target && target.tagName && String(target.tagName).toLowerCase() === "a") {
      target.setAttribute("href", "../index.html");
    }
  } catch {}
  return true;
}

let tries = 0;
const timer = setInterval(() => {
  tries += 1;
  if (patchBrand() || tries > 600) clearInterval(timer);
}, 100);

try {
  const mo = new MutationObserver(() => {
    try {
      if (patchBrand()) mo.disconnect();
    } catch {}
  });
  if (document && document.documentElement) {
    mo.observe(document.documentElement, { subtree: true, childList: true, characterData: true });
  }
} catch {}
