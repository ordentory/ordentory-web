# ORDENTORY Website: module architecture (2026-10-05)

## Source of truth
- Desktop architecture: `ordentory/ordentory-desktop/docs/ARCHITECTURE.md`.
- Currently sold module: **Inventory v1.0.0** (Windows, one business, up to two PCs, perpetual; v1.x updates).
- Desktop is designed as **one installed application**, with additional modules gated by their own entitlements. Do not portray each module as a separate executable.
- Planned modules documented in Desktop architecture: **Sales**, **Order**, **Label**. These are directions, not product commitments, available entitlements, prices, or release dates.
- Inventory **already includes basic purchasing**: supplier, purchase order, ordered/expected stock, actual and partial receipt. The future Order module, if released, extends this; never imply Inventory requires Order to receive stock.
- Naver/Coupang channel integration is beta and **not a paid general-availability module**.

## Website structure
- The site header and product family belong to **ORDENTORY**, not permanently to Inventory.
- Main homepage features the **first available module, Inventory**. Mark its product demos and pricing with the specific module name and released version.
- The `#modules` catalogue uses reusable entries with `data-module="<slug>"` and `data-module-status="current|planned"`. Stable slugs are `inventory`, `sales`, `order`, `label`.
- A future module may receive its own page (for example `/modules/sales.html`) without changing the Inventory `#product`, `#demo`, `#pricing` or its checkout. Add future navigation/CTA only when approved and implemented.
- Never share a live purchase CTA or Inventory price/terms with `planned` modules. Publish planned module pricing, trial eligibility, device policy and entitlement only after separate approval.
- The first live Inventory checkout remains disabled until the production Toss launch is explicitly authorized. Keep QA checkout isolated.
- Reconstructed UI must refer to **Desktop v1.0.0** source controls; use HTML/CSS-rendered Korean text rather than raster screenshots that cause illegible glyphs.
- Reconstructed screens display sample data and must say so. Do not use fictitious data as real customer case studies.

## Inventory v1.0.0 UI contract (Desktop frontend/src/main.ts and purchase.ts)
- Sidebar core: 홈, 상품, 재고, 입출고, 공급처, 발주 · 입고예정, 가져오기.
- Common sidebar: 데이터 보관, 프로그램 업데이트, 라이선스, 프로그램 정보, 도움말. Channel integration may appear separately for eligible beta users.
- Home: 오늘의 업무; 사용중 상품, 전체 현재고, 안전재고 이하, 초기재고 미입력, 오늘 입고, 오늘 출고, 참고 재고금액 (a non-accounting reference).
- Product-registration stages: 1 Product, 2 SKU / Option, 3 Supplier, 4 Channel Listing (beta mapping separately).
- Ledger: 입출고 · 재고원장, 기간별 요약, Excel 저장, CSV 저장; actual table includes 업무일자, 유형, 상품 / SKU, 변동, 재고, 사유 / 공급처, 상태 / 작업. Marketing mock may selectively show columns for readability but must not fabricate functions.
- Basic purchasing: 발주추천 uses current, safety and expected stock; 발주서 작성 → 발주완료 · 입고예정 → actual receipt. Remaining unreceived units stay expected; status change alone does NOT increase current stock.
- Barcode quick movement, stocktake, Excel/CSV, backups are part of Inventory v1.0.0 as per release gap audit.

## Preview and QA
- Production source is `index.html` + `assets/css/main.css` + `assets/js/main.js`.
- `preview.html` is a **standalone generated equivalent** of the above three files, so manual preview changes must be propagated back to source (prefer regenerating preview).
- Run `node scripts/validate-homepage.mjs` after homepage changes. It checks the preview sync, current price and version, modules, and v1.0.0 UI labels.
- Visual acceptance: desktop 1440/1280, tablet 768, mobile 390/360; ensure long Korean words remain readable, demo tabs work and do not continue cycling while offscreen.
- Do NOT merge PR #1 or this improvement branch, deploy public website, enable direct checkout or change Railway as part of a design review.
