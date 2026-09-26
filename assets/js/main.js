const menuButton = document.querySelector(".menu-button");
const nav = document.querySelector(".site-nav");

if (menuButton && nav) {
  menuButton.addEventListener("click", () => {
    const open = nav.classList.toggle("mobile-open");
    document.body.classList.toggle("nav-open", open);
    menuButton.setAttribute("aria-expanded", String(open));
  });

  nav.querySelectorAll("a").forEach((link) => {
    link.addEventListener("click", () => {
      nav.classList.remove("mobile-open");
      document.body.classList.remove("nav-open");
      menuButton.setAttribute("aria-expanded", "false");
    });
  });
}

const revealItems = document.querySelectorAll(".reveal");
if ("IntersectionObserver" in window) {
  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add("visible");
          observer.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.14 }
  );
  revealItems.forEach((item) => observer.observe(item));
} else {
  revealItems.forEach((item) => item.classList.add("visible"));
}

const tabs = Array.from(document.querySelectorAll(".demo-tab"));
const scenes = Array.from(document.querySelectorAll(".demo-scene"));
let activeScene = 0;
let timer;

function showScene(index) {
  activeScene = index;
  tabs.forEach((tab, i) => tab.classList.toggle("active", i === index));
  scenes.forEach((scene, i) => scene.classList.toggle("active", i === index));
}

function startDemo() {
  clearInterval(timer);
  timer = setInterval(() => showScene((activeScene + 1) % scenes.length), 3200);
}

tabs.forEach((tab, index) => {
  tab.addEventListener("click", () => {
    showScene(index);
    startDemo();
  });
});

if (tabs.length && scenes.length) startDemo();


// Prevent Korean words from breaking between syllables.
// CSS word-break: keep-all is retained as the first layer; this wraps
// each whitespace-delimited token containing Hangul as a non-breaking unit.
(function enforceKoreanWordIntegrity() {
  const roots = document.querySelectorAll('.site-header, main, .site-footer');

  const shouldSkip = (parent) => {
    if (!parent || parent.nodeType !== 1) return true;
    return Boolean(parent.closest('script, style, textarea, select, option, svg, [data-allow-word-break], .mkt-app, .mkt-ui')) ||
      parent.classList.contains('word-token');
  };

  roots.forEach((root) => {
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    const nodes = [];
    let node;

    while ((node = walker.nextNode())) {
      if (!node.nodeValue || !node.nodeValue.trim()) continue;
      if (shouldSkip(node.parentElement)) continue;
      if (!/[가-힣]/.test(node.nodeValue)) continue;
      nodes.push(node);
    }

    nodes.forEach((textNode) => {
      const parts = textNode.nodeValue.split(/(\s+)/);
      const fragment = document.createDocumentFragment();

      parts.forEach((part) => {
        if (!part) return;
        if (/^\s+$/.test(part) || !/[가-힣]/.test(part)) {
          fragment.appendChild(document.createTextNode(part));
          return;
        }

        const span = document.createElement('span');
        span.className = 'word-token';
        span.textContent = part;
        fragment.appendChild(span);
      });

      textNode.replaceWith(fragment);
    });
  });
})();
