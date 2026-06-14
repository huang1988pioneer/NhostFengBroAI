type FinanceGroup = "tw" | "asia" | "korea" | "fx" | "commodities" | "rates" | "us" | "crypto" | "valuation";

type FinanceInstrument = {
  id: string;
  name: string;
  symbol: string;
  sourceUrl: string;
  group: FinanceGroup;
  provider: "yahoo" | "cnbc" | "multpl";
  alertThreshold?: number;
};

type FinanceQuote = FinanceInstrument & {
  displayName: string;
  price: number | null;
  change: number | null;
  changePercent: number | null;
  currency: string;
  high52: number | null;
  low52: number | null;
  dayHigh: number | null;
  dayLow: number | null;
  lastUpdated: string;
  recordTag: "new-high" | "new-low" | null;
  isThresholdAlert: boolean;
  alertMessage: string;
  error?: string;
};

const SHILLER_PE_URL = "https://www.multpl.com/shiller-pe";
const SHILLER_PE_RECORD_HIGH = 44.19;
const SHILLER_PE_RECORD_DATE = "Dec 1999";

const INSTRUMENTS: FinanceInstrument[] = [
  { id: "taiex", name: "加權指數", symbol: "^TWII", sourceUrl: "https://tw.stock.yahoo.com/s/tse.php", group: "tw", provider: "yahoo" },
  { id: "tsmc", name: "台積電", symbol: "2330.TW", sourceUrl: "https://tw.stock.yahoo.com/quote/2330.TW", group: "tw", provider: "yahoo" },
  { id: "dow", name: "Dow Jones Industrial Average", symbol: ".DJI", sourceUrl: "https://www.cnbc.com/quotes/.DJI", group: "us", provider: "cnbc" },
  { id: "sp500", name: "S&P 500 Index", symbol: ".SPX", sourceUrl: "https://www.cnbc.com/quotes/.SPX", group: "us", provider: "cnbc" },
  { id: "nasdaq", name: "NASDAQ Composite", symbol: ".IXIC", sourceUrl: "https://www.cnbc.com/quotes/.IXIC", group: "us", provider: "cnbc" },
  { id: "sox", name: "PHLX Semiconductor", symbol: ".SOX", sourceUrl: "https://www.cnbc.com/quotes/.SOX", group: "us", provider: "cnbc" },
  { id: "vix", name: "CBOE Volatility Index", symbol: ".VIX", sourceUrl: "https://www.cnbc.com/quotes/.VIX", group: "us", provider: "cnbc" },
  { id: "nikkei-225", name: "Nikkei 225 Index", symbol: ".N225", sourceUrl: "https://www.cnbc.com/quotes/.N225", group: "asia", provider: "cnbc" },
  { id: "kospi", name: "KOSPI Index", symbol: ".KS11", sourceUrl: "https://www.cnbc.com/quotes/.KS11?qsearchterm=kospi", group: "asia", provider: "cnbc" },
  { id: "samsung-electronics", name: "三星電子", symbol: "005930.KS", sourceUrl: "https://finance.yahoo.com/quote/005930.KS", group: "korea", provider: "yahoo" },
  { id: "sk-hynix", name: "SK 海力士", symbol: "000660.KS", sourceUrl: "https://finance.yahoo.com/quote/000660.KS", group: "korea", provider: "yahoo" },
  { id: "usd-twd", name: "美元對台幣匯率", symbol: "USDTWD=X", sourceUrl: "https://finance.yahoo.com/quote/USDTWD=X", group: "fx", provider: "yahoo" },
  { id: "usd-jpy", name: "美元對日元匯率", symbol: "USDJPY=X", sourceUrl: "https://finance.yahoo.com/quote/USDJPY=X", group: "fx", provider: "yahoo" },
  { id: "brent", name: "ICE Brent Crude", symbol: "@LCO.1", sourceUrl: "https://www.cnbc.com/quotes/@LCO.1", group: "commodities", provider: "cnbc" },
  { id: "gold", name: "Gold COMEX", symbol: "@GC.1", sourceUrl: "https://www.cnbc.com/quotes/@GC.1", group: "commodities", provider: "cnbc" },
  { id: "us30y", name: "U.S. 30 Year Treasury", symbol: "US.30", sourceUrl: "https://www.cnbc.com/quotes/US.30", group: "rates", provider: "cnbc" },
  { id: "bitcoin", name: "Bitcoin/USD", symbol: "BTC.CM=", sourceUrl: "https://www.cnbc.com/quotes/BTC.CM=", group: "crypto", provider: "cnbc" },
  { id: "ether", name: "Ether/USD", symbol: "ETH.CM=", sourceUrl: "https://www.cnbc.com/quotes/ETH.CM=", group: "crypto", provider: "cnbc" },
  { id: "shiller-pe", name: "Shiller PE Ratio", symbol: "CAPE", sourceUrl: SHILLER_PE_URL, group: "valuation", provider: "multpl", alertThreshold: 45 }
];

