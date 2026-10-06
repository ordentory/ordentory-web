import fs from "node:fs";
import assert from "node:assert/strict";

const files=["login.html","signup.html","forgot-password.html","my.html","feedback.html","assets/js/account-auth.js","assets/js/my-ordentory.js","assets/js/public-feedback.js","assets/css/account.css"];
for(const file of files) assert.ok(fs.existsSync(file),file+" must exist");

const login=fs.readFileSync("login.html","utf8");
const signup=fs.readFileSync("signup.html","utf8");
const forgot=fs.readFileSync("forgot-password.html","utf8");
const my=fs.readFileSync("my.html","utf8");
const feedback=fs.readFileSync("feedback.html","utf8");
const auth=fs.readFileSync("assets/js/account-auth.js","utf8");
const portal=fs.readFileSync("assets/js/my-ordentory.js","utf8");
const checkout=fs.readFileSync("assets/js/checkout.js","utf8");
const checkoutHtml=fs.readFileSync("checkout.html","utf8");
const home=fs.readFileSync("index.html","utf8");

assert.match(login,/My ORDENTORY/i);
assert.match(login,/autocomplete="current-password"/);
assert.match(signup,/이메일 인증번호/);
assert.match(signup,/이용약관/);
assert.match(signup,/개인정보 수집 및 이용/);
assert.match(signup,/마케팅 정보 수신 동의/);
assert.match(forgot,/비밀번호 재설정/);
assert.match(forgot,/인증번호/);
assert.match(forgot,/reset-otp/);
assert.match(my,/내 라이선스/);
assert.match(my,/내 PC/);
assert.match(my,/구매후기 작성/);
assert.match(my,/구매 증빙/);
assert.match(my,/기능제안/);
assert.match(my,/문의 · 버그신고/);
assert.match(my,/사업자정보/);
assert.match(my,/계정정보/);
assert.match(my,/비밀번호 변경/);
assert.match(feedback,/구매 인증 후기/);
assert.match(feedback,/공개 개발현황/);

assert.match(auth,/credentials:"include"/);
assert.match(auth,/\/auth\/signup\/start/);
assert.match(auth,/\/auth\/signup\/complete/);
assert.match(auth,/\/auth\/login/);
assert.match(auth,/\/auth\/password-reset\/start/);
assert.match(auth,/\/auth\/password-reset\/complete/);
assert.match(portal,/credentials:"include"/);
assert.match(portal,/\/portal\/overview/);
assert.match(portal,/\/auth\/profile/);
assert.match(portal,/\/auth\/password/);
assert.match(portal,/\/billing/);
assert.match(portal,/\/business-profile/);
assert.match(portal,/\/reviews/);
assert.match(portal,/\/features/);
assert.match(portal,/\/support/);
assert.match(portal,/\/devices\//);
assert.equal((portal.match(/el\("account-profile-form"\)\.addEventListener/g)||[]).length,1,"account profile submit handler must be registered once");
assert.equal((portal.match(/el\("account-password-form"\)\.addEventListener/g)||[]).length,1,"account password submit handler must be registered once");
assert.match(portal,/발행 대기/);
assert.match(portal,/발행 완료/);
assert.match(portal,/발행 실패/);
assert.match(home,/feedback\.html/);
assert.match(home,/login\.html/);
assert.match(home,/customer-reviews/);
assert.match(checkout,/\/auth\/session/);
assert.match(checkout,/\/customer.*store\/checkouts|CUSTOMER_API\+"\/store\/checkouts"/);
assert.match(checkout,/credentials:"include"/);
assert.match(checkoutHtml,/id="billing-preference"/);
assert.match(checkoutHtml,/ORDENTORY 계정 이메일/);

for(const source of [login,signup,forgot,my,feedback,auth,portal,checkout,checkoutHtml]){
  assert.doesNotMatch(source,/ORDENTORY_TOSS_SECRET_KEY|RESEND_API_KEY|PASSWORD_HASH|LICENSE_SIGNING_SEED/i);
}
console.log("CUSTOMER PORTAL SOURCE CONTRACT PASS");
