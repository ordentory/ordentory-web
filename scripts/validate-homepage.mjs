// Dependency-free repository checks. Does not use network, payments or QA/production APIs.
import { readFileSync } from "node:fs";
import assert from "node:assert/strict";
const read = (p) => readFileSync(new URL("../" + p, import.meta.url), "utf8");
const html = read("index.html");
const css = read("assets/css/main.css");
const js = read("assets/js/main.js");
const preview = read("preview.html");
const expectedPreview = html
  .replace('<link rel="stylesheet" href="assets/css/main.css">', '<style>\n' + css + '\n</style>')
  .replace('<script src="assets/js/main.js"></script>', '<script>\n' + js + '\n</script>');
const check=(name,condition)=>{assert.ok(condition,name);process.stdout.write("PASS " + name + "\n");};
check("Standalone preview matches live HTML/CSS/JS",preview===expectedPreview);
check("Commercial Inventory version is v1.0.0",html.includes("ORDENTORY INVENTORY v1.0.0")&&!/v1\.0\.[1-9]/.test(html+read("checkout.html")));
check("Inventory-only price and VAT",html.includes("169,000원")&&html.includes("199,000원")&&html.includes("VAT 포함 · Inventory 모듈 기준"));
check("Purchase button remains disabled",html.includes('class="button button-disabled" aria-disabled="true"'));
check("Desktop sidebar labels",["홈","상품","재고","입출고","공급처","발주 · 입고예정","가져오기","데이터 보관","프로그램 업데이트","라이선스","프로그램 정보","도움말"].every(x=>html.includes(">"+x+"</span>")));
check("Seven Desktop dashboard metric labels",["사용중 상품","전체 현재고","안전재고 이하","초기재고 미입력","오늘 입고","오늘 출고","참고 재고금액"].every(x=>html.includes(">"+x+"</span>")));
check("Product registration stage names",["1. Product","2. SKU / Option","3. Supplier","4. Channel Listing"].every(x=>html.includes(x)));
check("Partial receipt sample leaves remainder",html.includes("<span>20</span><span>0</span><b>20</b><em>5</em>")&&html.includes("미입고")&&html.includes("실제 입고처리"));
check("Module slugs are unique and separated",["inventory","sales","order","label"].every(x=>(html.match(new RegExp('data-module="'+x+'"','g'))||[]).length===1));
check("Only Inventory is marketed as current",html.includes('data-module="inventory" data-module-status="current"')&&["sales","order","label"].every(x=>html.includes('data-module="'+x+'" data-module-status="planned"')));
check("Planned modules have no asserted release or bundled entitlements",html.includes("세부 기능·가격·출시 일정은 확정되지 않았습니다."));
check("Demo pauses outside visible tab/viewport",js.includes("document.hidden")&&js.includes("demoInView")&&js.includes("visibilitychange"));
check("Marketing mock sample disclaimer",html.includes("상품과 수량은 샘플 데이터입니다."));
for(const match of html.matchAll(/href="#([^"]+)"/g)){
  const id=match[1];
  check("Anchor #" + id,html.includes('id="'+id+'"'));
}
process.stdout.write("All homepage source checks passed.\n");
