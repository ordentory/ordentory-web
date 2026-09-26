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