const CNBC_ENDPOINT = "https://quote.cnbc.com/quote-html-webservice/quote.htm";
const YAHOO_CHART_ENDPOINT = "https://query1.finance.yahoo.com/v8/finance/chart";
const HEADERS = {
  "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/135.0 Safari/537.36",
  accept: "application/json,text/html,text/plain,*/*"
};

export default defineEventHandler(async () => {
  const settled = await Promise.allSettled(INSTRUMENTS.map(fetchInstrument));
  const quotes = settled.map((item, index): FinanceQuote => {
    const instrument = INSTRUMENTS[index];
    const quote = item.status === "fulfilled" ? item.value : emptyQuote(instrument, item.reason);
    const isThresholdAlert = typeof quote.price === "number" && typeof instrument.alertThreshold === "number" && quote.price > instrument.alertThreshold;
    return {
      ...quote,
      isThresholdAlert,
      alertMessage: isThresholdAlert ? `${instrument.name} 目前 ${formatNumber(quote.price)} 已超過警戒 ${instrument.alertThreshold}` : ""
    };
  });
  const shillerQuote = quotes.find((quote) => quote.id === "shiller-pe");

  return {
    fetchedAt: new Date().toISOString(),
    source: "CNBC / Yahoo Finance / Multpl",
    quotes,
    financeAlerts: quotes.filter((quote) => quote.isThresholdAlert).map((quote) => ({
      id: quote.id,
      message: quote.alertMessage,
      sourceUrl: quote.sourceUrl
    })),
    shillerPe: {
      id: "shiller-pe",
      name: "Shiller PE Ratio",
      sourceUrl: SHILLER_PE_URL,
      current: shillerQuote?.price ?? null,
      recordHigh: SHILLER_PE_RECORD_HIGH,
      recordHighDate: SHILLER_PE_RECORD_DATE,
      updatedAt: shillerQuote?.lastUpdated ?? "",
      error: shillerQuote?.error
    },
    items: quotes.map((quote) => ({
      id: quote.id,
      name: quote.displayName || quote.name,
      symbol: quote.symbol,
      group: quote.group,
      url: quote.sourceUrl,
      lastLabel: formatNumber(quote.price),
      changeLabel: formatChange(quote.changePercent),
      status: quote.error || quote.recordTag || "",
      note: quote.error ? `即時讀取失敗：${quote.error}` : `即時資料：${quote.provider.toUpperCase()}${quote.lastUpdated ? ` / ${quote.lastUpdated}` : ""}`
    }))
  };
});

async function fetchInstrument(instrument: FinanceInstrument): Promise<FinanceQuote> {
  if (instrument.provider === "yahoo") return fetchYahooInstrument(instrument);
  if (instrument.provider === "multpl") return fetchMultplInstrument(instrument);
  return fetchCnbcInstrument(instrument);
}

async function fetchCnbcInstrument(instrument: FinanceInstrument): Promise<FinanceQuote> {
  const params = new URLSearchParams({
    symbols: instrument.symbol,
    requestMethod: "quick",
    noform: "1",
    fund: "1",
    output: "json"
  });
  const response = await fetch(`${CNBC_ENDPOINT}?${params}`, { headers: HEADERS, cache: "no-store" });
  if (!response.ok) throw new Error(`CNBC HTTP ${response.status}`);
  const payload = await response.json();
  const raw = payload?.QuickQuoteResult?.QuickQuote;
  const record = Array.isArray(raw) ? raw[0] : raw;
  if (!record || typeof record !== "object") throw new Error("CNBC 無報價資料");
  const quote = record as Record<string, unknown>;
  const price = pickNumber(quote, ["last", "last_price", "Last", "price", "yrlast"]);
  const high52 = pickNumber(quote, ["high_52week", "high52", "yrhiprice", "year_high"]);
  const low52 = pickNumber(quote, ["low_52week", "low52", "yrloprice", "year_low"]);
  return finishQuote(instrument, {
    displayName: pickText(quote, ["name", "shortName", "symbolName"]) || instrument.name,
    price,
    change: pickNumber(quote, ["change", "net_change"]),
    changePercent: pickNumber(quote, ["change_pct", "change_percent", "pctchange"]),
    currency: pickText(quote, ["currencyCode", "currency"]),
    high52,
    low52,
    dayHigh: pickNumber(quote, ["high", "day_high"]),
    dayLow: pickNumber(quote, ["low", "day_low"]),
    lastUpdated: pickText(quote, ["last_time", "last_time_msec", "time"]),
    recordTag: getRecordTag(price, high52, low52)
  });
}

