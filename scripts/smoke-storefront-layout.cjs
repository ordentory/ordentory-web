// Whole-store browser QA. Static local server only; external requests are blocked.
const assert = require("node:assert/strict");
const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");
const { chromium } = require("playwright");

const root = path.resolve(__dirname, "..");
const mime = {
  ".html":"text/html; charset=utf-8",
  ".css":"text/css; charset=utf-8",
  ".js":"application/javascript; charset=utf-8",
  ".png":"image/png",
  ".jpg":"image/jpeg",
  ".jpeg":"image/jpeg",
  ".webp":"image/webp",
  ".svg":"image/svg+xml",
  ".pdf":"application/pdf"
};

const server = http.createServer((req,res)=>{
  const url = new URL(req.url || "/", "http://localhost");
  const pathname = decodeURIComponent(url.pathname);
  const rel = pathname === "/" ? "/index.html" : pathname;
  const file = path.resolve(root, "." + rel);
  if (!file.startsWith(root + path.sep) || !fs.existsSync(file) || !fs.statSync(file).isFile()) {
    res.writeHead(404); res.end("not found"); return;
  }
  res.setHeader("Content-Type", mime[path.extname(file).toLowerCase()] || "application/octet-stream");
  res.setHeader("Cache-Control","no-store");
  fs.createReadStream(file).pipe(res);
});

function localTargetExists(href){
  if(!href || href.startsWith("#") || href.startsWith("mailto:") || href.startsWith("tel:") || href.startsWith("javascript:")) return true;
  let url;
  try { url = new URL(href, "http://local.test/"); } catch { return false; }
  if(url.origin !== "http://local.test") return true;
  if(url.pathname === "/") return fs.existsSync(path.join(root,"index.html"));
  const file = path.resolve(root, "." + decodeURIComponent(url.pathname));
  return file.startsWith(root + path.sep) && fs.existsSync(file) && fs.statSync(file).isFile();
}

(async()=>{
  await new Promise(resolve=>server.listen(0,"127.0.0.1",resolve));
  const base="http://127.0.0.1:"+server.address().port;
  const browser=await chromium.launch({headless:true});
  const pages=[
    ["home","/"],
    ["trial","/trial.html"],
    ["checkout","/checkout.html"],
    ["payment-success","/payment-success.html"],
    ["payment-fail","/payment-fail.html"],
    ["manual","/manual.html"],
    ["terms","/terms.html"],
    ["privacy","/privacy.html"],
    ["refund","/refund.html"],
    ["login","/login.html"],
    ["signup","/signup.html"],
    ["feedback","/feedback.html"]
  ];
  const viewports=[
    ["desktop",1440,900],
    ["mobile",390,844]
  ];
  const failures=[];

  try{
    for(const [pageName,urlPath] of pages){
      for(const [viewportName,width,height] of viewports){
        const page=await browser.newPage({viewport:{width,height},deviceScaleFactor:1,reducedMotion:"reduce"});
        page.on("pageerror",e=>failures.push(pageName+"/"+viewportName+": JS "+e.message));
        await page.route("**/*",async route=>{
          const u=new URL(route.request().url());
          if(u.origin===base){ await route.continue(); return; }
          await route.abort();
        });
        await page.goto(base+urlPath,{waitUntil:"load"});

        const title=(await page.title()).trim();
        assert.ok(title.includes("ORDENTORY"),pageName+"/"+viewportName+": ORDENTORY title");

        const bodyVisible=await page.locator("body").isVisible();
        assert.equal(bodyVisible,true,pageName+"/"+viewportName+": body visible");

        const overflow=await page.evaluate(()=>document.documentElement.scrollWidth-window.innerWidth);
        assert.ok(overflow<=2,pageName+"/"+viewportName+": horizontal overflow "+overflow+"px");

        const main=page.locator("main");
        assert.equal(await main.count(),1,pageName+"/"+viewportName+": exactly one main");
        const mainBox=await main.boundingBox();
        assert.ok(mainBox&&mainBox.width>0&&mainBox.height>0,pageName+"/"+viewportName+": main has layout");

        const broken=await page.locator("a[href]:visible").evaluateAll(els=>els.map(a=>a.getAttribute("href")).filter(Boolean));
        for(const href of broken){
          assert.ok(localTargetExists(href),pageName+"/"+viewportName+": broken internal link "+href);
        }

        if(viewportName==="mobile"){
          const interactive=page.locator('a.button:visible, button:visible, input:visible');
          const count=await interactive.count();
          for(let i=0;i<count;i++){
            const box=await interactive.nth(i).boundingBox();
            if(!box) continue;
            assert.ok(box.width<=width+1,pageName+": mobile interactive wider than viewport");
          }
        }

        if(pageName==="checkout"){
          assert.equal(await page.locator('a[href="/trial.html"]').count()>0,true,viewportName+": checkout links Trial");
          assert.equal(await page.locator('a[href="/terms.html"]').count()>0,true,viewportName+": checkout links Terms");
          assert.equal(await page.locator('a[href="/privacy.html"]').count()>0,true,viewportName+": checkout links Privacy");
          assert.equal(await page.locator('a[href="/refund.html"]').count()>0,true,viewportName+": checkout links Refund");
        }
        if(pageName==="trial"){
          assert.equal(await page.locator('a[href="checkout.html"]').count()>0,true,viewportName+": Trial links Checkout");
        }
        if(pageName==="payment-success" || pageName==="payment-fail"){
          assert.equal(await page.locator('a[href="/refund.html"]').count()>0,true,viewportName+": payment result links Refund");
          assert.equal(await page.locator('a[href^="mailto:support@ordentory.kr"]').count()>0,true,viewportName+": payment result links Support");
        }

        fs.mkdirSync(path.join(root,"artifacts","whole-store"),{recursive:true});
        await page.screenshot({
          path:path.join(root,"artifacts","whole-store",pageName+"-"+viewportName+".png"),
          fullPage:true
        });
        console.log("PASS "+pageName+" "+viewportName+" "+width+"px");
        await page.close();
      }
    }
    assert.deepEqual(failures,[],"whole-store browser runtime errors");
    console.log("WHOLE STOREFRONT DESKTOP/MOBILE QA ALL PASS");
  }finally{
    await browser.close();
    await new Promise(resolve=>server.close(resolve));
  }
})().catch(err=>{console.error(err);process.exitCode=1;server.close();});
