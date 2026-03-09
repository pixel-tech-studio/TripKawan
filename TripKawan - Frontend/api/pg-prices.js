/**
 * Vercel Edge Function — fetches Public Gold Malaysia prices.
 * Runs on Cloudflare edge (not AWS), avoiding the WAF that blocks GitHub Actions IPs.
 */
export const config = { runtime: "edge" };

const PG_URL = "https://publicgold.com.my/";

export default async function handler() {
  try {
    const response = await fetch(PG_URL, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:124.0) Gecko/20100101 Firefox/124.0",
        Accept:
          "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.5",
        "Accept-Encoding": "gzip, deflate, br",
        "Upgrade-Insecure-Requests": "1",
      },
      signal: AbortSignal.timeout(15000),
    });

    if (!response.ok) {
      return json({ error: `PG site returned HTTP ${response.status}` }, 502);
    }

    const html = await response.text();
    const text = html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");

    const gap = extractGoldPrice(text);
    const sap = extractSilverPrice(text);

    if (gap === null) return json({ error: "Could not extract GAP price" }, 422);
    if (sap === null) return json({ error: "Could not extract SAP price" }, 422);

    return json({ gap_price_myr: gap, sap_price_myr: sap });
  } catch (err) {
    return json({ error: err.message }, 500);
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function parsePrice(raw) {
  const num = parseFloat(raw.replace(/,/g, ""));
  return isNaN(num) ? null : num;
}

function extractGoldPrice(text) {
  // Format: "RM 712 = 1.0000 gram" — price comes before the quantity
  const m = text.match(/RM\s*([\d,]+\.?\d*)\s*=\s*1\.0000/i);
  if (m) {
    const price = parsePrice(m[1]);
    if (price !== null && price >= 100 && price <= 2000) return price;
  }
  return null;
}

function extractSilverPrice(text) {
  // Format: "RM 1367 = 100.0000 gram" — divide by 100 to get per-gram price
  const m = text.match(/RM\s*([\d,]+\.?\d*)\s*=\s*100\.0000/i);
  if (m) {
    const price100g = parsePrice(m[1]);
    if (price100g !== null && price100g >= 100 && price100g <= 50000) {
      return Math.round((price100g / 100) * 10000) / 10000;
    }
  }
  return null;
}
