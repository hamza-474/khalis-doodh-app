# Khalis Doodh

Khalis Doodh is a verified daily milk delivery marketplace for households and local gwalas (milkmen) across Punjab, Pakistan. Customers subscribe to a verified local gwala, pause or change deliveries, and see a clean monthly khata (ledger) — money always flows directly between the customer and the gwala; the platform only keeps the shared record. Gwalas get a simple daily route view, earnings, and optional dairy-product listings. Trust is built in: CNIC-verified gwalas, one rating per customer per 30 days, a complaint record-and-pattern system, and Top Rated / New badges.

Built with React + Vite, Express + tRPC, Drizzle ORM on SQLite, and a Gemini-powered support chat. Customers are always free; the platform earns only from gwala subscriptions (base monthly fee and product-listing plans).

## Run locally

```
pnpm install
pnpm build
ADMIN_EMAIL=admin@example.com ADMIN_PASSWORD=change-me JWT_SECRET=dev-secret npm start
```
