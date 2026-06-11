export type CrudTableField = {
  client: string;
  db?: string;
};

export type CrudTableConfig = {
  table: string;
  fields: CrudTableField[];
};

const crudTables: Record<string, CrudTableConfig> = {
  article: fields("article", ["id", "title", "content", "category", "newDate"]),
  bank: fields("bank", ["id", "name", "deposit", "site", "withdrawals", "transfer", "activity", "card", "account"]),
  commonaccount: fields("commonaccount", ["id", "name", "sites", "note"]),
  commondocument: fields("commondocument", ["id", "name", "url", "note"]),
  food: fields("food", ["id", "name", "amount", "todate", "photo", "price", "shop"]),
  image: fields("image", ["id", "name", "url", "note"]),
  landtophistory: fields("landtophistory", ["id", "title", "content", "category", "newDate", "url"]),
  music: fields("music", ["id", "name", "url", "note"]),
  podcast: fields("podcast", ["id", "name", "url", "note"]),
  routine: fields("routine", ["id", "name", "note", "lastdate1", "lastdate2", "lastdate3", "link", "photo"]),
  subscription: {
    table: "subscription",
    fields: [
      { client: "id" },
      { client: "name" },
      { client: "site" },
      { client: "price" },
      { client: "nextdate" },
      { client: "note" },
      { client: "account" },
      { client: "currency" },
      { client: "continue", db: "active" }
    ]
  },
  video: fields("video", ["id", "name", "url", "note"])
};

const tableAliases: Record<string, string> = {
  accounts: "commonaccount",
  articles: "article",
  bank_accounts: "bank",
  banks: "bank",
  commonAccounts: "commonaccount",
  common_accounts: "commonaccount",
  commonaccounts: "commonaccount",
  commondocuments: "commondocument",
  documents: "commondocument",
  fengbro_subscriptions: "subscription",
  food_items: "food",
  foods: "food",
  images: "image",
  media_items: "image",
  note: "article",
  notes: "article",
  podcasts: "podcast",
  routine_items: "routine",
  routines: "routine",
  subscription_items: "subscription",
  subscriptions: "subscription",
  videos: "video"
};

export function resolveCrudTableConfig(rawTable: string): CrudTableConfig | undefined {
  const resolvedName = tableAliases[rawTable] || tableAliases[rawTable.toLowerCase()] || rawTable;
  return crudTables[resolvedName];
}

export function buildCrudFieldSelection(tableConfig: CrudTableConfig) {
  return tableConfig.fields
    .map((field) => field.db && field.db !== field.client ? `${field.client}: ${field.db}` : field.client)
    .join("\n");
}

export function sanitizeCrudRecord(tableConfig: CrudTableConfig, record: Record<string, unknown>) {
  const fieldByClientName = new Map(tableConfig.fields.filter((field) => field.client !== "id").map((field) => [field.client, field]));
  const output: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(record)) {
    const field = fieldByClientName.get(key);
    if (!field) continue;
    output[field.db || field.client] = normalizeValue(value, key);
  }

  return output;
}

function fields(table: string, names: string[]): CrudTableConfig {
  return { table, fields: names.map((client) => ({ client })) };
}

function normalizeValue(value: unknown, key?: string) {
  if (value === "") return null;
  if (typeof value === "string" && key && isDateField(key) && value.includes("/")) {
    return value.replace(/\//g, "-");
  }
  return value;
}

function isDateField(key: string) {
  return ["newDate", "nextdate", "todate", "lastdate1", "lastdate2", "lastdate3"].includes(key) || key.includes("date");
}
