function pageUrl(raw) {
  let url;
  try {
    url = new URL(String(raw || ""));
  } catch (err) {
    return null;
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") return null;
  if (url.username || url.password) return null;
  const host = url.hostname.toLowerCase().replace(/\.+$/, "");
  if (!host || host === "localhost" || host.endsWith(".local") || host === "0.0.0.0") return null;
  if (host === "::1" || host === "[::1]") return null;
  if (/^(127\.|10\.|192\.168\.|169\.254\.|0\.|172\.(1[6-9]|2\d|3[0-1])\.)/.test(host)) return null;
  if (url.port && url.port !== "80" && url.port !== "443") return null;
  return url;
}

function pickPhoto(html) {
  const text = String(html || "");
  const found = text.match(/https?:\/\/cdn\.resales-online\.com\/[^"'()\s]+?\.(?:jpg|jpeg|webp)/gi) || [];
  const hero = found.find((item) => /\/1-[^/]+\.(?:jpg|jpeg|webp)/i.test(item));
  const chosen = hero || found[0] || "";
  if (chosen) return chosen.split("?")[0];
  const og =
    text.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)/i) ||
    text.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i);
  if (og && /^https:\/\//i.test(og[1]) && !/logo|icon|sprite/i.test(og[1])) return og[1];
  return "";
}

function miss(res, reason) {
  res.setHeader("cache-control", "no-store");
  res.setHeader("x-shot-reason", String(reason || "miss").slice(0, 80));
  res.status(404).end();
}

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  if (req.method === "OPTIONS") {
    res.status(204).end();
    return;
  }
  const page = pageUrl(req.query?.url);
  if (!page) {
    miss(res, "bad-url");
    return;
  }
  try {
    const response = await fetch(page, {
      redirect: "follow",
      headers: {
        "user-agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
        accept: "text/html,application/xhtml+xml",
        "accept-language": "en-GB,en;q=0.9",
      },
    });
    if (!response.ok) {
      miss(res, "fetch-" + response.status);
      return;
    }
    const html = (await response.text()).slice(0, 1500000);
    const image = pickPhoto(html);
    if (!image || !/^https:\/\//i.test(image)) {
      miss(res, "no-photo-" + html.length);
      return;
    }
    res.setHeader("cache-control", "public, max-age=86400");
    res.redirect(302, image);
  } catch (err) {
    miss(res, err instanceof Error ? err.name : "fetch-error");
  }
}
