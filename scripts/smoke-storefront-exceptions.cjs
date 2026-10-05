// Negative-path storefront QA. All payment, Trial and API behavior is mocked.
// No production payment, email, license issuance or installer request occurs.
const assert=require("node:assert/strict");
const http=require("node:http");
const fs=require("node:fs");
const path=require("node:path");
const {chromium}=require("playwright");

const root=path.resolve(__dirname,"..");
const mime={".html":"text/html; charset=utf-8",".css":"text/css; charset=utf-8",".js":"application/javascript; charset=utf-8",".png":"image/png",".webp":"image/webp"};
const server=http.createServer((req,res)=>{
  const url=new URL(req.url||"/","http://localhost");
  const file=path.resolve(root,"."+(url.pathname==="/" ? "/index.html" : url.pathname));
  if(!file.startsWith(root+path.sep)||!fs.existsSync(file)||!fs.statSync(file).isFile()){
    res.writeHead(404);res.end("not found");return;
  }
  res.setHeader("Content-Type",mime[path.extname(file)]||"application/octet-stream");
  res.setHeader("Cache-Control","no-store");
  fs.createReadStream(file).pipe(res);
});

const offer={productCode:"inventory",currency:"KRW",currentPrice:169000,regularPrice:199000,launchPrice:169000,launchOffer:true,launchLimit:30,launchRemaining:17};
const tossOk=`
window.TossPayments=function(){
 return {widgets:function(){return {
  setAmount:async function(){},
  renderPaymentMethods:async function(){return {destroy:async function(){}};},
  renderAgreement:async function(){return {destroy:async function(){}};},
  requestPayment:async function(){window.__requestPaymentCalled=true;}
 }}};
};`;
const tossThrows=`
window.TossPayments=function(){
 return {widgets:function(){return {
  setAmount:async function(){},
  renderPaymentMethods:async function(){return {destroy:async function(){}};},
  renderAgreement:async function(){return {destroy:async function(){}};},
  requestPayment:async function(){throw new Error("결제창을 열 수 없습니다.");}
 }}};
};`;

function cors(origin){
 return {
  "access-control-allow-origin":origin,
  "access-control-allow-credentials":"true",
  "access-control-allow-methods":"GET, POST, OPTIONS",
  "access-control-allow-headers":"content-type",
  "content-type":"application/json; charset=utf-8"
 };
}

async function mockOffer(page,origin){
 await page.route("https://api.ordentory.kr/**",route=>route.abort());
 await page.route("https://api.ordentory.kr/v1/store/offer",route=>route.fulfill({status:200,headers:cors(origin),body:JSON.stringify(offer)}));
 await page.route("https://api.ordentory.kr/v1/customer/auth/session",route=>route.fulfill({
  status:200,headers:cors(origin),
  body:JSON.stringify({customerId:"11111111-1111-4111-8111-111111111111",email:"buyer@example.com",fullName:"구매자",phone:"01012345678",expiresAt:new Date(Date.now()+3600000).toISOString()})
 }));
}

