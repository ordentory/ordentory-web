# ORDENTORY Web Architecture

## Purpose

The website is one sales channel and customer interface, not the source of licensing rules.

## Planned areas

- Public product pages
- Pricing
- Checkout
- Purchase completion
- ORDENTORY account
- Owned modules
- Download page
- License/device self-service
- Documentation/support

## Purchase flow

```text
Customer
  -> Checkout
  -> Payment provider
  -> verified payment webhook
  -> ORDENTORY Backend Order Gateway
  -> Order
  -> Entitlement
  -> License create/update
  -> confirmation page/email
```

## Important rule

The browser must never directly grant entitlements after a client-side payment success event.
The backend grants access only after server-side payment verification.

## Channel independence

A customer may buy Inventory on Kmong and Sales later on ordentory.kr.
Both purchases must be able to resolve to the same ORDENTORY customer/license.
