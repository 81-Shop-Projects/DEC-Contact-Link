# Birdeye Contact Form Integration

This project connects the **Webflow “Contact Us” form** on [decconstruction.com](https://www.decconstruction.com) to **Birdeye CRM** using a secure **Netlify serverless function**.

The Netlify function receives form submissions, validates and normalizes them (especially phone numbers), and forwards the data to Birdeye’s **Open API** (`/resources/v1/contactUs`).

---

## Overview

- **Frontend:** Webflow site with a custom form
- **Backend:** Netlify Functions (Node.js)
- **Destination:** Birdeye CRM (Contacts + Inbox)
- **Deployment:** Netlify (Git repo → Functions)

---

## Flow

1. User fills out Contact form on Webflow.
2. A small script (or direct form `action`) posts data to: https://dec-contact-list.netlify.app/.netlify/functions/birdeye-contact

3. The Netlify function:

- Validates required fields
- Normalizes phone numbers to E.164
- Forwards payload to Birdeye via API (with API key + business ID)
- Returns 200 or 400/500 with error info
- Redirects to **Thank You** page on success

---

## Key Files

- **`netlify/functions/birdeye-contact.js`**
- The serverless function
- Handles validation, normalization, error handling, and forwarding to Birdeye
- **`netlify.toml`**
- Tells Netlify where to find functions (`netlify/functions/`)
- **`package.json`**
- Declares Node version and dependencies (currently none, uses built-in `fetch`)

---

## Environment Variables (in Netlify UI)

Set these in **Site Settings → Environment variables**:

| Key                   | Value Example                                          | Secret? | Scope     |
| --------------------- | ------------------------------------------------------ | ------- | --------- |
| `BIRDEYE_BUSINESS_ID` | `175563788313806`                                      | No      | Functions |
| `BIRDEYE_API_KEY`     | `ROTATED_API_KEY_FROM_BIRDEYE`                         | ✅ Yes  | Functions |
| `ALLOWED_ORIGIN`      | `https://www.decconstruction.com` (or `*` for testing) | No      | Functions |

> After editing variables, trigger a new **Deploy** so functions pick them up.

---

## Webflow Setup

### Form Fields

Set **Form field Names** (not labels):

- `name`
- `Emailid` ← capital “I” matters
- `phone`
- `customerComment`
- `emailOptin` (checkbox, optional)

### Disable Webflow Notifications

We turned off Webflow’s native form email notifications in **Project Settings → Forms**.  
This prevents the “spam submission” footer emails — the Netlify function is the sole submission handler.

### Client-Side Script (if using JS submit)

Placed before `</body>` on the form page. Handles:

- Normalizing phone number
- Light client-side validation
- POST to Netlify endpoint
- Redirect to Thank You page

Alternatively, you can set the **form action** directly to the Netlify function and let it handle redirects (no JS required).

---

## Function Behavior

- **Validation:**
- Rejects missing/invalid name, email, or phone
- Validates email regex
- Normalizes phone to E.164 (+15555555555)

- **Normalization:**
- `(406) 570-3746` → `+14065703746`
- `4065703746` → `+14065703746`

- **Payload to Birdeye:**

```json
{
  "customerComment": "...",
  "customer": {
    "name": "John Doe",
    "emailId": "john@example.com",
    "phone": "+14065703746",
    "phoneNumber": "+14065703746",
    "mobileNumber": "+14065703746"
  },
  "additionalParams": {
    "channel": "Web",
    "utmCampaign": "fall-promo"
  }
}
```
