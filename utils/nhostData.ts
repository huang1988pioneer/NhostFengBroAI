import type {
  Article,
  Bank,
  CommonAccount,
  FengbroDataset,
  FinanceWatch,
  Food,
  MediaLibrary,
  Routine,
  Subscription
} from "~/data/fengbro";

type GraphqlResponse<T> = {
  data?: T;
  errors?: Array<{ message: string }>;
};

export type NhostConnection = {
  graphqlUrl?: string;
  adminSecret?: string;
  authorization?: string;
};

type SchemaField = {
  name: string;
  type: SchemaTypeRef;
};

type SchemaType = {
  name: string;
  kind: string;
  fields?: Array<{ name: string }>;
};

type SchemaTypeRef = {
  kind: string;
  name?: string;
  ofType?: SchemaTypeRef;
};

type SchemaData = {
  __schema: {
    queryType: {
      fields: SchemaField[];
    };
    types: SchemaType[];
  };
};

type ColumnMap<T extends string> = Record<T, string[]>;

type TablePlan<T extends string> = {
  key: keyof FengbroDataset;
  candidates: string[];
  columns: ColumnMap<T>;
  normalize: (rows: Array<Record<string, unknown>>) => unknown[];
};

const schemaQuery = `query FengbroSchema {
  __schema {
    queryType {
      fields {
        name
        type {
          kind
          name
          ofType {
            kind
            name
            ofType {
              kind
              name
              ofType {
                kind
                name
              }
            }
          }
        }
      }
    }
    types {
      name
      kind
      fields {
        name
      }
    }
  }
}`;

