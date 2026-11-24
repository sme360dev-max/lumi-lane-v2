# Lumi Lane Version 2 — Website

Next.js static site for Lumi Lane's second visual concept. It exports to `out/` for Cloudflare Pages.

```sh
npm ci
npm run dev
npm run build
```

Set `NEXT_PUBLIC_API_BASE_URL` to the Django backend URL at build time. Menu, table requests, customer accounts, favorites, shopping carts, pickup orders and loyalty rewards use the Django API. Pickup orders are requests for venue confirmation and are paid at pickup; no online payment gateway is connected. See the repository [README](../README.md) for backend setup and deployment.
