// Browser-only QA for purchase success/failure pages. No live payment/API calls.
const assert=require("node:assert/strict");
const http=require("node:http");
const fs=require("node:fs");
const path=require("node:path");
const {chromium}=require("playwright");

const root=path.resolve(__dirname,"..");
const mime={".html":"text/html; charset=utf-8",".css":"text/css; charset=utf-8",".js":"application/javascript; charset=utf-8",".png":"image/png",".webp":"image/webp"};

const server=http.createServer((req,res)=>{
  const url=new URL(req.url||"/","http://localhost");
  const pathname=decodeURIComponent(url.pathname);
  const file=path.resolve(root,"."+(pathname==="/" ? "/index.html" : pathname));
  if(!file.startsWith(root+path.sep)||!fs.existsSync(file)||!fs.statSync(file).isFile()){
    res.writeHead(404);res.end("not found");return;
  }
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
    const successPage=await browser.newPage({viewport:{width:1280,height:900}});
    const successErrors=[];
    successPage.on("pageerror",e=>successErrors.push(e.message));
    await successPage.route("https://api.ordentory.kr/v1/store/payments/confirm",async route=>{
      confirmCalls++;
      const payload=route.request().postDataJSON();
      assert.equal(payload.paymentKey,"pay_qa_123");
      assert.equal(payload.orderId,"ORD-RESULTQA123");
      assert.equal(payload.amount,169000);
      await route.fulfill({
        status:200,contentType:"application/json",
        body:JSON.stringify({
          orderId:"ORD-RESULTQA123",
          buyerEmail:"buyer@example.com",
          amount:169000,
          currency:"KRW",
          licenseCode:"ORD-AAAA-BBBB-CCCC-DDDD",
          deviceLimit:2,
          perpetual:true,
          installerUrl:"https://api.ordentory.kr/v1/store/installer",
          created:true
        })
      });
    });
    await successPage.goto(base+"/payment-success.html?paymentKey=pay_qa_123&orderId=ORD-RESULTQA123&amount=169000",{waitUntil:"load"});
    await successPage.waitForFunction(()=>!document.querySelector("#result-success").hidden);
    assert.equal(confirmCalls,1,"confirmation called once");
    assert.equal(await successPage.locator("#purchase-order-id").textContent(),"ORD-RESULTQA123");
    assert.equal(await successPage.locator("#purchase-email").textContent(),"buyer@example.com");
    assert.ok((await successPage.locator("#purchase-amount").textContent()).includes("169,000"));
    assert.equal(await successPage.locator("#license-code").textContent(),"ORD-AAAA-BBBB-CCCC-DDDD");
    assert.equal(await successPage.locator("#installer-link").getAttribute("href"),"https://api.ordentory.kr/v1/store/installer");
    assert.equal(new URL(successPage.url()).search,"","success URL query scrubbed");
    assert.ok(await successPage.evaluate(()=>Boolean(history.state?.ordentoryPurchase)),"purchase cached in history state");

    await successPage.reload({waitUntil:"load"});
    await successPage.waitForFunction(()=>!document.querySelector("#result-success").hidden);
    assert.equal(confirmCalls,1,"reload renders cached result without reconfirm");
    assert.deepEqual(successErrors,[],"success page errors");
    await successPage.close();

    const errorPage=await browser.newPage({viewport:{width:1280,height:800}});
    await errorPage.route("https://api.ordentory.kr/v1/store/payments/confirm",route=>
      route.fulfill({status:502,contentType:"application/json",body:JSON.stringify({error:{message:"결제 확인 테스트 오류"}})})
    );
    await errorPage.goto(base+"/payment-success.html?paymentKey=pay_error&orderId=ORD-ERROR123&amount=169000",{waitUntil:"load"});
    await errorPage.waitForFunction(()=>!document.querySelector("#result-error").hidden);
    assert.ok((await errorPage.locator("#result-error-message").textContent()).includes("결제 확인 테스트 오류"));
    assert.equal(await errorPage.locator('a[href^="mailto:support@ordentory.kr"]').count(),1,"support action available");
    await errorPage.close();

    for(const [name,width,height] of [["desktop",1280,800],["mobile",390,844]]){
      const fail=await browser.newPage({viewport:{width,height}});
      await fail.goto(base+"/payment-fail.html?code=USER_CANCEL&message="+encodeURIComponent("사용자가 결제를 취소했습니다.")+"&orderId=ORD-FAILQA123",{waitUntil:"load"});
      assert.equal(await fail.locator("#fail-message").textContent(),"사용자가 결제를 취소했습니다.",name+": fail message");
      assert.equal(await fail.locator("#fail-order-id").textContent(),"ORD-FAILQA123",name+": fail order id");
      assert.equal(await fail.locator("#fail-order-box").isVisible(),true,name+": fail order box");
      assert.equal(new URL(fail.url()).search,"",name+": failure URL query scrubbed");
      const overflow=await fail.evaluate(()=>document.documentElement.scrollWidth-window.innerWidth);
      assert.ok(overflow<=2,name+": horizontal overflow "+overflow+"px");
      await fail.close();
    }

    console.log("PAYMENT RESULT QA ALL PASS");
  }finally{
    await browser.close();
    await new Promise(resolve=>server.close(resolve));
  }
})().catch(err=>{console.error(err);process.exitCode=1;server.close();});
