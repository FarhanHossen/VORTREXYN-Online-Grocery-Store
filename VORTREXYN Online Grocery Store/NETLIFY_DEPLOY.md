# Deploying VORTREXYN to Netlify via GitHub

Follow these steps **in order** to get the site fully live.

---

## Step 1 — Set up your PostgreSQL database on Neon

1. Go to **https://neon.tech** and create a free account.
2. Create a new **Project**.
3. Inside the project, open the **SQL Editor**.
4. Paste the entire contents of **`products_export.sql`** and click **Run**.
   - This creates the `products` table and inserts all 89+ products.
5. Go to **Connection Details** → copy the **Connection string** (starts with `postgresql://`).
   - Keep this safe — you will paste it as `DATABASE_URL` in Netlify.

> The `session` table is created **automatically** by the app on first request.

---

## Step 2 — Allow public access on Firebase Storage

When the admin adds a new product, its AI-generated image is uploaded to
Firebase Storage and served publicly. You must allow public reads:

1. Go to **https://console.firebase.google.com** → your project → **Storage**.
2. Click the **Rules** tab.
3. Replace the rules with:

```
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    match /products/{imageFile} {
      allow read: if true;
      allow write: if false;
    }
  }
}
```

4. Click **Publish**.

---

## Step 3 — Push the code to GitHub

1. Create a new **private** GitHub repository (empty, no README, no .gitignore).
2. From a terminal, run:

```bash
git init
git add .
git commit -m "Initial commit"
git branch -M main
git remote add origin https://github.com/YOUR_USER/YOUR_REPO.git
git push -u origin main
```

---

## Step 4 — Import to Netlify

1. Go to **https://app.netlify.com** → **Add new site** → **Import an existing project**.
2. Connect your GitHub account and select the repo.
3. Netlify will auto-detect **`netlify.toml`** at the root — no manual build settings needed.
4. Click **Deploy site** (it will fail on the first build without env vars — that's OK, continue to Step 5).

---

## Step 5 — Set environment variables in Netlify

In your Netlify site → **Site configuration** → **Environment variables**, add every variable below:

| Variable | Value |
|---|---|
| `DATABASE_URL` | Your Neon connection string from Step 1 |
| `SESSION_SECRET` | Any long random string |
| `FIREBASE_PRIVATE_KEY` | The `private_key` field from your Firebase service account JSON — paste the full key including `-----BEGIN PRIVATE KEY-----` and `-----END PRIVATE KEY-----`, with `\n` for each line break |
| `FIREBASE_CLIENT_EMAIL` | The `client_email` field from your Firebase service account JSON |
| `FIREBASE_API_KEY` | From Firebase project settings → General |
| `FIREBASE_AUTH_DOMAIN` | From Firebase project settings → General |
| `FIREBASE_PROJECT_ID` | `vortrexyn-online-grocery-store` |
| `FIREBASE_STORAGE_BUCKET` | `vortrexyn-online-grocery-store.firebasestorage.app` |
| `FIREBASE_MESSAGING_SENDER_ID` | From Firebase project settings → General |
| `FIREBASE_APP_ID` | From Firebase project settings → General |
| `FIREBASE_MEASUREMENT_ID` | From Firebase project settings → General |
| `ADMIN_EMAIL` | Your admin login email |
| `ADMIN_PASSWORD` | Your admin login password |
| `EMAIL_SENDER` | The Gmail address that sends order confirmations |
| `EMAIL_PASS` | Gmail App Password for that address |
| `OPENAI_API_KEY` | Your OpenAI API key (for AI product images) |

After adding all variables → **Trigger deploy** → **Deploy site**.

### How to find your Firebase service account credentials

1. Go to **Firebase Console** → your project → **Project settings** (gear icon).
2. Click the **Service accounts** tab.
3. Click **Generate new private key** → **Generate key**.
4. A JSON file downloads. Open it and copy:
   - `private_key` → paste as `FIREBASE_PRIVATE_KEY`
   - `client_email` → paste as `FIREBASE_CLIENT_EMAIL`

---

## Step 6 — Connect your custom domain

1. In Netlify → **Domain management** → **Add a domain**.
2. Enter your domain and follow the DNS instructions.
3. Netlify provisions a free SSL certificate automatically.

---

## Notes on AI image generation timeout

Netlify's free tier has a **10-second function timeout**. Generating an AI
product image with GPT-Image-1 can take 30–60 seconds, so the add-product
request **may time out** on the free plan. Two options:

- **Upgrade to Netlify Pro** (26-second timeout, usually enough for DALL-E 3).
- **Use the admin panel to add products without images** — the product is saved
  even if the image times out (`image_filename` will be NULL and a placeholder
  is shown).
