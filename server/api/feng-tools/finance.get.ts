const FINANCE_ITEMS = [
  { id: "nikkei-225", name: "Nikkei 225", symbol: ".N225", group: "Asia", url: "https://www.cnbc.com/quotes/.N225" },
  { id: "tsmc", name: "台積電", symbol: "2330.TW", group: "Taiwan", url: "https://tw.stock.yahoo.com/quote/2330.TW" },
  { id: "sp500", name: "S&P 500", symbol: ".SPX", group: "US", url: "https://www.cnbc.com/quotes/.SPX" },
  { id: "nasdaq", name: "NASDAQ", symbol: ".IXIC", group: "US", url: "https://www.cnbc.com/quotes/.IXIC" },
  { id: "bitcoin", name: "Bitcoin", symbol: "BTC", group: "Crypto", url: "https://www.cnbc.com/quotes/BTC.CM=" },
  { id: "gold", name: "Gold", symbol: "GC", group: "Commodity", url: "https://www.cnbc.com/quotes/@GC.1" },
  { id: "shiller-pe", name: "Shiller PE", symbol: "CAPE", group: "Valuation", url: "https://www.multpl.com/shiller-pe" }
];

export default defineEventHandler(() => ({
  fetchedAt: new Date().toISOString(),
  source: "CNBC / Yahoo Finance / Multpl links",
  items: FINANCE_ITEMS.map((item) => ({
    ...item,
    lastLabel: "--",
    changeLabel: "--",
    status: "",
    note: "開啟來源查看即時報價"
  }))
}));
