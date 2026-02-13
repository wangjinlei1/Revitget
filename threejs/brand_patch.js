function patchBrand() {
  const links = Array.from(document.querySelectorAll("a"));
  const target = links.find((a) => {
    const href = (a.getAttribute("href") || "").toLowerCase();
    const text = (a.textContent || "").trim();
    return (
      text === "Cowboy1997" ||
      href.includes("github.com/cowboy1997/revitget") ||
      href.includes("github.com/wangjinlei1/revitget") ||
      href.includes("gitcode.com") && text === "Cowboy1997"
    );
  });

  if (!target) return false;

  target.textContent = "Revitget";
  target.setAttribute("href", "../index.html");
  return true;
}

let tries = 0;
const timer = setInterval(() => {
  tries += 1;
  if (patchBrand() || tries > 300) clearInterval(timer);
}, 100);
