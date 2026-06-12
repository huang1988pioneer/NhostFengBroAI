const DEFAULT_HEADERS = {
  "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/135.0 Safari/537.36",
  "accept-language": "zh-TW,zh;q=0.9,en;q=0.8"
};

type BiggoResult = {
  sourceUrl: string;
  keyword: string;
  productTitle: string;
  currentPrice: number | null;
  historicalHigh: number | null;
  historicalLow: number | null;
  biggoUrl: string;
  series: Array<{ label: string; value: number }>;
  notice?: string;
};

export default defineEventHandler(async (event): Promise<BiggoResult> => {
  const body = await readBody<{ url?: string; keyword?: string }>(event);
  const raw = String(body?.url || body?.keyword || "").trim();
  if (!raw) {
    throw createError({ statusCode: 400, statusMessage: "請輸入商品網址或關鍵字。" });
  }

  const sourceUrl = normalizeMaybeUrl(raw);
  const sourceHtml = sourceUrl ? await tryFetchText(sourceUrl) : "";
  const keyword = pickKeyword(raw, sourceHtml);
  const biggoUrl = `https://biggo.com.tw/s/${encodeURIComponent(keyword)}/`;
  const biggoHtml = await tryFetchText(biggoUrl);
  const prices = getMoneyValues(stripTags(biggoHtml));

  if (!prices.length) {
    return {
      sourceUrl: sourceUrl || raw,
      keyword,
      productTitle: inferTitle(raw, sourceHtml, keyword),
      currentPrice: null,
      historicalHigh: null,
      historicalLow: null,
      biggoUrl,
      series: [],
      notice: "暫時無法自動解析價格，已提供 BigGo 搜尋連結。"
    };
  }

  return {
    sourceUrl: sourceUrl || raw,
    keyword,
    productTitle: inferTitle(raw, sourceHtml, keyword),
    currentPrice: Math.min(...prices.slice(0, 8)),
    historicalHigh: Math.max(...prices),
    historicalLow: Math.min(...prices),
    biggoUrl,
    series: prices.slice(0, 12).map((value, index) => ({ label: `P${index + 1}`, value }))
  };
});

function normalizeMaybeUrl(value: string) {
  try {
    return new URL(value).toString();
  } catch {
    return "";
  }
}

async function tryFetchText(url: string) {
  try {
    const response = await fetch(url, { headers: DEFAULT_HEADERS, redirect: "follow" });
    return response.ok ? await response.text() : "";
  } catch {
    return "";
  }
}

function stripTags(html: string) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim();
}

function getMoneyValues(value: string) {
  return Array.from(value.matchAll(/(?:NT\$|\$|＄)?\s*([1-9]\d{2,}(?:,\d{3})*)/g))
    .map((match) => Number(match[1].replace(/,/g, "")))
    .filter((price) => Number.isFinite(price) && price > 50);
}

function pickKeyword(raw: string, html: string) {
  const title = html.match(/<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)/i)?.[1] ||
    html.match(/<title[^>]*>([^<]+)<\/title>/i)?.[1] ||
    "";
  const source = title || raw;
  return source
    .replace(/^https?:\/\//, "")
    .replace(/[/?#=&_.-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 80);
}

function inferTitle(raw: string, html: string, keyword: string) {
  return stripTags(html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i)?.[1] || "") ||
    stripTags(html.match(/<title[^>]*>([^<]+)<\/title>/i)?.[1] || "") ||
    keyword ||
    raw;
}