const tablePlans = [
  {
    key: "subscriptions",
    candidates: ["subscriptions", "subscription", "fengbro_subscriptions", "subscription_items"],
    columns: {
      name: ["name", "title", "subscription_name"],
      site: ["site", "url", "link"],
      price: ["price", "amount", "fee"],
      nextdate: ["nextdate", "next_date", "due_date", "renewal_date"],
      note: ["note", "notes", "description"],
      account: ["account", "account_name", "email"],
      currency: ["currency"],
      active: ["continue", "is_continue", "active", "enabled", "is_active"]
    },
    normalize: (rows) =>
      rows.map(
        (row): Subscription => ({
          name: text(row.name),
          site: text(row.site),
          price: number(row.price),
          nextdate: dateText(row.nextdate),
          note: text(row.note),
          account: text(row.account),
          currency: text(row.currency).toUpperCase() === "USD" ? "USD" : "TWD",
          continue: boolean(row.active)
        })
      )
  },
  {
    key: "foods",
    candidates: ["foods", "food", "food_items", "fengbro_foods"],
    columns: {
      name: ["name", "title", "food_name"],
      amount: ["amount", "quantity", "qty"],
      todate: ["todate", "to_date", "expiry_date", "expire_date", "best_before"],
      photo: ["photo", "image", "image_url", "photo_url"],
      price: ["price"],
      shop: ["shop", "store", "source"]
    },
    normalize: (rows) =>
      rows.map(
        (row): Food => ({
          name: text(row.name),
          amount: number(row.amount, 1),
          todate: dateText(row.todate),
          photo: text(row.photo),
          price: number(row.price),
          shop: text(row.shop)
        })
      )
  },
  {
    key: "articles",
    candidates: ["articles", "article", "notes", "note", "fengbro_articles"],
    columns: {
      title: ["title", "name"],
      content: ["content", "body", "note", "description"],
      category: ["category", "type"],
      newDate: ["newDate", "new_date", "created_at", "date"]
    },
    normalize: (rows) =>
      rows.map(
        (row): Article => ({
          title: text(row.title),
          content: text(row.content),
          category: text(row.category) || "未分類",
          newDate: dateText(row.newDate)
        })
      )
  },
  {
    key: "banks",
    candidates: ["banks", "bank", "bank_accounts", "fengbro_banks"],
    columns: {
      name: ["name", "bank_name", "title"],
      deposit: ["deposit", "balance", "amount"],
      site: ["site", "url", "link"],
      withdrawals: ["withdrawals", "withdrawal_count", "free_withdrawals"],
      transfer: ["transfer", "transfer_count", "free_transfers"],
      activity: ["activity", "activity_url"],
      card: ["card", "card_name"],
      account: ["account", "account_number"]
    },
    normalize: (rows) =>
      rows.map(
        (row): Bank => ({
          name: text(row.name),
          deposit: number(row.deposit),
          site: text(row.site),
          withdrawals: number(row.withdrawals),
          transfer: number(row.transfer),
          activity: text(row.activity),
          card: text(row.card),
          account: text(row.account)
        })
      )
  },
  {
    key: "routines",
    candidates: ["routines", "routine", "routine_items", "fengbro_routines"],
    columns: {
      name: ["name", "title"],
      note: ["note", "notes", "description"],
      lastdate1: ["lastdate1", "last_date_1", "last_date", "date"],
      lastdate2: ["lastdate2", "last_date_2"],
      lastdate3: ["lastdate3", "last_date_3"],
      link: ["link", "url", "site"],
      photo: ["photo", "image", "image_url"]
    },
    normalize: (rows) =>
      rows.map(
        (row): Routine => ({
          name: text(row.name),
          note: text(row.note),
          lastdate1: dateText(row.lastdate1),
          lastdate2: dateText(row.lastdate2),
          lastdate3: dateText(row.lastdate3),
          link: text(row.link),
          photo: text(row.photo)
        })
      )
  },
  {
    key: "commonAccounts",
    candidates: ["common_accounts", "accounts", "commonAccounts", "fengbro_accounts"],
    columns: {
      name: ["name", "email", "account"],
      sites: ["sites", "site", "services"]
    },
    normalize: (rows) =>
      rows.map(
        (row): CommonAccount => ({
          name: text(row.name),
          sites: normalizeSites(row.sites)
        })
      )
  },
  {
    key: "financeWatch",
    candidates: ["finance_watch", "finance", "watchlist", "fengbro_finance_watch"],
    columns: {
      name: ["name", "title"],
      symbol: ["symbol", "ticker"],
      value: ["value", "price", "status"],
      note: ["note", "notes", "description"]
    },
    normalize: (rows) =>
      rows.map(
        (row): FinanceWatch => ({
          name: text(row.name),
          symbol: text(row.symbol),
          value: text(row.value),
          note: text(row.note)
        })
      )
  },
  {
    key: "mediaSeed",
    candidates: ["media_items", "media", "fengbro_media"],
    columns: {
      name: ["name", "title"],
      type: ["type", "kind", "category"]
    },
    normalize: (rows) => [normalizeMedia(rows)]
  }
] satisfies TablePlan<string>[];

export async function fetchNhostDataset(base: FengbroDataset): Promise<{
  dataset: FengbroDataset;
  loadedKeys: Array<keyof FengbroDataset>;
}>;
export async function fetchNhostDataset(
  base: FengbroDataset,
  connection: NhostConnection = {}
): Promise<{
  dataset: FengbroDataset;
  loadedKeys: Array<keyof FengbroDataset>;
}> {
  const config = useRuntimeConfig();
  if (!connection.graphqlUrl && !config.public.nhostGraphqlUrl) {
    throw new Error("請在設定頁輸入 Nhost GraphQL URL，或設定 NUXT_PUBLIC_NHOST_GRAPHQL_URL。");
  }

  const schema = await graphql<SchemaData>(schemaQuery, connection);
  const { rootFields, typeFields } = indexSchema(schema);
  const selections: string[] = [];
  const activePlans: Array<TablePlan<string> & { table: string; selectedColumns: Record<string, string> }> = [];

  for (const plan of tablePlans) {
    const table = plan.candidates.find((candidate) => rootFields.has(candidate));
    if (!table) continue;

    const typeName = rootFields.get(table);
    const fields = typeName ? typeFields.get(typeName) : undefined;
    if (!fields) continue;

    const selectedColumns: Record<string, string> = {};
    const fieldSelections = Object.entries(plan.columns).flatMap(([alias, candidates]) => {
      const column = candidates.find((candidate) => fields.has(candidate));
      if (!column) return [];
      selectedColumns[alias] = column;
      return column === alias ? [column] : [`${alias}: ${column}`];
    });

    if (!fieldSelections.length) continue;

    activePlans.push({ ...plan, table, selectedColumns });
    selections.push(`${plan.key}: ${table} { ${fieldSelections.join(" ")} }`);
  }

  if (!selections.length) {
    return { dataset: base, loadedKeys: [] };
  }

  const data = await graphql<Record<string, unknown[]>>(`query FengbroData { ${selections.join("\n")} }`, connection);
  const dataset: FengbroDataset = structuredClone(base);
  const loadedKeys: Array<keyof FengbroDataset> = [];

  for (const plan of activePlans) {
    const rows = Array.isArray(data[plan.key]) ? (data[plan.key] as Array<Record<string, unknown>>) : [];
    if (!rows.length) continue;

    if (plan.key === "mediaSeed") {
      dataset.mediaSeed = plan.normalize(rows)[0] as MediaLibrary;
    } else {
      (dataset[plan.key] as unknown[]) = plan.normalize(rows);
    }

    loadedKeys.push(plan.key);
  }

  return { dataset, loadedKeys };
}

