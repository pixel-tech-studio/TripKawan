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
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/133.0.0.0 Safari/537.36",
        Accept:
          "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9",
        "Accept-Encoding": "gzip, deflate, br",
        "Cache-Control": "no-cache",
        "Pragma": "no-cache",
        "Sec-Fetch-Dest": "document",
        "Sec-Fetch-Mode": "navigate",
        "Sec-Fetch-Site": "none",
        "Sec-Fetch-User": "?1",
        "Upgrade-Insecure-Requests": "1",
      },
      signal: AbortSignal.timeout(15000),
    });

    if (!response.ok) {
      return json({ error: `PG site returned HTTP ${response.status}` }, 502);
    }

    const html = await response.text();
    // Decode HTML entities before stripping tags so prices aren't mangled
    const text = html
      .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(parseInt(code, 10)))
      .replace(/&nbsp;/gi, " ")
      .replace(/&amp;/gi, "&")
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ");

    const gap = extractGoldPrice(text);
    const sap = extractSilverPrice(text);

    // Debug: find all "RM ... = 100.0000" contexts for diagnosing SAP failures
    const contexts = [...text.matchAll(/RM.{0,60}100\.0000/gi)].map(m => m[0]);
    if (gap === null) return json({ error: "Could not extract GAP price", contexts, len: text.length }, 422);
    if (sap === null) return json({ error: "Could not extract SAP price", contexts, len: text.length }, 422);

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
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
    },
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
  // Format: "RM 1367 = 100.0000 gram" — divide by 100 to get per-gram price.
  // Use global match: a gold-bar "RM 69,775 = 100.0000 gram" may appear first;
  // we skip any price outside the realistic silver range (100–15000 per 100g).
  const re = /RM\s*([\d,]+\.?\d*)\s*=\s*100\.0000/gi;
  let m;
  while ((m = re.exec(text)) !== null) {
    const price100g = parsePrice(m[1]);
    if (price100g !== null && price100g >= 100 && price100g <= 15000) {
      return Math.round((price100g / 100) * 10000) / 10000;
    }
  }
  return null;
}
