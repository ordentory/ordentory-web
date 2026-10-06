# ORDENTORY Web

Public website and direct-sales frontend for the ORDENTORY product family.

## Responsibilities

- Product and brand pages
- ORDENTORY account and customer self-service
- Checkout and purchase completion
- Trial and purchase guidance
- Installer/manual delivery guidance
- License/account views
- Support and documentation

The website talks to `ordentory-backend`. Licensing, payment verification, entitlement, device and release rules remain backend responsibilities.

## Product family

Initial commercial product:

- ORDENTORY Inventory

Planned expansion:

- Sales
- Order
- Label
- BUSINESS (all module entitlements)

## Current public state

The public `main` site is intentionally in prelaunch mode.

- `ordentory.kr` shows the one-page ORDENTORY brand/prelaunch page.
- Checkout, trial, manual, policy and payment-result storefront routes are temporarily hidden and redirect to the homepage.
- Public indexing is blocked while the storefront is not open.
- The direct purchase CTA remains disabled until Toss production checkout and final payment E2E are approved.
- The Admin console is a separate private repository/service at `ordentory-admin`; this repository does not serve the Admin frontend.

## v1.0.0 commercial configuration

- regular price: 199,000 KRW
- launch price: 169,000 KRW
- launch offer: first 30 completed licenses
- perpetual license for one business, up to two PCs
- v1.x updates included; future major versions such as v2.x may be paid upgrades
- verified-email 7-day Trial
- self-service device release for normal PC moves
- support-assisted device release for failure/loss
- no license sharing or transfer
- post-purchase delivery: license code, signed installer link and official manual

Customer installer metadata is served by the verified Stable backend endpoint:
`https://api.ordentory.kr/v1/store/installer`.

The approved Inventory v1.0.0 manual SHA-256 is pinned to
`f0018d24f08011c03da123415fa025eff0ffbd665c1b484636a7f9cad075d8f0`,
matching the signed Desktop release manifest.
