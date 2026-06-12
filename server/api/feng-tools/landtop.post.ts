const DEFAULT_HEADERS = {
  "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/135.0 Safari/537.36",
  "accept-language": "zh-TW,zh;q=0.9,en;q=0.8"
};

type StoreVariant = {
  variantLabel: string;
  displayName: string;
  priceLabel: string;
  numericPrice: number | null;
  url: string;
};

type StoreResult = {
  source: string;
  productName: string;
  productUrl: string;
  variants: StoreVariant[];
  error?: string;
};

export default defineEventHandler(async (event) => {
  const body = await readBody<{ keyword?: string }>(event);
  const keyword = String(body?.keyword || "").trim();
  if (!keyword) {
    throw createError({ statusCode: 400, statusMessage: "請輸入手機型號。" });
  }

  const stores = (await Promise.all([fetchLandtop(keyword), fetchJyes(keyword)])).filter((store) => store.variants.length || store.error);
  const variantMap = new Map<string, { label: string; displayName: string; sources: Array<{ source: string; priceLabel: string; numericPrice: number | null; url: string }> }>();

  for (const store of stores) {
    for (const variant of store.variants) {
      const key = variant.variantLabel || "標準";
      const current = variantMap.get(key) || { label: key, displayName: variant.displayName, sources: [] };
      current.sources.push({
        source: store.source,
        priceLabel: variant.priceLabel,
        numericPrice: variant.numericPrice,
        url: variant.url
      });
      variantMap.set(key, current);
    }
  }

  return {
    keyword,
    productName: stores.find((store) => store.productName)?.productName || keyword,
    stores,
    comparison: Array.from(variantMap.values()).sort((a, b) => a.label.localeCompare(b.label, "zh-Hant"))
  };
});

async function fetchLandtop(keyword: string): Promise<StoreResult> {
  const url = `https://www.landtop.com.tw/search?keyword=${encodeURIComponent(keyword)}`;
  return parseStore("地標網通", url, await tryFetchText(url), keyword);
}

async function fetchJyes(keyword: string): Promise<StoreResult> {
  const url = `https://www.jyes.com.tw/product.php?keywords=${encodeURIComponent(keyword)}`;
  return parseStore("傑昇通信", url, await tryFetchText(url), keyword);
}

async function tryFetchText(url: string) {
  try {
    const response = await fetch(url, { headers: DEFAULT_HEADERS, redirect: "follow" });
    return response.ok ? await response.text() : "";
  } catch {
    return "";
  }
}

function parseStore(source: string, url: string, html: string, keyword: string): StoreResult {
  const text = stripTags(html);
  const prices = Array.from(text.matchAll(/(?:NT\$|\$|＄)?\s*([1-9]\d{3,}(?:,\d{3})*)/g))
    .map((match) => Number(match[1].replace(/,/g, "")))
    .filter((price) => Number.isFinite(price));
  const best = prices.length ? Math.min(...prices) : null;
  const title = stripTags(html.match(/<title[^>]*>([^<]+)<\/title>/i)?.[1] || "") || keyword;

  return {
    source,
    productName: title,
    productUrl: url,
    variants: best
      ? [{
          variantLabel: "最佳價格",
          displayName: keyword,
          priceLabel: `NT$ ${best.toLocaleString("zh-TW")}`,
          numericPrice: best,
          url
        }]
      : [],
    error: best ? "" : "暫時無法解析價格，請開啟來源網站查看。"
  };
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
