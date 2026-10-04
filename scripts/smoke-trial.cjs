// Browser-only Trial QA. All API requests are fulfilled by in-browser mocks.
// No email, license issuance, installer download or production mutation occurs.
const assert=require("node:assert/strict");
const http=require("node:http");
const fs=require("node:fs");
const path=require("node:path");
const {chromium}=require("playwright");
const root=path.resolve(__dirname,"..");
const mime={".html":"text/html; charset=utf-8",".css":"text/css; charset=utf-8",".js":"application/javascript; charset=utf-8",".png":"image/png"};
const server=http.createServer((request,response)=>{
 const url=new URL(request.url||"/","http://localhost");
 const target=path.resolve(root,"."+url.pathname);
 if(!target.startsWith(root+path.sep)||!fs.existsSync(target)||!fs.statSync(target).isFile()){
  response.writeHead(404);response.end("not found");return;
 }
 response.setHeader("Content-Type",mime[path.extname(target)]||"application/octet-stream");
 fs.createReadStream(target).pipe(response);
});
(async()=>{
 await new Promise(resolve=>server.listen(0,"127.0.0.1",resolve));
 const origin="http://127.0.0.1:"+server.address().port;
 const browser=await chromium.launch({headless:true});
 try{
  for(const [name,width,height] of [["desktop",1280,900],["mobile",390,844]]){
   const page=await browser.newPage({viewport:{width,height},reducedMotion:"reduce"});
   const errors=[];
   let otpRequests=0,issueRequests=0;
   page.on("pageerror",err=>errors.push(err.message));
   await page.route("https://api.ordentory.kr/v1/store/trials**",async route=>{
    const request=route.request();
    const cors={
     "access-control-allow-origin":origin,
     "access-control-allow-methods":"POST, OPTIONS",
     "access-control-allow-headers":"content-type",
     "content-type":"application/json; charset=utf-8"
    };
    if(request.method()==="OPTIONS"){
     return route.fulfill({status:204,headers:cors,body:""});
    }
    const payload=JSON.parse(request.postData()||"{}");
    if(request.url().endsWith("/email/start")){
     otpRequests++;
     assert.deepEqual(payload,{email:"buyer@example.com"},name+": OTP email request");
     return route.fulfill({status:201,headers:cors,
      body:JSON.stringify({challengeId:"12345678-1234-1234-1234-123456789abc",expiresAt:new Date(Date.now()+300000).toISOString(),verificationSent:true})});
    }
    issueRequests++;
    assert.equal(payload.email,"buyer@example.com");
    assert.equal(payload.challengeId,"12345678-1234-1234-1234-123456789abc");
    if(payload.code!=="123456"){
     return route.fulfill({status:400,headers:cors,body:JSON.stringify({error:{code:"TRIAL_OTP_INVALID",message:"인증번호가 올바르지 않습니다."}})});
    }
    return route.fulfill({status:201,headers:cors,body:JSON.stringify({
     email:"buyer@example.com",licenseCode:"ORD-ABCD-EFGH-IJKL-MNOP",trialDays:7,deviceLimit:1,emailDelivery:"queued",
     installerUrl:"https://api.ordentory.kr/v1/store/installer"
    })});
   });
   await page.goto(origin+"/trial.html",{waitUntil:"load"});
   await page.locator("#trial-email").fill("buyer@example.com");
   await page.locator("#start-trial-email").click();
   assert.ok((await page.locator("#trial-error").textContent()).includes("동의"),name+": mandatory consent");
   assert.equal(otpRequests,0,name+": no OTP without consent");
   await page.locator("#trial-policy-consent").check();
   await page.locator("#start-trial-email").click();
   await page.locator("#trial-otp-step").waitFor({state:"visible"});
   assert.equal(otpRequests,1,name+": OTP sent once");
   assert.equal(issueRequests,0,name+": no license before OTP");
   await page.locator("#trial-otp").fill("000000");
   await page.locator("#issue-trial").click();
   await page.waitForFunction(()=>document.getElementById("trial-error").textContent.includes("올바르지"));
   assert.equal(await page.locator("#trial-result").isVisible(),false,name+": wrong OTP cannot issue");
   await page.locator("#trial-otp").fill("123456");
   await page.locator("#issue-trial").click();
   await page.locator("#trial-result").waitFor({state:"visible"});
   assert.equal(issueRequests,2,name+": only verified OTP issues");
   assert.equal(await page.locator("#trial-code").textContent(),"ORD-ABCD-EFGH-IJKL-MNOP");
   assert.equal(await page.locator("#trial-installer").getAttribute("href"),"https://api.ordentory.kr/v1/store/installer");
   assert.ok((await page.locator("#trial-email-notice").textContent()).includes("발송 대기"),name+": queued mail not falsely reported as delivered");
   assert.deepEqual(errors,[],name+": no runtime errors");
   const overflow=await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth);
   assert.ok(overflow<=2,name+": horizontal overflow "+overflow+"px");
   fs.mkdirSync(path.join(root,"artifacts"),{recursive:true});
   await page.screenshot({path:path.join(root,"artifacts","trial-"+name+".png"),fullPage:true});
   console.log("PASS verified Trial "+name+" "+width+"px, OTP, error handling, code & download, zero live API requests");
   await page.close();
  }
  console.log("TRIAL BROWSER QA ALL PASS");
 }finally{
  await browser.close();
  await new Promise(resolve=>server.close(resolve));
 }
})().catch(err=>{console.error(err);process.exitCode=1;server.close()});
