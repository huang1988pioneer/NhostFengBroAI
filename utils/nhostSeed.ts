import { fallbackDataset } from "~/data/fengbro";

const scalarMediaTables = [
  { table: "image", rows: fallbackDataset.mediaSeed.images },
  { table: "video", rows: fallbackDataset.mediaSeed.videos },
  { table: "music", rows: fallbackDataset.mediaSeed.music },
  { table: "podcast", rows: fallbackDataset.mediaSeed.podcasts },
  { table: "commondocument", rows: fallbackDataset.mediaSeed.documents }
];

export const seedNhostTablesSql = [
  insertIfEmpty(
    "subscription",
    ["name", "site", "price", "nextdate", "note", "account", "currency", "active"],
    fallbackDataset.subscriptions.map((item) => [
      item.name,
      item.site,
      item.price,
      item.nextdate,
      item.note,
      item.account,
      item.currency,
      item.continue
    ])
  ),
  insertIfEmpty(
    "food",
    ["name", "amount", "todate", "photo", "price", "shop"],
    fallbackDataset.foods.map((item) => [item.name, item.amount, item.todate, item.photo, item.price, item.shop])
  ),
  insertIfEmpty(
    "article",
    ["title", "content", "category", "newDate"],
    fallbackDataset.articles.map((item) => [item.title, item.content, item.category, item.newDate])
  ),
  insertIfEmpty(
    "bank",
    ["name", "deposit", "site", "withdrawals", "transfer", "activity", "card", "account"],
    fallbackDataset.banks.map((item) => [
      item.name,
      item.deposit,
      item.site,
      item.withdrawals,
      item.transfer,
      item.activity,
      item.card,
      item.account
    ])
  ),
  insertIfEmpty(
    "routine",
    ["name", "note", "lastdate1", "lastdate2", "lastdate3", "link", "photo"],
    fallbackDataset.routines.map((item) => [
      item.name,
      item.note,
      item.lastdate1,
      item.lastdate2,
      item.lastdate3,
      item.link,
      item.photo
    ])
  ),
  insertIfEmpty(
    "commonaccount",
    ["name", "sites", "note"],
    fallbackDataset.commonAccounts.map((item) => [item.name, jsonb(item.sites), ""])
  ),
  ...scalarMediaTables.map(({ table, rows }) =>
    insertIfEmpty(
      table,
      ["name", "url", "note"],
      rows.map((item) => [item.name, item.url, item.note])
    )
  )
].join("\n\n");

function insertIfEmpty(table: string, columns: string[], rows: unknown[][]) {
  if (!rows.length) return "";

  const columnSql = columns.map(identifier).join(", ");
  const valuesSql = rows.map((row) => `(${row.map(value).join(", ")})`).join(",\n  ");

  return `insert into public.${identifier(table)} (${columnSql})
select *
from (values
  ${valuesSql}
) as seed(${columnSql})
where not exists (select 1 from public.${identifier(table)});`;
}

function identifier(name: string) {
  return `"${name.replace(/"/g, '""')}"`;
}

function value(input: unknown): string {
  if (input === null || input === undefined || input === "") return "null";
  if (typeof input === "number") return Number.isFinite(input) ? String(input) : "0";
  if (typeof input === "boolean") return input ? "true" : "false";
  if (isJsonbValue(input)) return `'${escapeSql(input.__json)}'::jsonb`;
  return `'${escapeSql(String(input))}'`;
}

function jsonb(input: unknown) {
  return { __json: JSON.stringify(input) };
}

function isJsonbValue(input: unknown): input is { __json: string } {
  return Boolean(input && typeof input === "object" && "__json" in input);
}

function escapeSql(input: string) {
  return input.replace(/'/g, "''");
}
