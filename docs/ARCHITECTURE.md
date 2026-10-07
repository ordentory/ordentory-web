# ORDENTORY Web Architecture

## 역할

웹사이트는 ORDENTORY의 판매·고객 접점이며 라이선스 정책의 source of truth가 아니다.
권한 부여와 유료 주문 확정은 Backend가 담당한다.

## 현재 공개 구조

정식 오픈 전에는 one-page prelaunch 화면만 공개한다.

```text
ordentory.kr /
  -> prelaunch brand/product page

checkout/trial/payment/manual/legal legacy routes
  -> noindex
  -> immediate redirect to /
```

숨겨진 자사몰 코드는 향후 오픈 준비 자산으로 유지하되, 공개 전 현재 Backend와 다시 검증한다.

## 향후 자사몰 구매 흐름

```text
Customer
  -> ORDENTORY checkout
  -> Toss Payments
  -> Backend server-side payment confirmation
  -> Order Gateway
  -> Customer + PAID Order + Inventory entitlement + License
  -> confirmation email / installer delivery
```

브라우저의 client-side 성공 화면만으로 Order나 License를 만들지 않는다.

## 판매채널 독립성

Inventory 정식 구매의 라이선스 정책은 판매채널과 무관하게 동일하다.

- 1 사업체
- 최대 2 PC
- 영구 사용권
- v1.x 무료 업데이트

크몽 구매는 KMONG Order, 자사몰 구매는 ORDENTORY_STORE Order로 출처를 보존한다.

## Production QA

현재 Production source of truth는 다음이다.

- `index.html`
- `robots.txt`
- 숨김 경로 redirect HTML
- `.github/workflows/homepage-qa.yml`

prelaunch 상태에서 과거 전체 storefront를 검증하던 Playwright/source validation 스크립트는 사용하지 않는다.
