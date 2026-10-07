# ORDENTORY Web

ORDENTORY 공식 웹사이트 저장소.

## 현재 Production 상태

현재 `ordentory.kr`은 정식 판매 오픈 전 **prelaunch one-page**만 공개한다.

- 공개 홈: `index.html`
- 검색엔진: `noindex,nofollow,noarchive`
- `checkout.html`, `trial.html`, `manual.html`, 결제 결과·약관 관련 기존 경로는 현재 모두 `/`로 즉시 이동
- Toss 실결제와 웹 Trial 발급은 공개하지 않음
- 현재 CI의 기준은 `.github/workflows/homepage-qa.yml`

향후 자사몰을 열 때는 숨겨둔 checkout/trial/payment/customer 코드를 현재 Backend API와 다시 E2E 검증한 뒤 별도 PR로 활성화한다.

과거 공개형 홈페이지를 전제로 하던 Playwright/source 검증 스크립트는 prelaunch 전환 후 제거했다. 현재 Production 검증 기준과 맞지 않는 오래된 QA를 다시 사용하지 않는다.

## 운영 원칙

- 결제 성공 여부를 브라우저만 보고 라이선스를 발급하지 않는다.
- 유료 구매는 Backend가 검증한 결제/주문 → Order Gateway → Order/Customer/License 연결을 통해 처리한다.
- 현재 판매 모듈은 Inventory v1.0.0이다.
- 향후 모듈은 실제 출시 전까지 가격·권한·출시일을 확정적으로 표시하지 않는다.
