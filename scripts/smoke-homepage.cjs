// Browser-only QA: static local server, no calls to production/QA backend or payment providers.
const assert = require("node:assert/strict");
const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");
const { chromium } = require("playwright");

const root = path.resolve(__dirname, "..");
const mime = {".html":"text/html; charset=utf-8",".css":"text/css; charset=utf-8",".js":"application/javascript; charset=utf-8",".png":"image/png",".webp":"image/webp",".ico":"image/x-icon"};

const server = http.createServer((req, res) => {
  const url = new URL(req.url || "/", "http://localhost");
  const pathname = decodeURIComponent(url.pathname);
  const file = path.resolve(root, "." + (pathname === "/" ? "/index.html" : pathname));
  if (!file.startsWith(root + path.sep) || !fs.existsSync(file) || !fs.statSync(file).isFile()) {
    res.writeHead(404);res.end("not found");return;
  }
  res.setHeader("Content-Type", mime[path.extname(file)] || "application/octet-stream");
  res.setHeader("Cache-Control","no-store");
  fs.createReadStream(file).pipe(res);
});

(async () => {
  await new Promise(resolve => server.listen(0,"127.0.0.1",resolve));
  const base = "http://127.0.0.1:" + server.address().port;
  const browser = await chromium.launch({headless:true});
  let failures = [];
  try {
    for (const [name,width,height] of [["desktop",1440,900],["laptop",1280,800],["tablet",768,1024],["mobile",390,844],["small-mobile",360,780]]) {
      const page = await browser.newPage({viewport:{width,height}, deviceScaleFactor:1, reducedMotion:"reduce"});
      page.on("pageerror",e=>failures.push(name+": JS "+e.message));
      await page.goto(base+"/",{waitUntil:"load"});
      assert.equal(await page.locator(".mkt-metrics-seven > div").count(),7,name+": dashboard 7 metrics");
      assert.equal(await page.locator("#modules [data-module]").count(),4,name+": all modules");
      assert.equal(await page.locator('#modules [data-module-status="current"]').count(),1,name+": only Inventory current");
      assert.equal(await page.locator('#modules [data-module-status="planned"]').count(),3,name+": future module status");
      assert.equal(await page.locator(".button-disabled[aria-disabled=true]").count(),1,name+": live purchase disabled");
      const catalog=await page.locator("#modules").boundingBox();
      const demo=await page.locator("#demo").boundingBox();
      const pricing=await page.locator("#pricing").boundingBox();
      assert.ok(catalog&&demo&&pricing&&demo.y<catalog.y&&catalog.y<pricing.y,name+": Inventory-first page flow");
      if(width>720){
        const sidebarColor=await page.locator(".mkt-sidebar").evaluate(el=>getComputedStyle(el).backgroundColor);
        assert.equal(sidebarColor,"rgb(255, 255, 255)",name+": actual v1.0.0 light sidebar");
      }
      const firstLineColor=await page.locator(".hero h1 > .word-token").first().evaluate(el=>getComputedStyle(el).color);
      const accentedLineColor=await page.locator(".hero h1 > span:not(.word-token)").first().evaluate(el=>getComputedStyle(el).color);
      assert.equal(firstLineColor,"rgb(14, 22, 42)",name+": first hero line uses navy, not inherited blue");
      assert.equal(accentedLineColor,"rgb(18, 90, 239)",name+": second hero line uses product blue");
      const tokenSpacing=await page.locator(".hero-trust-line .word-token").first().evaluate(el=>getComputedStyle(el).paddingLeft);
      assert.equal(tokenSpacing,"0px",name+": Korean word-token wrappers have no stray separator padding");
      const metricFontSize=await page.locator(".mkt-metrics-seven > div > span").first().evaluate(el=>parseFloat(getComputedStyle(el).fontSize));
      assert.ok(metricFontSize>=10,name+": readable metric labels "+metricFontSize+"px");
      const moduleBackground=await page.locator(".module-current").evaluate(el=>getComputedStyle(el).backgroundColor);
      assert.equal(moduleBackground,"rgb(255, 255, 255)",name+": future catalogue does not dominate hero");

      let overflow=await page.evaluate(()=>document.documentElement.scrollWidth-window.innerWidth);
      assert.ok(overflow<=2,name+": horizontal overflow "+overflow+"px");
      if(width<=980){
        const menu=page.locator(".menu-button");
        assert.equal(await menu.isVisible(),true,name+": mobile nav button visible");
        await menu.click();
        assert.equal(await page.locator(".site-nav").evaluate(el=>el.classList.contains("mobile-open")),true,name+": menu opens");
        await page.locator('.site-nav a[href="#modules"]').click();
        assert.equal(await menu.getAttribute("aria-expanded"),"false",name+": menu closes on navigation");
      }
      const lastTab=page.locator(".demo-tab").last();
      await lastTab.scrollIntoViewIfNeeded();
      await lastTab.click();
      assert.equal(await lastTab.getAttribute("aria-selected"),"true",name+": demo tab");
      assert.equal(await page.locator(".demo-scene.active").count(),1,name+": one active demo");
      if(width===1440 || width===390) {
        fs.mkdirSync(path.join(root,"artifacts"),{recursive:true});
        // Hero review should capture the top of the page, not the demo after the click test.
        await page.evaluate(()=>{
          document.documentElement.style.scrollBehavior="auto";
          window.scrollTo({top:0,behavior:"instant"});
        });
        await page.screenshot({path:path.join(root,"artifacts","homepage-"+name+"-hero.png")});
        await page.screenshot({path:path.join(root,"artifacts","homepage-"+name+"-full.png"),fullPage:true});
      }
      console.log("PASS responsive "+name+" "+width+"px, no page errors/overflow");
      await page.close();
    }
    // Behavioral check: demo progress/timer runs only while its section is on screen.
    const autoplay=await browser.newPage({viewport:{width:1280,height:800}, reducedMotion:"no-preference"});
    autoplay.on("pageerror",e=>failures.push("autoplay: "+e.message));
    await autoplay.goto(base+"/",{waitUntil:"load"});
    await autoplay.locator("#demo").scrollIntoViewIfNeeded();
    await autoplay.waitForFunction(()=>document.querySelector(".demo-shell")?.classList.contains("is-running"),null,{timeout:3000});
    await autoplay.locator(".hero h1").scrollIntoViewIfNeeded();
    await autoplay.waitForFunction(()=>!document.querySelector(".demo-shell")?.classList.contains("is-running"),null,{timeout:3000});
    console.log("PASS demo starts on screen and pauses offscreen");
    await autoplay.close();
    const preview=await browser.newPage();
    preview.on("pageerror",e=>failures.push("preview: "+e.message));
    await preview.goto(base+"/preview.html",{waitUntil:"load"});
    assert.equal(await preview.locator("#modules [data-module]").count(),4,"standalone preview includes module catalog");
    assert.equal(await preview.locator(".mkt-metrics-seven > div").count(),7,"standalone preview includes v1.0.0 mock");
    assert.equal(await preview.locator('.trial-link').getAttribute("href"),"trial.html","preview trial hyperlink resolves in branch");
    await preview.close();
    assert.deepEqual(failures,[],"browser runtime errors");
    console.log("PASS standalone preview, module interactions and disabled live checkout");
    console.log("BROWSER QA ALL PASS");
  } finally {
    await browser.close();
    await new Promise(resolve=>server.close(resolve));
  }
})().catch(err=>{console.error(err);process.exitCode=1;server.close();});
