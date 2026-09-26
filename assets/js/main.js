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
const demoShell = document.querySelector(".demo-shell");
const restartDemoButton = document.querySelector(".demo-restart");
const reduceMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches;
let activeScene = 0;
let timer;

function restartSceneAnimation(scene) {
  if (!scene) return;
  scene.classList.remove("active");
  void scene.offsetWidth;
  scene.classList.add("active");
}

function restartDemoProgress() {
  if (!demoShell) return;
  demoShell.classList.remove("is-running");
  void demoShell.offsetWidth;
  if (!reduceMotion) demoShell.classList.add("is-running");
}

function showScene(index, restartAnimation = true) {
  activeScene = index;
  tabs.forEach((tab, i) => {
    const selected = i === index;
    tab.classList.toggle("active", selected);
    tab.setAttribute("aria-selected", String(selected));
  });
  scenes.forEach((scene, i) => scene.classList.toggle("active", i === index));

  if (restartAnimation) restartSceneAnimation(scenes[index]);
  restartDemoProgress();
}

function startDemo() {
  clearInterval(timer);
  if (reduceMotion || !tabs.length || !scenes.length) return;
  timer = setInterval(() => showScene((activeScene + 1) % scenes.length), 5000);
}

tabs.forEach((tab, index) => {
  tab.addEventListener("click", () => {
    showScene(index);
    startDemo();
  });
});

restartDemoButton?.addEventListener("click", () => {
  showScene(0);
  startDemo();
});

if (tabs.length && scenes.length) {
  showScene(0);
  startDemo();
}


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