(async()=>{
 await new Promise(resolve=>server.listen(0,"127.0.0.1",resolve));
 const origin="http://127.0.0.1:"+server.address().port;
 const browser=await chromium.launch({headless:true});
 try{
  // 1) Checkout: required consents must block order creation.
  {
   const page=await browser.newPage({viewport:{width:1100,height:850},reducedMotion:"reduce"});
   let checkoutCalls=0;
   await mockOffer(page,origin);
   await page.route("https://js.tosspayments.com/v2/standard",route=>route.fulfill({status:200,contentType:"application/javascript",body:tossOk}));
   await page.route("https://api.ordentory.kr/v1/customer/store/checkouts",route=>{checkoutCalls++;return route.fulfill({status:500,headers:cors(origin),body:"{}"});});
   await page.goto(origin+"/checkout.html",{waitUntil:"load"});
   await page.waitForFunction(()=>!document.querySelector("#prepare-payment").disabled);
   await page.locator("#prepare-payment").click();
   assert.match(await page.locator("#checkout-error").textContent(),/이용약관/,"policy consent required");
   assert.equal(checkoutCalls,0,"no checkout API without policy consent");
   await page.locator("#checkout-policy-consent").check();
   await page.locator("#prepare-payment").click();
   assert.match(await page.locator("#checkout-error").textContent(),/디지털 제공/,"delivery consent required");
   assert.equal(checkoutCalls,0,"no checkout API without delivery consent");
   console.log("PASS exception checkout blocks missing consents");
   await page.close();
  }

  // 2) Checkout: order reservation failure stays on safe pre-payment screen.
  {
   const page=await browser.newPage({viewport:{width:1100,height:850},reducedMotion:"reduce"});
   await mockOffer(page,origin);
   await page.route("https://js.tosspayments.com/v2/standard",route=>route.fulfill({status:200,contentType:"application/javascript",body:tossOk}));
   await page.route("https://api.ordentory.kr/v1/customer/store/checkouts",route=>route.fulfill({
    status:503,headers:cors(origin),body:JSON.stringify({error:{message:"결제 주문을 준비하지 못했습니다."}})
   }));
   await page.goto(origin+"/checkout.html",{waitUntil:"load"});
   await page.waitForFunction(()=>!document.querySelector("#prepare-payment").disabled);
   await page.locator("#checkout-policy-consent").check();
   await page.locator("#checkout-delivery-consent").check();
   await page.locator("#prepare-payment").click();
   await page.waitForFunction(()=>document.querySelector("#checkout-error").textContent.includes("준비하지 못했습니다"));
   assert.equal(await page.locator("#checkout-payment").isVisible(),false,"payment methods hidden after reservation failure");
   assert.equal(await page.locator("#prepare-payment").isEnabled(),true,"retry remains possible");
   console.log("PASS exception checkout reservation failure is recoverable");
   await page.close();
  }

  // 3) Checkout: expired reservation disables payment before Toss request.
  {
   const page=await browser.newPage({viewport:{width:1100,height:850},reducedMotion:"reduce"});
   await mockOffer(page,origin);
   await page.route("https://js.tosspayments.com/v2/standard",route=>route.fulfill({status:200,contentType:"application/javascript",body:tossOk}));
   await page.route("https://api.ordentory.kr/v1/customer/store/checkouts",route=>route.fulfill({
    status:201,headers:cors(origin),body:JSON.stringify({
     orderId:"ORD-EXPIRE123",orderName:"ORDENTORY Inventory",buyerEmail:"buyer@example.com",productCode:"inventory",
     clientKey:"test_ck_mock",customerKey:"11111111-1111-4111-8111-111111111111",currency:"KRW",amount:169000,launchOffer:true,
     successUrl:origin+"/payment-success.html",failUrl:origin+"/payment-fail.html",expiresAt:new Date(Date.now()+1200).toISOString()
    })
   }));
   await page.goto(origin+"/checkout.html",{waitUntil:"load"});
   await page.waitForFunction(()=>!document.querySelector("#prepare-payment").disabled);
   await page.locator("#checkout-policy-consent").check();
   await page.locator("#checkout-delivery-consent").check();
   await page.locator("#prepare-payment").click();
   await page.locator("#checkout-payment").waitFor({state:"visible"});
   await page.waitForFunction(()=>document.querySelector("#summary-expiry").textContent.includes("만료"),null,{timeout:5000});
   assert.equal(await page.locator("#request-payment").isDisabled(),true,"expired order blocks payment");
   assert.match(await page.locator("#request-payment").textContent(),/다시 준비/);
   assert.equal(await page.evaluate(()=>window.__requestPaymentCalled===true),false,"Toss not called after expiry");
   console.log("PASS exception expired checkout blocks Toss handoff");
   await page.close();
  }

  // 4) Checkout: Toss UI failure surfaces error and permits a safe retry.
  {
   const page=await browser.newPage({viewport:{width:1100,height:850},reducedMotion:"reduce"});
   await mockOffer(page,origin);
   await page.route("https://js.tosspayments.com/v2/standard",route=>route.fulfill({status:200,contentType:"application/javascript",body:tossThrows}));
   await page.route("https://api.ordentory.kr/v1/customer/store/checkouts",route=>route.fulfill({
    status:201,headers:cors(origin),body:JSON.stringify({
     orderId:"ORD-TOSSFAIL123",orderName:"ORDENTORY Inventory",buyerEmail:"buyer@example.com",productCode:"inventory",
     clientKey:"test_ck_mock",customerKey:"11111111-1111-4111-8111-111111111111",currency:"KRW",amount:169000,launchOffer:true,
     successUrl:origin+"/payment-success.html",failUrl:origin+"/payment-fail.html",expiresAt:new Date(Date.now()+1800000).toISOString()
    })
   }));
   await page.goto(origin+"/checkout.html",{waitUntil:"load"});
   await page.waitForFunction(()=>!document.querySelector("#prepare-payment").disabled);
   await page.locator("#checkout-policy-consent").check();
   await page.locator("#checkout-delivery-consent").check();
   await page.locator("#prepare-payment").click();
   await page.locator("#checkout-payment").waitFor({state:"visible"});
   await page.locator("#request-payment").click();
   await page.waitForFunction(()=>document.querySelector("#payment-error").textContent.includes("열 수 없습니다"));
   assert.equal(await page.locator("#request-payment").isEnabled(),true,"payment button re-enabled after provider UI error");
   assert.equal(await page.locator("#request-payment").textContent(),"결제하기");
   console.log("PASS exception Toss UI error is recoverable");
   await page.close();
  }

  // 5) Payment confirmation: missing callback data never calls confirm and instructs support.
  {
   const page=await browser.newPage({viewport:{width:900,height:760}});
   let confirmCalls=0;
   await page.route("https://api.ordentory.kr/**",route=>{confirmCalls++;return route.abort();});
   await page.goto(origin+"/payment-success.html",{waitUntil:"load"});
   await page.locator("#result-error").waitFor({state:"visible"});
   assert.equal(confirmCalls,0,"missing callback data makes zero API calls");
   assert.match(await page.locator("#result-error-message").textContent(),/필요한 정보를 확인할 수 없습니다/);
   assert.equal(await page.locator('a[href="/checkout.html"]').count(),0,"ambiguous state does not invite repayment");
   console.log("PASS exception missing payment callback blocks duplicate payment risk");
   await page.close();
  }

  // 6) Payment confirmation: malformed entitlement response is rejected.
  {
   const page=await browser.newPage({viewport:{width:900,height:760}});
   await page.route("https://api.ordentory.kr/**",route=>route.abort());
   await page.route("https://api.ordentory.kr/v1/store/payments/confirm",route=>route.fulfill({
    status:200,headers:cors(origin),body:JSON.stringify({
     orderId:"ORD-BADRESP1234",buyerEmail:"buyer@example.com",amount:169000,currency:"KRW",
     licenseCode:"INVALID",deviceLimit:99,perpetual:false,installerUrl:"https://evil.example/installer.exe"
    })
   }));
   await page.goto(origin+"/payment-success.html?paymentKey=pay_bad&orderId=ORD-BADRESP1234&amount=169000",{waitUntil:"load"});
   await page.locator("#result-error").waitFor({state:"visible"});
   assert.equal(await page.locator("#result-success").isVisible(),false,"invalid entitlement cannot render success");
   assert.match(await page.locator("#result-error-message").textContent(),/응답이 올바르지 않습니다/);
   assert.ok(!page.url().includes("paymentKey="),"paymentKey sanitized even on malformed response");
   console.log("PASS exception malformed payment entitlement is rejected");
   await page.close();
  }

  // 7) Trial: public rate-limit response never advances to OTP.
  {
   const page=await browser.newPage({viewport:{width:900,height:760},reducedMotion:"reduce"});
   await page.route("https://api.ordentory.kr/**",route=>route.abort());
   await page.route("https://api.ordentory.kr/v1/store/trials/email/start",async route=>{
    const h=cors(origin);
    if(route.request().method()==="OPTIONS")return route.fulfill({status:204,headers:h,body:""});
    return route.fulfill({status:429,headers:h,body:JSON.stringify({error:{code:"PUBLIC_TRIAL_RATE_LIMITED",message:"무료체험 요청이 많습니다. 잠시 후 다시 시도해 주세요."}})});
   });
   await page.goto(origin+"/trial.html",{waitUntil:"load"});
   await page.locator("#trial-email").fill("buyer@example.com");
   await page.locator("#trial-policy-consent").check();
   await page.locator("#start-trial-email").click();
   await page.waitForFunction(()=>document.querySelector("#trial-error").textContent.includes("요청이 많습니다"));
   assert.equal(await page.locator("#trial-otp-step").isVisible(),false,"rate limited request never reaches OTP");
   assert.equal(await page.locator("#start-trial-email").isEnabled(),true,"email form remains recoverable");
   console.log("PASS exception Trial rate limit remains safe");
   await page.close();
  }

  // 8) Trial: server OTP-expired response zeroes challenge time and blocks repeat issuance locally.
  {
   const page=await browser.newPage({viewport:{width:900,height:760},reducedMotion:"reduce"});
   let issueCalls=0;
   await page.route("https://api.ordentory.kr/**",route=>route.abort());
   await page.route("https://api.ordentory.kr/v1/store/trials**",async route=>{
    const h=cors(origin);
    if(route.request().method()==="OPTIONS")return route.fulfill({status:204,headers:h,body:""});
    if(route.request().url().endsWith("/email/start")){
     return route.fulfill({status:201,headers:h,body:JSON.stringify({
      challengeId:"bbbbbbbb-cccc-4ddd-8eee-ffffffffffff",expiresAt:new Date(Date.now()+300000).toISOString(),verificationSent:true
     })});
    }
    issueCalls++;
    return route.fulfill({status:400,headers:h,body:JSON.stringify({error:{code:"TRIAL_OTP_EXPIRED",message:"인증번호가 만료되었습니다."}})});
   });
   await page.goto(origin+"/trial.html",{waitUntil:"load"});
   await page.locator("#trial-email").fill("buyer@example.com");
   await page.locator("#trial-policy-consent").check();
   await page.locator("#start-trial-email").click();
   await page.locator("#trial-otp-step").waitFor({state:"visible"});
   await page.locator("#trial-otp").fill("123456");
   await page.locator("#issue-trial").click();
   await page.waitForFunction(()=>document.querySelector("#trial-error").textContent.includes("만료"));
   assert.equal(issueCalls,1,"server receives first expired OTP attempt");
   await page.locator("#issue-trial").click();
   await page.waitForFunction(()=>document.querySelector("#trial-error").textContent.includes("재발송"));
   assert.equal(issueCalls,1,"second expired OTP attempt blocked locally");
   assert.equal(await page.locator("#trial-result").isVisible(),false,"expired OTP never issues Trial");
   console.log("PASS exception Trial expired OTP cannot issue or repeat");
   await page.close();
  }

  console.log("STOREFRONT EXCEPTION QA ALL PASS");
 }finally{
  await browser.close();
  await new Promise(resolve=>server.close(resolve));
 }
})().catch(err=>{console.error(err);process.exitCode=1;server.close()});
