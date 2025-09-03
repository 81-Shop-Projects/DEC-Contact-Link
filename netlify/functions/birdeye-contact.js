exports.handler = async (event) => {
  // CORS preflight
  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 204, headers: corsHeaders(), body: "" };
  }
  if (event.httpMethod !== "POST") {
    return json(405, { error: "Method Not Allowed" });
  }

  try {
    let {
      name,
      Emailid, // keep exact casing to match your Webflow field
      phone,
      customerComment,
      channel = "Web",
      utmCampaign,
    } = JSON.parse(event.body || "{}");

    // Basic email check (lightweight)
    const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(Emailid || "");
    // Normalize phone to E.164 (US default), accept already-E.164
    phone = normalizePhone(phone);

    if (!name || !emailOk || !phone) {
      return json(400, {
        error: "Missing/invalid fields: name, Emailid, phone",
      });
    }

    const businessId = process.env.BIRDEYE_BUSINESS_ID;
    const apiKey = process.env.BIRDEYE_API_KEY;
    if (!businessId || !apiKey) {
      return json(500, { error: "Server not configured: missing env vars" });
    }

    const payload = {
      customerComment,
      customer: {
        name,
        emailId: Emailid, // Birdeye requires camelCase here
        phone, // E.164
        phoneNumber: phone, // belts & suspenders for any alternate parsing
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
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`; // 1XXXXXXXXXX
  return ""; // invalid -> let validation fail
}
