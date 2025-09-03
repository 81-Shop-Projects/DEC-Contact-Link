// birdeye-contact.js (Netlify Function)
exports.handler = async (event) => {
  // CORS preflight
  if (event.httpMethod === "OPTIONS") {
    return {
      statusCode: 204,
      headers: corsHeaders(),
      body: "",
    };
  }

  if (event.httpMethod !== "POST") {
    return json(405, { error: "Method Not Allowed" });
  }

  try {
    const {
      name,
      Emailid, // keep this exact field name to match your Webflow form
      phone,
      customerComment,
      channel = "Web",
      utmCampaign,
    } = JSON.parse(event.body || "{}");

    // Basic validation
    if (!name || !Emailid || !phone) {
      return json(400, {
        error: "Missing required fields: name, Emailid, phone",
      });
    }

    const businessId = process.env.BIRDEYE_BUSINESS_ID; // e.g. 175563788313806
    const apiKey = process.env.BIRDEYE_API_KEY;

    if (!businessId || !apiKey) {
      return json(500, { error: "Server not configured: missing env vars" });
    }

    const payload = {
      customerComment,
      customer: {
        name,
        emailId: Emailid, // Birdeye expects "emailId" camelCase
        phone,
      },
      additionalParams: {
        channel,
        utmCampaign,
      },
    };

    const url = `https://api.birdeye.com/resources/v1/contactUs/${encodeURIComponent(
      businessId
    )}?api_key=${encodeURIComponent(apiKey)}`;

    // Native fetch is available on Node 18+ in Netlify
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
      // Surface Birdeye error to your logs & caller
      return json(resp.status, {
        error: "Birdeye error",
        details: safeParse(text),
      });
    }

    return {
      statusCode: 200,
      headers: corsHeaders(),
      body: text || "{}",
    };
  } catch (err) {
    return json(500, { error: err?.message || "Server error" });
  }
};

// Helpers
function json(status, obj) {
  return {
    statusCode: status,
    headers: corsHeaders(),
    body: JSON.stringify(obj),
  };
}

// Tighten this to your domains when you’re ready
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
