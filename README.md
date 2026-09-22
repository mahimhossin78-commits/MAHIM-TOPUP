# MAHIM TOPUP

A responsive Bengali Free Fire top-up storefront inspired by the supplied reference screenshots, with separate customer accounts and an admin dashboard.

## Features
- Customer registration creates a unique Customer ID (`CUS-...`).
- Customer login/logout and personal order history.
- Order form with the supplied 16-package price list.
- bKash/Nagad payment numbers from the supplied reference image.
- UID + TrxID + payment method saved with every order.
- Unique serial number for every order.
- Admin login and order management: Confirm / Reject / Cancel + note.
- Admin customer list.
- Admin customization for notice, hero text, payment numbers, social links and package prices.
- By default, customization can be saved only once per day.
- Admin password can be changed from the dashboard.
- JSON persistence so it can run on a simple Node/Express deployment.

## Run locally
1. Install Node.js 18+.
2. `npm install`
3. Set `SESSION_SECRET` and `ADMIN_PASSWORD` in your environment.
4. `npm start`
5. Open `http://localhost:3000`
6. Admin panel: `http://localhost:3000/admin.html`

Default admin email is `admin@mahimtopup.local` and default password is `ChangeMe123!` unless environment variables are set. **Change the password before deployment.**

## Render
- Build command: `npm install`
- Start command: `npm start`
- Add environment variables: `SESSION_SECRET`, `ADMIN_EMAIL`, `ADMIN_PASSWORD`, `NODE_ENV=production`.
- For production at scale, replace `data/db.json` with a managed database and object storage for uploaded banner images.

## Important
The exact banner artwork in the screenshots was not embedded because the screenshots are references rather than reusable site assets. The UI recreates the layout, colors, spacing and flow with CSS. You can add your own approved artwork later through the public assets.
