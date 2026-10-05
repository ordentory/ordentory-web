// Browser-only payment result QA. No live payment/provider calls.
const assert=require("node:assert/strict");
const http=require("node:http");
const fs=require("node:fs");
const path=require("node:path");
const {chromium}=require("playwright");

const root=path.resolve(__dirname,"..");
const mime={".html":"text/html; charset=utf-8",".css":"text/css; charset=utf-8",".js":"application/javascript; charset=utf-8",".png":"image/png",".webp":"image/webp"};
const server=http.createServer((req,res)=>{
  const url=new URL(req.url||"/","http://localhost");
  const file=path.resolve(root,"."+url.pathname);
  if(!file.startsWith(root+path.sep)||!fs.existsSync(file)||!fs.statSync(file).isFile()){res.writeHead(404);res.end("not found");return;}
  res.setHeader("Content-Type",mime[path.extname(file)]||"application/octet-stream");
  res.setHeader("Cache-Control","no-store");
  fs.createReadStream(file).pipe(res);
});

(async()=>{
  await new Promise(resolve=>server.listen(0,"127.0.0.1",resolve));
  const base="http://127.0.0.1:"+server.address().port;
  const browser=await chromium.launch({headless:true});
  try{
    let confirmCalls=0;
    const page=await browser.newPage({viewport:{width:1200,height:900}});
    const pageErrors=[];
    page.on("pageerror",e=>pageErrors.push(e.message));
    await page.route("https://api.ordentory.kr/v1/store/payments/confirm",async route=>{
      confirmCalls++;
      const payload=route.request().postDataJSON();
      assert.deepEqual(payload,{paymentKey:"pay_test_123",orderId:"ORD-RESULT-1234",amount:169000});
      await route.fulfill({status:200,contentType:"application/json",body:JSON.stringify({
        orderId:"ORD-RESULT-1234",buyerEmail:"buyer@example.com",amount:169000,currency:"KRW",
        licenseCode:"ORD-57QX-GSGB-QHRD-4FNF",deviceLimit:2,perpetual:true,
        installerUrl:"https://api.ordentory.kr/v1/store/installer",created:true
      })});
    });
    await page.goto(base+"/payment-success.html?paymentKey=pay_test_123&orderId=ORD-RESULT-1234&amount=169000",{waitUntil:"load"});
    await page.locator("#result-success").waitFor({state:"visible"});
    assert.equal(confirmCalls,1,"success confirmation called once");
    assert.equal(await page.locator("#result-order-id").textContent(),"ORD-RESULT-1234");
    assert.equal(await page.locator("#result-buyer-email").textContent(),"buyer@example.com");
    assert.match(await page.locator("#result-amount").textContent(),/169,000/);
    assert.equal(await page.locator("#license-code").textContent(),"ORD-57QX-GSGB-QHRD-4FNF");
    assert.equal(await page.locator("#installer-link").getAttribute("href"),"https://api.ordentory.kr/v1/store/installer");
    assert.ok(!page.url().includes("paymentKey="),"paymentKey removed from address");
    assert.ok(!page.url().includes("amount="),"amount removed from address");
    assert.ok(page.url().includes("orderId=ORD-RESULT-1234"),"order id remains for support context");
    await page.reload({waitUntil:"load"});
    await page.locator("#result-success").waitFor({state:"visible"});
    assert.equal(confirmCalls,1,"refresh uses cached confirmed result, no duplicate confirm");
    fs.mkdirSync(path.join(root,"artifacts"),{recursive:true});
    await page.screenshot({path:path.join(root,"artifacts","payment-success-desktop.png"),fullPage:true});
    assert.deepEqual(pageErrors,[],"success page has no runtime errors");
    console.log("PASS payment success confirm -> sanitize URL -> refresh cache");
    await page.close();

    const mobile=await browser.newPage({viewport:{width:390,height:844}});
    await mobile.addInitScript(()=>{
      sessionStorage.setItem("ordentory-payment-result:ORD-MOBILE-1234",JSON.stringify({
        orderId:"ORD-MOBILE-1234",buyerEmail:"mobile@example.com",amount:169000,currency:"KRW",
        licenseCode:"ORD-ABCD-EFGH-IJKL-MNOP",deviceLimit:2,perpetual:true,
        installerUrl:"https://api.ordentory.kr/v1/store/installer"
      }));
    });
    await mobile.goto(base+"/payment-success.html?orderId=ORD-MOBILE-1234",{waitUntil:"load"});
    await mobile.locator("#result-success").waitFor({state:"visible"});
    const overflow=await mobile.evaluate(()=>document.documentElement.scrollWidth-window.innerWidth);
    assert.ok(overflow<=2,"mobile success horizontal overflow "+overflow+"px");
    assert.equal(await mobile.locator(".activation-steps article").count(),3,"activation steps");
    console.log("PASS payment success mobile layout");
    await mobile.close();

    const errorPage=await browser.newPage({viewport:{width:900,height:760}});
    await errorPage.route("https://api.ordentory.kr/v1/store/payments/confirm",route=>route.fulfill({
      status:502,contentType:"application/json",body:JSON.stringify({error:{message:"결제 승인 상태를 확인하지 못했습니다."}})
    }));
    await errorPage.goto(base+"/payment-success.html?paymentKey=pay_error&orderId=ORD-ERROR-1234&amount=169000",{waitUntil:"load"});
    await errorPage.locator("#result-error").waitFor({state:"visible"});
    assert.equal(await errorPage.locator("#error-order-id").textContent(),"ORD-ERROR-1234");
    assert.match(await errorPage.locator("#result-error-message").textContent(),/확인하지 못했습니다/);
    assert.match(await errorPage.locator(".result-caution-warning").textContent(),/재결제하지 마세요/);
    assert.equal(await errorPage.locator('a[href="/checkout.html"]').count(),0,"confirmation error must not offer immediate repay");
    console.log("PASS ambiguous confirmation error blocks repay guidance");
    await errorPage.close();

    const fail=await browser.newPage({viewport:{width:390,height:844}});
    const injected="<img id=xss src=x onerror=alert(1)>";
    await fail.goto(base+"/payment-fail.html?code=USER_CANCEL&orderId=ORD-FAIL1234&message="+encodeURIComponent(injected),{waitUntil:"load"});
    assert.equal(await fail.locator("#fail-code").textContent(),"USER_CANCEL");
    assert.equal(await fail.locator("#fail-order-id").textContent(),"ORD-FAIL1234");
    assert.equal(await fail.locator("#fail-message").textContent(),"결제가 취소되었거나 인증 과정에서 문제가 발생했습니다.");
    assert.ok(!(await fail.locator("body").textContent()).includes(injected),"untrusted failure message is not reflected");
    assert.equal(await fail.locator("#xss").count(),0,"failure message cannot create HTML");
    assert.ok(!fail.url().includes("message="),"failure query details removed after rendering");
    const failOverflow=await fail.evaluate(()=>document.documentElement.scrollWidth-window.innerWidth);
    assert.ok(failOverflow<=2,"mobile fail horizontal overflow "+failOverflow+"px");
    await fail.screenshot({path:path.join(root,"artifacts","payment-fail-mobile.png"),fullPage:true});
    console.log("PASS payment fail safe rendering and mobile layout");
    await fail.close();

    console.log("PAYMENT RESULT QA ALL PASS");
  }finally{
    await browser.close();
    await new Promise(resolve=>server.close(resolve));
  }
})().catch(err=>{console.error(err);process.exitCode=1;server.close();});
