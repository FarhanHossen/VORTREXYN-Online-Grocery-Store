# VORTREXYN Online Grocery Store

A premium online grocery store with a luxury "Night Market Glow" dark theme.

## Features

- Firebase Authentication (Google sign-in + Email/Password)
- Customer loyalty tier system (Iron → Radiant) with reward points
- AI-generated product images via OpenAI
- Order confirmation emails via Nodemailer
- Admin dashboard with full product management
- PostgreSQL product catalog (Neon)

## Tech Stack

| Layer | Technology |
|---|---|
| Backend | Node.js, Express, EJS |
| Database | PostgreSQL (Neon) |
| Auth & Users | Firebase Authentication + Firestore |
| Image Storage | Firebase Storage |
| AI Images | OpenAI API |
| Hosting | Netlify (serverless functions) |
| Sessions | connect-pg-simple (PostgreSQL-backed) |

## Deployment

See [`VORTREXYN Online Grocery Store/NETLIFY_DEPLOY.md`](VORTREXYN%20Online%20Grocery%20Store/NETLIFY_DEPLOY.md) for full step-by-step instructions.

## Environment Variables

See [`VORTREXYN Online Grocery Store/.env.example`](VORTREXYN%20Online%20Grocery%20Store/.env.example) for the full list of required environment variables.