async function graphql<T>(query: string, connection: NhostConnection): Promise<T> {
  const response = await $fetch<GraphqlResponse<T>>("/api/nhost/graphql", {
    method: "POST",
    body: { query, ...connection }
  });

  if (response.errors?.length) {
    throw new Error(response.errors.map((error) => error.message).join("; "));
  }

  if (!response.data) {
    throw new Error("Nhost GraphQL did not return data.");
  }

  return response.data;
}

function indexSchema(schema: SchemaData) {
  const rootFields = new Map<string, string>();
  const typeFields = new Map<string, Set<string>>();

  for (const field of schema.__schema.queryType.fields) {
    const typeName = unwrapTypeName(field.type);
    if (typeName && !field.name.endsWith("_aggregate")) {
      rootFields.set(field.name, typeName);
    }
  }

  for (const type of schema.__schema.types) {
    if (type.name && type.fields?.length) {
      typeFields.set(type.name, new Set(type.fields.map((field) => field.name)));
    }
  }

  return { rootFields, typeFields };
}

function unwrapTypeName(type?: SchemaTypeRef): string | undefined {
  if (!type) return undefined;
  if (type.name) return type.name;
  return unwrapTypeName(type.ofType);
}

function text(value: unknown): string {
  if (value === null || value === undefined) return "";
  return String(value);
}

function number(value: unknown, fallback = 0): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function boolean(value: unknown): boolean {
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value > 0;
  if (typeof value === "string") return ["true", "1", "yes", "y"].includes(value.toLowerCase());
  return false;
}

function dateText(value: unknown): string {
  return text(value).slice(0, 10);
}

function normalizeSites(value: unknown): Array<{ site: string; note: string }> {
  if (Array.isArray(value)) {
    return value.map((entry) => {
      if (typeof entry === "string") return { site: entry, note: "" };
      if (entry && typeof entry === "object") {
        const record = entry as Record<string, unknown>;
        return { site: text(record.site || record.name || record.service), note: text(record.note) };
      }
      return { site: text(entry), note: "" };
    });
  }

  return text(value)
    .split(/[,;\n]/)
    .map((site) => site.trim())
    .filter(Boolean)
    .map((site) => ({ site, note: "" }));
}

function normalizeMedia(rows: Array<Record<string, unknown>>): MediaLibrary {
  const media: MediaLibrary = {
    images: [],
    videos: [],
    music: [],
    documents: [],
    podcasts: []
  };

  for (const row of rows) {
    const name = text(row.name);
    if (!name) continue;

    const type = text(row.type).toLowerCase();
    if (["image", "images", "photo", "photos"].includes(type)) media.images.push(name);
    else if (["video", "videos"].includes(type)) media.videos.push(name);
    else if (["music", "song", "songs", "audio"].includes(type)) media.music.push(name);
    else if (["document", "documents", "doc", "docs"].includes(type)) media.documents.push(name);
    else if (["podcast", "podcasts"].includes(type)) media.podcasts.push(name);
  }

  return media;
}
