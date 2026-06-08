/**
 * CSV 匯入 / 匯出工具
 * 對齊 Appwrite 匯出的 CSV 格式，不依賴第三方套件。
 */

import type {
  Article,
  Bank,
  CommonAccount,
  Food,
  Routine,
  Subscription
} from "~/data/fengbro";

/* ------------------------------------------------------------------ */
/*  通用 CSV 解析 / 產生                                               */
/* ------------------------------------------------------------------ */

/**
 * RFC 4180 標準 CSV 解析器
 * 支援引號內逗號、換行、雙引號跳脫（""）
 */
export function parseCSV(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let inQuotes = false;
  // Remove UTF-8 BOM if present
  const src = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;

  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    const next = src[i + 1];

    if (inQuotes) {
      if (ch === '"') {
        if (next === '"') {
          cell += '"';
          i++; // skip escaped quote
        } else {
          inQuotes = false;
        }
      } else {
        cell += ch;
      }
    } else {
      if (ch === '"') {
        inQuotes = true;
      } else if (ch === ",") {
        row.push(cell);
        cell = "";
      } else if (ch === "\r") {
        if (next === "\n") i++; // skip CRLF
        row.push(cell);
        cell = "";
        rows.push(row);
        row = [];
      } else if (ch === "\n") {
        row.push(cell);
        cell = "";
        rows.push(row);
        row = [];
      } else {
        cell += ch;
      }
    }
  }

  // final cell / row
  if (cell || row.length) {
    row.push(cell);
    rows.push(row);
  }

  return rows;
}

/** 產生 CSV 文字（含 UTF-8 BOM，確保 Excel 正確顯示中文） */
export function stringifyCSV(headers: string[], rows: string[][]): string {
  const BOM = "\uFEFF";
  const lines = [headers, ...rows].map((row) =>
    row.map((cell) => {
      const needsQuote = cell.includes(",") || cell.includes('"') || cell.includes("\n") || cell.includes("\r");
      if (needsQuote) {
        return `"${cell.replace(/"/g, '""')}"`;
      }
      return cell;
    }).join(",")
  );
  return BOM + lines.join("\r\n");
}

/** 建立 Blob 並觸發瀏覽器下載 */
export function downloadCSV(filename: string, csvContent: string): void {
  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/** 包裝 FileReader，將 File 讀成文字 */
export function readFileAsText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error("無法讀取檔案"));
    reader.readAsText(file, "utf-8");
  });
}

