// netlify/functions/birdeye-contact.js
exports.handler = async (event) => {
  // CORS preflight
  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 204, headers: corsHeaders(), body: "" };
  }
  if (event.httpMethod !== "POST") {
    return json(405, { error: "Method Not Allowed" });
  }

  try {
    const ct = (
      event.headers["content-type"] ||
      event.headers["Content-Type"] ||
      ""
    ).toLowerCase();
    let body = {};

    if (ct.includes("application/json")) {
      body = JSON.parse(event.body || "{}");
    } else if (ct.includes("application/x-www-form-urlencoded")) {
      body = Object.fromEntries(new URLSearchParams(event.body || ""));
    } else {
      try {
        body = JSON.parse(event.body || "{}");
      } catch {}
    }

    // Pull fields (Webflow Names must match)
    let {
      name,
      Emailid,
      phone,
      customerComment,
      location,
      channel = "Web",
      utmCampaign,
    } = body;

    // Basic validation
    const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test((Emailid || "").trim());
    phone = normalizePhone(phone);
    if (!name || !emailOk || !phone) {
      return json(400, {
        error: "Missing/invalid fields: name, Emailid, phone",
      });
    }

    // Resolve location -> businessId
    const businessId = resolveLocationId(location);
    if (!businessId) {
      return json(400, {
        error: "Invalid or missing location",
        allowed: ["Birmingham", "Decatur", "Opelika"],
      });
    }

    const apiKey = process.env.BIRDEYE_API_KEY;
    if (!apiKey) {
      return json(500, {
        error: "Server not configured: missing BIRDEYE_API_KEY",
      });
    }

    const payload = {
      customerComment,
      customer: {
        name,
        emailId: Emailid, // Birdeye expects camelCase
        phone, // E.164
        phoneNumber: phone,
        mobileNumber: phone,
      },
      additionalParams: {
        channel,
        utmCampaign,
      },
    };

    const url = `https://api.birdeye.com/resources/v1/contactUs/${encodeURIComponent(
      businessId
    )}?api_key=${encodeURIComponent(apiKey)}`;

    const resp = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify(payload),
    });

    const text = await resp.text();
    if (!resp.ok) {
      return json(resp.status, {
        error: "Birdeye error",
        details: safeParse(text),
      });
    }

    return { statusCode: 200, headers: corsHeaders(), body: text || "{}" };
  } catch (err) {
    return json(500, { error: err?.message || "Server error" });
  }
};

// ---------- helpers ----------
function json(status, obj) {
  return {
    statusCode: status,
    headers: corsHeaders(),
    body: JSON.stringify(obj),
  };
}
function corsHeaders() {
  const origin = process.env.ALLOWED_ORIGIN || "*";
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  };
}
function safeParse(s) {
  try {
    return JSON.parse(s);
  } catch {
    return s;
  }
}

// US-focused normalizer with E.164 output; accepts already-E.164
function normalizePhone(raw) {
  const str = String(raw || "").trim();
  if (/^\+\d{8,15}$/.test(str)) return str; // already E.164
  const digits = str.replace(/\D/g, "");
  if (digits.length === 10) return `+1${digits}`; // US local -> E.164
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
  return ""; // invalid -> let validation fail
}

// Map dropdown value -> env var business ID
function resolveLocationId(locRaw) {
  const key = String(locRaw || "")
    .trim()
    .toLowerCase();
  const envMap = {
    birmingham: process.env.BIRDEYE_LOCATION_BIRMINGHAM,
    decatur: process.env.BIRDEYE_LOCATION_DECATUR,
    opelika: process.env.BIRDEYE_LOCATION_OPELIKA,
  };
  return envMap[key] || null;
}
