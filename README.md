# ORDENTORY Web

Public website and direct-sales frontend for ORDENTORY.

Planned responsibilities:

- Product pages
- ORDENTORY account
- Checkout
- Purchase completion
- Download guidance
- License/account view
- Customer self-service
- Support and documentation

The website talks to `ordentory-backend`.
It does not implement licensing logic itself.

## Initial product

ORDENTORY Inventory

Planned product family:

- Inventory
- Sales
- Order
- Label
- BUSINESS (all module entitlements)

## Status

Repository initialized for the future direct-sales channel. The desktop and backend foundations are built first.


## 2026-10-05 production-candidate verification

- Public site candidate is consolidated in PR #24 against `main`.
- Homepage direct purchase CTA remains disabled until Toss production credentials and final payment E2E are approved.
- Verified-email 7-day Trial UI is included; backend feature flags remain independently controlled.
- Customer installer URL uses the verified Stable endpoint: `https://api.ordentory.kr/v1/store/installer`.
- Approved 44-page Inventory v1.0.0 PDF SHA-256 is pinned to `f0018d24f08011c03da123415fa025eff0ffbd665c1b484636a7f9cad075d8f0`, matching the signed Desktop release manifest.