async function fetchYahooInstrument(instrument: FinanceInstrument): Promise<FinanceQuote> {
  const params = new URLSearchParams({ range: "1y", interval: "1d", lang: "zh-TW", region: "TW" });
  const response = await fetch(`${YAHOO_CHART_ENDPOINT}/${encodeURIComponent(instrument.symbol)}?${params}`, { headers: HEADERS, cache: "no-store" });
  if (!response.ok) throw new Error(`Yahoo HTTP ${response.status}`);
  const payload = await response.json();
  const chart = payload?.chart?.result?.[0];
  if (!chart) throw new Error("Yahoo 無圖表資料");
  const meta = (chart.meta || {}) as Record<string, unknown>;
  const series = (chart.indicators?.quote?.[0] || {}) as Record<string, unknown>;
  const closes = toNumberList(series.close);
  const highs = toNumberList(series.high);
  const lows = toNumberList(series.low);
  const price = pickNumber(meta, ["regularMarketPrice"]) ?? closes.at(-1) ?? null;
  const previousClose = closes.length > 1 ? closes[closes.length - 2] : null;
  const change = price != null && previousClose != null ? price - previousClose : null;
  const changePercent = change != null && previousClose ? (change / previousClose) * 100 : null;
  const marketTime = pickNumber(meta, ["regularMarketTime"]);
  const high52 = highs.length ? Math.max(...highs) : null;
  const low52 = lows.length ? Math.min(...lows) : null;
  return finishQuote(instrument, {
    displayName: pickText(meta, ["shortName", "longName"]) || instrument.name,
    price,
    change,
    changePercent,
    currency: pickText(meta, ["currency"]) || "TWD",
    high52,
    low52,
    dayHigh: highs.at(-1) ?? null,
    dayLow: lows.at(-1) ?? null,
    lastUpdated: marketTime ? new Date(marketTime * 1000).toISOString() : "",
    recordTag: getRecordTag(price, high52, low52)
  });
}

async function fetchMultplInstrument(instrument: FinanceInstrument): Promise<FinanceQuote> {
  const response = await fetch(instrument.sourceUrl, { headers: HEADERS, cache: "no-store" });
  if (!response.ok) throw new Error(`Multpl HTTP ${response.status}`);
  const text = stripTags(await response.text());
  const price = extractFirstNumber(/Current\s+Shiller\s+PE\s+Ratio(?:\s+is)?\s*:?\s*([0-9]+(?:\.[0-9]+)?)/i, text) ??
    extractFirstNumber(/\bShiller\s+PE\s+Ratio\s+([0-9]+(?:\.[0-9]+)?)/i, text);
  if (price == null) throw new Error("Multpl 無 Shiller PE 資料");
  return finishQuote(instrument, {
    displayName: instrument.name,
    price,
    change: null,
    changePercent: null,
    currency: "",
    high52: SHILLER_PE_RECORD_HIGH,
    low52: extractFirstNumber(/Min:\s*([0-9]+(?:\.[0-9]+)?)/i, text),
    dayHigh: null,
    dayLow: null,
    lastUpdated: text.match(/([0-9]{1,2}:[0-9]{2}\s*[AP]M\s*[A-Z]{2,4},\s*[A-Za-z]{3}\s+[A-Za-z]{3}\s+[0-9]{1,2})/i)?.[1] || "",
    recordTag: price > SHILLER_PE_RECORD_HIGH ? "new-high" : null
  });
}

function finishQuote(instrument: FinanceInstrument, quote: Omit<FinanceQuote, keyof FinanceInstrument | "isThresholdAlert" | "alertMessage">): FinanceQuote {
  return { ...instrument, ...quote, isThresholdAlert: false, alertMessage: "" };
}

function emptyQuote(instrument: FinanceInstrument, reason: unknown): FinanceQuote {
  return finishQuote(instrument, {
    displayName: instrument.name,
    price: null,
    change: null,
    changePercent: null,
    currency: "",
    high52: null,
    low52: null,
    dayHigh: null,
    dayLow: null,
    lastUpdated: "",
    recordTag: null,
    error: reason instanceof Error ? reason.message : "即時資料讀取失敗"
  });
}

function asNumber(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value !== "string") return null;
  const parsed = Number(value.replace(/[$,%\s,]/g, ""));
  return Number.isFinite(parsed) ? parsed : null;
}

function pickNumber(record: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const value = asNumber(record[key]);
    if (value != null) return value;
  }
  return null;
}

function pickText(record: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return "";
}

function toNumberList(value: unknown) {
  return Array.isArray(value) ? value.map(asNumber).filter((item): item is number => item != null) : [];
}

function getRecordTag(price: number | null, high52: number | null, low52: number | null) {
  if (price != null && high52 != null && price >= high52) return "new-high";
  if (price != null && low52 != null && price <= low52) return "new-low";
  return null;
}

function stripTags(html: string) {
  return html.replace(/<script[\s\S]*?<\/script>/gi, " ").replace(/<style[\s\S]*?<\/style>/gi, " ").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

function extractFirstNumber(pattern: RegExp, text: string) {
  return asNumber(text.match(pattern)?.[1] || "");
}

function formatNumber(value: number | null | undefined) {
  return value == null ? "--" : value.toLocaleString("zh-TW", { maximumFractionDigits: Math.abs(value) < 100 ? 3 : 2 });
}

function formatChange(value: number | null | undefined) {
  if (value == null) return "--";
  return `${value >= 0 ? "+" : ""}${value.toFixed(2)}%`;
}
