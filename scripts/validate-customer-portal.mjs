import fs from "node:fs";
import assert from "node:assert/strict";

const files=["login.html","signup.html","my.html","feedback.html","assets/js/account-auth.js","assets/js/my-ordentory.js","assets/js/public-feedback.js","assets/css/account.css"];
for(const file of files) assert.ok(fs.existsSync(file),file+" must exist");

const login=fs.readFileSync("login.html","utf8");
const signup=fs.readFileSync("signup.html","utf8");
const my=fs.readFileSync("my.html","utf8");
const feedback=fs.readFileSync("feedback.html","utf8");
const auth=fs.readFileSync("assets/js/account-auth.js","utf8");
const portal=fs.readFileSync("assets/js/my-ordentory.js","utf8");
const home=fs.readFileSync("index.html","utf8");

assert.match(login,/My ORDENTORY/i);
assert.match(login,/autocomplete="current-password"/);
assert.match(signup,/이메일 인증번호/);
assert.match(signup,/이용약관/);
assert.match(signup,/개인정보 수집 및 이용/);
assert.match(signup,/마케팅 정보 수신 동의/);
assert.match(my,/내 라이선스/);
assert.match(my,/내 PC/);
assert.match(my,/구매후기 작성/);
assert.match(my,/기능제안/);
assert.match(my,/문의 · 버그신고/);
assert.match(my,/사업자정보/);
assert.match(feedback,/구매 인증 후기/);
assert.match(feedback,/공개 개발현황/);

assert.match(auth,/credentials:"include"/);
assert.match(auth,/\/auth\/signup\/start/);
assert.match(auth,/\/auth\/signup\/complete/);
assert.match(auth,/\/auth\/login/);
assert.match(portal,/credentials:"include"/);
assert.match(portal,/\/portal\/overview/);
assert.match(portal,/\/business-profile/);
assert.match(portal,/\/reviews/);
assert.match(portal,/\/features/);
assert.match(portal,/\/support/);
assert.match(portal,/\/devices\//);
assert.match(home,/feedback\.html/);
assert.match(home,/login\.html/);
assert.match(home,/customer-reviews/);

for(const source of [login,signup,my,feedback,auth,portal]){
  assert.doesNotMatch(source,/ORDENTORY_TOSS_SECRET_KEY|RESEND_API_KEY|PASSWORD_HASH|LICENSE_SIGNING_SEED/i);
}
console.log("CUSTOMER PORTAL SOURCE CONTRACT PASS");
