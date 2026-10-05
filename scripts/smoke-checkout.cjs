// Browser-only direct-store checkout QA. All API and Toss calls are mocked.
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

const tossMock=`
window.TossPayments=function(){
  return {
    widgets:function(){
      return {
        setAmount:async function(v){window.__tossAmount=v;},
        renderPaymentMethods:async function(){return {destroy:async function(){}};},
        renderAgreement:async function(){return {destroy:async function(){}};},
        requestPayment:async function(v){window.__paymentRequest=v;}
      };
    }
  };
};
`;

(async()=>{
  await new Promise(resolve=>server.listen(0,"127.0.0.1",resolve));
  const base="http://127.0.0.1:"+server.address().port;
  const browser=await chromium.launch({headless:true});
  try{
    for(const [name,width,height] of [["desktop",1440,900],["mobile",390,844]]){
      const page=await browser.newPage({viewport:{width,height},reducedMotion:"reduce"});
      const errors=[];
      page.on("pageerror",e=>errors.push(e.message));

      await page.route("https://js.tosspayments.com/v2/standard",route=>
        route.fulfill({status:200,contentType:"application/javascript",body:tossMock})
      );
      await page.route("https://api.ordentory.kr/v1/store/offer",route=>
        route.fulfill({
          status:200,contentType:"application/json",
          body:JSON.stringify({
            productCode:"inventory",currency:"KRW",
            currentPrice:169000,regularPrice:199000,launchPrice:169000,
            launchOffer:true,launchLimit:30,launchRemaining:17
          })
        })
      );
      await page.route("https://api.ordentory.kr/v1/store/checkouts",async route=>{
        const req=route.request();
        assert.equal(req.method(),"POST",name+": checkout must use POST");
        const payload=req.postDataJSON();
        assert.equal(payload.buyerEmail,"buyer@example.com",name+": normalized buyer email");
        const expiresAt=new Date(Date.now()+30*60*1000).toISOString();
        await route.fulfill({
          status:201,contentType:"application/json",
          body:JSON.stringify({
            orderId:"ORD-QATEST123",orderName:"ORDENTORY Inventory",
            buyerEmail:"buyer@example.com",productCode:"inventory",
            clientKey:"test_ck_mock",customerKey:"ANONYMOUS",
            currency:"KRW",amount:169000,launchOffer:true,
            successUrl:base+"/payment-success.html",
            failUrl:base+"/payment-fail.html",expiresAt
          })
        });
      });

      await page.goto(base+"/checkout.html",{waitUntil:"load"});
      await page.waitForFunction(()=>document.querySelector("#offer-current-price")?.textContent.includes("169,000"));
      assert.equal(await page.locator("#prepare-payment").isEnabled(),true,name+": prepare button enabled after offer");
      assert.ok((await page.locator("#offer-regular-price").textContent()).includes("199,000"),name+": regular price shown");
      assert.ok((await page.locator("#offer-status").textContent()).includes("17개"),name+": launch remaining shown");

      await page.locator("#buyer-email").fill("BUYER@example.com");
      await page.locator("#checkout-policy-consent").check();
      await page.locator("#checkout-delivery-consent").check();
      await page.locator("#prepare-payment").click();
      await page.waitForFunction(()=>!document.querySelector("#checkout-payment").hidden);

      assert.ok((await page.locator("#summary-price").textContent()).includes("169,000"),name+": reserved amount shown");
      assert.equal(await page.locator("#summary-offer").textContent(),"출시 기념가",name+": reserved offer shown");
      assert.equal(await page.locator("#request-payment").isEnabled(),true,name+": payment button enabled");
      const expiry=await page.locator("#summary-expiry").textContent();
      assert.match(expiry,/\d+분 \d{2}초/,name+": checkout expiry countdown");
      assert.equal(await page.evaluate(()=>window.__tossAmount?.value),169000,name+": Toss amount uses server checkout amount");

      await page.locator("#request-payment").click();
      await page.waitForFunction(()=>window.__paymentRequest?.orderId==="ORD-QATEST123");
      const payment=await page.evaluate(()=>window.__paymentRequest);
      assert.equal(payment.customerEmail,"buyer@example.com",name+": Toss customer email");
      assert.equal(payment.successUrl,base+"/payment-success.html",name+": success URL from server");

      const overflow=await page.evaluate(()=>document.documentElement.scrollWidth-window.innerWidth);
      assert.ok(overflow<=2,name+": horizontal overflow "+overflow+"px");
      assert.deepEqual(errors,[],name+": page errors");
      console.log("PASS checkout "+name+" offer -> reservation -> Toss handoff");
      await page.close();
    }

    const unavailable=await browser.newPage({viewport:{width:1280,height:800}});
    await unavailable.route("https://js.tosspayments.com/v2/standard",route=>
      route.fulfill({status:200,contentType:"application/javascript",body:tossMock})
    );
    await unavailable.route("https://api.ordentory.kr/v1/store/offer",route=>
      route.fulfill({status:503,contentType:"application/json",body:JSON.stringify({error:{message:"자사몰 결제 기능을 준비 중입니다."}})})
    );
    await unavailable.goto(base+"/checkout.html",{waitUntil:"load"});
    await unavailable.waitForFunction(()=>document.querySelector("#prepare-payment")?.textContent.includes("준비 중"));
    assert.equal(await unavailable.locator("#prepare-payment").isDisabled(),true,"disabled when store offer unavailable");
    assert.equal(await unavailable.locator("#offer-current-price").textContent(),"판매 준비 중");
    await unavailable.close();

    console.log("CHECKOUT QA ALL PASS");
  }finally{
    await browser.close();
    await new Promise(resolve=>server.close(resolve));
  }
})().catch(err=>{console.error(err);process.exitCode=1;server.close();});