/** 今天的日期字串 YYYYMMDD */
function todayTag(): string {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}${mm}${dd}`;
}

/** 將 header 行與資料行映射成 key-value 物件陣列 */
function csvToObjects(parsed: string[][]): Array<Record<string, string>> {
  if (parsed.length < 2) return [];
  const headers = parsed[0].map((h) => h.trim());
  return parsed.slice(1)
    .filter((row) => row.some((cell) => cell.trim() !== ""))
    .map((row) => {
      const obj: Record<string, string> = {};
      headers.forEach((h, i) => {
        obj[h] = (row[i] ?? "").trim();
      });
      return obj;
    });
}

/* ------------------------------------------------------------------ */
/*  Subscription                                                       */
/* ------------------------------------------------------------------ */

const SUBSCRIPTION_HEADERS = ["name", "site", "price", "nextdate", "note", "account", "currency", "continue"];

export function exportSubscriptions(data: Subscription[]): void {
  const rows = data.map((item) => [
    item.name,
    item.site,
    String(item.price),
    item.nextdate,
    item.note,
    item.account,
    item.currency,
    String(item.continue)
  ]);
  const csv = stringifyCSV(SUBSCRIPTION_HEADERS, rows);
  downloadCSV(`appwrite-subscription-${todayTag()}.csv`, csv);
}

export function importSubscriptions(text: string): Subscription[] {
  const parsed = parseCSV(text);
  const objects = csvToObjects(parsed);
  return objects.map((row) => ({
    name: row.name ?? "",
    site: row.site ?? "",
    price: Number(row.price) || 0,
    nextdate: row.nextdate ?? "",
    note: row.note ?? "",
    account: row.account ?? "",
    currency: (row.currency?.toUpperCase() === "USD" ? "USD" : "TWD") as "TWD" | "USD",
    continue: row.continue?.toLowerCase() === "true"
  }));
}

/* ------------------------------------------------------------------ */
/*  Food                                                               */
/* ------------------------------------------------------------------ */

const FOOD_HEADERS = ["name", "amount", "todate", "photo", "price", "shop", "photohash"];

export function exportFoods(data: Food[]): void {
  const rows = data.map((item) => [
    item.name,
    String(item.amount),
    item.todate,
    item.photo,
    String(item.price),
    item.shop,
    "" // photohash — 目前應用無此欄位，匯出時保留空白
  ]);
  const csv = stringifyCSV(FOOD_HEADERS, rows);
  downloadCSV(`appwrite-food-${todayTag()}.csv`, csv);
}

export function importFoods(text: string): Food[] {
  const parsed = parseCSV(text);
  const objects = csvToObjects(parsed);
  return objects.map((row) => ({
    name: row.name ?? "",
    amount: Number(row.amount) || 1,
    todate: (row.todate ?? "").slice(0, 10),
    photo: row.photo ?? "",
    price: Number(row.price) || 0,
    shop: row.shop ?? ""
  }));
}

/* ------------------------------------------------------------------ */
/*  Article                                                            */
/* ------------------------------------------------------------------ */

const ARTICLE_HEADERS = [
  "title", "content", "category", "newDate",
  "url1", "url2", "url3",
  "file1", "file1name", "file1type",
  "file2", "file2name", "file2type",
  "file3", "file3name", "file3type"
];

export function exportArticles(data: Article[]): void {
  const rows = data.map((item) => [
    item.title,
    item.content,
    item.category,
    item.newDate,
    "", "", "", // url1, url2, url3
    "", "", "", // file1, file1name, file1type
    "", "", "", // file2, file2name, file2type
    "", "", ""  // file3, file3name, file3type
  ]);
  const csv = stringifyCSV(ARTICLE_HEADERS, rows);
  downloadCSV(`appwrite-article.csv`, csv);
}

export function importArticles(text: string): Article[] {
  const parsed = parseCSV(text);
  const objects = csvToObjects(parsed);
  return objects.map((row) => ({
    title: row.title ?? "",
    content: row.content ?? "",
    category: row.category || "未分類",
    newDate: row.newDate ?? ""
  }));
}

/* ------------------------------------------------------------------ */
/*  CommonAccount                                                      */
/* ------------------------------------------------------------------ */

// 最多 37 組 site/note 欄位，對齊 Appwrite 格式
const MAX_COMMON_SITES = 37;

function commonAccountHeaders(): string[] {
  const headers = ["name"];
  for (let i = 1; i <= MAX_COMMON_SITES; i++) {
    const idx = String(i).padStart(2, "0");
    headers.push(`site${idx}`, `note${idx}`);
  }
  return headers;
}

export function exportCommonAccounts(data: CommonAccount[]): void {
  const headers = commonAccountHeaders();
  const rows = data.map((item) => {
    const row = [item.name];
    for (let i = 0; i < MAX_COMMON_SITES; i++) {
      const entry = item.sites[i];
      row.push(entry?.site ?? "", entry?.note ?? "");
    }
    return row;
  });
  const csv = stringifyCSV(headers, rows);
  downloadCSV(`appwrite-commonaccount-${todayTag()}.csv`, csv);
}

export function importCommonAccounts(text: string): CommonAccount[] {
  const parsed = parseCSV(text);
  const objects = csvToObjects(parsed);
  return objects.map((row) => {
    const sites: Array<{ site: string; note: string }> = [];
    for (let i = 1; i <= MAX_COMMON_SITES; i++) {
      const idx = String(i).padStart(2, "0");
      const site = row[`site${idx}`] ?? "";
      const note = row[`note${idx}`] ?? "";
      if (site) {
        sites.push({ site, note });
      }
    }
    return { name: row.name ?? "", sites };
  });
}

/* ------------------------------------------------------------------ */
/*  Bank                                                               */
/* ------------------------------------------------------------------ */

const BANK_HEADERS = ["name", "deposit", "site", "address", "withdrawals", "transfer", "activity", "card", "account"];

export function exportBanks(data: Bank[]): void {
  const rows = data.map((item) => [
    item.name,
    String(item.deposit),
    item.site,
    "", // address — 目前應用無此欄位，保留空白
    String(item.withdrawals),
    String(item.transfer),
    item.activity,
    item.card,
    item.account
  ]);
  const csv = stringifyCSV(BANK_HEADERS, rows);
  downloadCSV(`appwrite-bank-${todayTag()}.csv`, csv);
}

export function importBanks(text: string): Bank[] {
  const parsed = parseCSV(text);
  const objects = csvToObjects(parsed);
  return objects.map((row) => ({
    name: row.name ?? "",
    deposit: Number(row.deposit) || 0,
    site: row.site ?? "",
    withdrawals: Number(row.withdrawals) || 0,
    transfer: Number(row.transfer) || 0,
    activity: row.activity ?? "",
    card: row.card ?? "",
    account: row.account ?? ""
  }));
}

/* ------------------------------------------------------------------ */
/*  Routine                                                            */
/* ------------------------------------------------------------------ */

const ROUTINE_HEADERS = ["name", "note", "lastdate1", "lastdate2", "lastdate3", "link", "photo"];

export function exportRoutines(data: Routine[]): void {
  const rows = data.map((item) => [
    item.name,
    item.note,
    item.lastdate1,
    item.lastdate2,
    item.lastdate3,
    item.link,
    item.photo
  ]);
  const csv = stringifyCSV(ROUTINE_HEADERS, rows);
  downloadCSV(`appwrite-routine-${todayTag()}.csv`, csv);
}

export function importRoutines(text: string): Routine[] {
  const parsed = parseCSV(text);
  const objects = csvToObjects(parsed);
  return objects.map((row) => ({
    name: row.name ?? "",
    note: row.note ?? "",
    lastdate1: (row.lastdate1 ?? "").slice(0, 10),
    lastdate2: (row.lastdate2 ?? "").slice(0, 10),
    lastdate3: (row.lastdate3 ?? "").slice(0, 10),
    link: row.link ?? "",
    photo: row.photo ?? ""
  }));
}
