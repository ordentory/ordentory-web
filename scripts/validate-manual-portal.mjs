// Gate a separately hosted full PDF to the SAME approved v1.0.0 manual hash
// required by the signed Windows installer. Absence leaves the HTML guide
// available but the PDF download button hidden.
import {existsSync,readFileSync} from "node:fs";
import {createHash} from "node:crypto";
import assert from "node:assert/strict";
const read=p=>readFileSync(new URL("../"+p,import.meta.url),"utf8");
const page=read("manual.html");
const trial=read("trial.html");
const paid=read("payment-success.html");
const homepage=read("index.html");
const manualPath=new URL("../assets/manuals/ORDENTORY_v1.0.0_User_Manual.pdf",import.meta.url);
const approvedSHA256="8f54a0649aa994ba4515eee6745b0dc631b0045f32d213c604611704b3f15bce";
assert.ok(page.includes('id="manual-pdf"')&&page.includes("method:\"HEAD\""),"online link must be gated by availability");
assert.ok(page.includes("ORDENTORY_User_Manual.pdf")&&page.includes("START-HERE.pdf"),"installer local doc paths");
for (const [label,s] of [["trial",trial],["paid",paid],["homepage",homepage]]){
 assert.ok(s.includes('href="manual.html"'),label+": missing manual portal link");
}
if(existsSync(manualPath)){
 const bytes=readFileSync(manualPath);
 assert.ok(bytes.subarray(0,5).equals(Buffer.from("%PDF-")),"online manual must be PDF");
 assert.equal(createHash("sha256").update(bytes).digest("hex"),approvedSHA256,
  "online manual differs from approved commercial PDF — publication BLOCKED");
 console.log("PASS: web PDF matches official 44-page manual manifest");
}else{
 if(process.env.REQUIRE_APPROVED_MANUAL==="true"){
  throw new Error("Approved full PDF must be supplied before publishing customer manual download");
 }
 console.log("INFO: approved online PDF not published; manual button stays hidden; HTML getting-started guide remains available");
}
console.log("PASS: manual portal and installer/customer emails navigation");
