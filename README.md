# Wabash Together

A neighborhood introduction board for recurring carpools and shared private-car access in West Lafayette and riverfront Lafayette, Indiana. Search via the neighborhood map and by area, commute destination, day, or listing type. The map displays area-level activity and runs without external tiles or location permission.

A signed-in visitor can post, edit or remove their listings and request an introduction. The sender and recipient exchange their account email by mutual opt-in and then coordinate on their own. There are no payments, bookings, ratings, or ongoing on-site chats. The board has no seeded listings.

## Operation

- This project uses Sites identity, Vinext, and Cloudflare D1. The `DB` binding is declared in `.openai/hosting.json`, with schema and versioned migrations under `db/` and `drizzle/`.
- A private deployment can be used as a review environment. Use Sites access settings to manage which audience can visit the deployed site.
- No private address is required by the site. Published listings use a chosen neighborhood and limited public text. Introduction notes and account email addresses do not appear on the board.
- Confirm current report handling and the intended moderation contact before inviting the general public. The deployment does not currently send email notifications. Members can review requests in My activity.

## Development

Install using the Sites project tools. With dependencies present, `npm run dev` serves a local Workers-compatible preview and `npm run build` builds the production Worker. Use `npx tsc --noEmit` for the TypeScript check. Local D1 data is separate from production data. After adding migrations, use the Sites build and publication workflow so the database schema is applied before the Worker is deployed.

The bridge photo is [John T. Myers Pedestrian Bridge 2024c](https://commons.wikimedia.org/wiki/File:John_T._Myers_Pedestrian_Bridge_2024c.jpg) by Antony-22, licensed [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0). Resized, converted to WebP and cropped for display.
