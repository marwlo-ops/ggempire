// GGEmpire AI — static frontend bootstrap.
// Keep API keys and privileged operations on a secure backend, never in this file.
document.documentElement.classList.add("app-ready");

const internalLinks = document.querySelectorAll('a[href^="#"]');
internalLinks.forEach((link) => {
  link.addEventListener("click", (event) => {
    const target = document.querySelector(link.getAttribute("href"));
    if (!target) return;
    event.preventDefault();
    target.scrollIntoView({ behavior: "smooth", block: "start" });
  });
});
