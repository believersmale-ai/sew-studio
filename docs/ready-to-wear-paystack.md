# Ready-to-Wear payments and delivery (draft)

## Environment variables
- `DATABASE_URL`: application Postgres connection
- `PAYSTACK_SECRET_KEY`: Paystack test secret key for staging, live secret key only after approval. **Server only**, never `NEXT_PUBLIC_`.
- `NEXT_PUBLIC_APP_URL`: deployed HTTPS origin, e.g. `https://your-app.example`. Must match the domain serving the payment callback.

## Paystack configuration
- Configure webhook endpoint: `https://YOUR_DOMAIN/api/ready-to-wear/payments/webhook`
- Enable Ghana GHS payment methods in the Paystack merchant account.
- Apply migrations `063_ready_to_wear.sql` and `064_rtw_paystack_delivery.sql` in order.
- Create a product at `/manage/ready-to-wear`, then share `/ready-to-wear/{shopId}`.

## Manual payment workflow
- Customers can place manual orders without Paystack, then submit a Mobile Money or bank transfer reference. No receiving account is published by the application; customers must obtain verified payment details directly from the studio.
- Customer-submitted references are **not** evidence of received funds. Only an authenticated studio owner can confirm receipt after independently checking their bank/MoMo statement.
- Owner can cancel an unpaid manual order and restore reserved stock once. Cash on delivery is not offered until a dedicated collection workflow is built.
- Apply `065_rtw_manual_payments.sql` after 063 and 064.

## Payment safety
- Prices are calculated server-side and Paystack charges the order total in GHS pesewas.
- Payment confirmation requires a successful **server-to-server** Paystack verification, matching reference, currency and amount. Browser redirect alone never marks an order paid.
- Webhooks require the Paystack HMAC SHA-512 signature; repeat notifications are idempotent.
- Only paid orders can progress through Processing → Dispatched → Delivered; courier and tracking number required for dispatch.
- The customer is redirected to Paystack's hosted checkout; no card credentials are processed by this application.

## Outstanding before production
- Delivery currently costs **GHS 0** and the checkout explicitly discloses this. Implement configurable shipping rates before charging delivery fees; never add undisclosed charges after payment.
- Inventory is reserved at order creation; abandoned/unpaid orders currently hold stock until the owner cancels them. Implement expiry and safe restocking, with late-payment reconciliation, before live release.
- Implement cancellation/refund and stock return workflows; courier tracking link, customer notifications and customer order status lookup.
- Add payment initialization idempotency and rate limiting, bot protection, fraud monitoring and a reconciliation dashboard.
- Validate Paystack test transactions (success, failure, duplicate webhook, wrong amount/currency, network errors) and run typecheck/build + database migrations in staging.
- Confirm database schema and production hosting configuration. Do not merge/deploy this draft without QA.
