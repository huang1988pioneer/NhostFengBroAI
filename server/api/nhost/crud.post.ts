type CrudAction = "list" | "insert" | "update" | "delete" | "bulk-insert";

type CrudBody = {
  action?: CrudAction;
  table?: string;
  id?: string;
  record?: Record<string, unknown>;
  records?: Array<Record<string, unknown>>;
  graphqlUrl?: string;
  adminSecret?: string;
  authorization?: string;
};

type GraphqlResponse<T> = {
  data?: T;
  errors?: Array<{ message: string }>;
};

type CrudTableConfig = {
  table: string;
  fields: string[];
};

const crudTables: Record<string, CrudTableConfig> = {
  article: { table: "article", fields: ["id", "title", "content", "category", "newDate"] },
  bank: { table: "bank", fields: ["id", "name", "deposit", "site", "withdrawals", "transfer", "activity", "card", "account"] },
  commonaccount: { table: "commonaccount", fields: ["id", "name", "sites", "note"] },
  commondocument: { table: "commondocument", fields: ["id", "name", "url", "note"] },
  food: { table: "food", fields: ["id", "name", "amount", "todate", "photo", "price", "shop"] },
  image: { table: "image", fields: ["id", "name", "url", "note"] },
  music: { table: "music", fields: ["id", "name", "url", "note"] },
  podcast: { table: "podcast", fields: ["id", "name", "url", "note"] },
  routine: { table: "routine", fields: ["id", "name", "note", "lastdate1", "lastdate2", "lastdate3", "link", "photo"] },
  subscription: { table: "subscription", fields: ["id", "name", "site", "price", "nextdate", "note", "account", "currency", "active", "continue"] },
  video: { table: "video", fields: ["id", "name", "url", "note"] }
};

// Support plural/alias table names that may be found in the Nhost schema
const tableAliases: Record<string, string> = {
  articles: "article",
  notes: "article",
  note: "article",
  landtophistory: "article",
  banks: "bank",
  bank_accounts: "bank",
  common_accounts: "commonaccount",
  accounts: "commonaccount",
  commonAccounts: "commonaccount",
  foods: "food",
  food_items: "food",
  images: "image",
  media_items: "image",
  videos: "video",
  podcasts: "podcast",
  routines: "routine",
  routine_items: "routine",
  subscriptions: "subscription",
  subscription_items: "subscription",
  fengbro_subscriptions: "subscription"
};

export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig();
  const body = await readBody<CrudBody>(event);
  const action = body.action;

  // Resolve table name: check direct config, then aliases, then use as-is with a matching config
  const rawTable = body.table || "";
  const resolvedName = tableAliases[rawTable] || rawTable;
  const tableConfig = crudTables[resolvedName]
    ?? (crudTables[rawTable] ? { ...crudTables[rawTable], table: rawTable } : undefined)
    ?? (tableAliases[rawTable] ? undefined : { table: rawTable, fields: crudTables[Object.keys(crudTables).find(k => rawTable.startsWith(k)) || ""]?.fields || [] });

  const graphqlUrl = body.graphqlUrl || config.public.nhostGraphqlUrl;

  if (!action) {
    throw createError({ statusCode: 400, statusMessage: "Missing CRUD action" });
  }

  if (!tableConfig || !tableConfig.fields.length) {
    throw createError({ statusCode: 400, statusMessage: `Unknown CRUD table: ${rawTable}` });
  }

  // Use the actual DB table name from the request (may be plural/alias)
  const dbTableName = tableConfig.table;

  if (!graphqlUrl || typeof graphqlUrl !== "string") {
    throw createError({ statusCode: 400, statusMessage: "Missing Nhost GraphQL URL" });
  }

  const headers: Record<string, string> = {
    "Content-Type": "application/json"
  };

  const authorization = body.authorization || getHeader(event, "authorization");
  if (authorization) headers.Authorization = authorization;

  const adminSecret = body.adminSecret || config.nhostAdminSecret;
  if (adminSecret) headers["x-hasura-admin-secret"] = String(adminSecret);

  if (action === "list") {
    const fieldSelection = tableConfig.fields.map((field) => field === "continue" ? "continue: active" : field);
    const query = `query FengbroCrudList {
      ${dbTableName} {
        ${fieldSelection.join("\n")}
      }
    }`;
    const response = await graphql<Record<string, Array<Record<string, unknown>>>>(graphqlUrl, headers, query);
    return { ok: true, rows: response[dbTableName] || [] };
  }

  if (action === "delete") {
    if (!body.id) throw createError({ statusCode: 400, statusMessage: "Missing row id" });
    const query = `mutation FengbroCrudDelete($id: uuid!) {
      delete_${dbTableName}_by_pk(id: $id) {
        id
      }
    }`;
    const response = await graphql<Record<string, { id: string } | null>>(graphqlUrl, headers, query, { id: body.id });
    const row = response[`delete_${dbTableName}_by_pk`];
    return { ok: Boolean(row?.id), row };
  }

  if (action === "insert") {
    const object = sanitizeRecord(tableConfig, body.record || {});
    const query = `mutation FengbroCrudInsert($object: ${dbTableName}_insert_input!) {
      insert_${dbTableName}_one(object: $object) {
        id
      }
    }`;
    const response = await graphql<Record<string, { id: string } | null>>(graphqlUrl, headers, query, { object });
    const row = response[`insert_${dbTableName}_one`];
    return { ok: Boolean(row?.id), row };
  }

  if (action === "update") {
    if (!body.id) throw createError({ statusCode: 400, statusMessage: "Missing row id" });
    const set = sanitizeRecord(tableConfig, body.record || {});
    const query = `mutation FengbroCrudUpdate($id: uuid!, $set: ${dbTableName}_set_input!) {
      update_${dbTableName}_by_pk(pk_columns: { id: $id }, _set: $set) {
        id
      }
    }`;
    const response = await graphql<Record<string, { id: string } | null>>(graphqlUrl, headers, query, { id: body.id, set });
    const row = response[`update_${dbTableName}_by_pk`];
    return { ok: Boolean(row?.id), row };
  }

  if (action === "bulk-insert") {
    const objects = (body.records || []).map((record) => sanitizeRecord(tableConfig, record)).filter((record) => Object.keys(record).length);
    const query = `mutation FengbroCrudBulkInsert($objects: [${dbTableName}_insert_input!]!) {
      insert_${dbTableName}(objects: $objects) {
        affected_rows
      }
    }`;
    const response = await graphql<Record<string, { affected_rows: number }>>(graphqlUrl, headers, query, { objects });
    return { ok: true, affectedRows: response[`insert_${dbTableName}`]?.affected_rows || 0 };
  }
});

async function graphql<T>(
  graphqlUrl: string,
  headers: Record<string, string>,
  query: string,
  variables?: Record<string, unknown>
): Promise<T> {
  let response: GraphqlResponse<T>;
  try {
    response = await $fetch<GraphqlResponse<T>>(graphqlUrl, {
      method: "POST",
      headers,
      body: { query, variables }
    });
  } catch (error: unknown) {
    throw createError({
      statusCode: 502,
      statusMessage: formatFetchError(error)
    });
  }

  if (response.errors?.length) {
    throw createError({
      statusCode: 400,
      statusMessage: response.errors.map((error) => error.message).join("; ")
    });
  }

  if (!response.data) {
    throw createError({ statusCode: 502, statusMessage: "Nhost GraphQL did not return data" });
  }

  return response.data;
}

function sanitizeRecord(tableConfig: CrudTableConfig, record: Record<string, unknown>) {
  const allowed = new Set(tableConfig.fields.filter((field) => field !== "id"));
  const output: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(record)) {
    if (!allowed.has(key)) continue;
    const dbKey = key === "continue" ? "active" : key;
    output[dbKey] = normalizeValue(value, key);
  }

  return output;
}

function formatFetchError(error: unknown) {
  if (error && typeof error === "object") {
    const fetchError = error as {
      data?: { statusMessage?: string; message?: string; errors?: Array<{ message?: string }> };
      statusMessage?: string;
      message?: string;
    };
    const graphqlErrors = fetchError.data?.errors?.map((item) => item.message).filter(Boolean).join("; ");
    return graphqlErrors || fetchError.data?.statusMessage || fetchError.data?.message || fetchError.statusMessage || fetchError.message || "Nhost GraphQL request failed";
  }

  return String(error || "Nhost GraphQL request failed");
}

function normalizeValue(value: unknown, key?: string) {
  if (value === "") return null;
  // Convert date strings from YYYY/MM/DD to YYYY-MM-DD for date fields
  if (typeof value === "string" && key && (key.includes("date") || key === "nextdate" || key === "todate" || key === "newDate" || key === "lastdate1" || key === "lastdate2" || key === "lastdate3")) {
    if (value.includes("/")) {
      return value.replace(/\//g, "-");
    }
  }
  return value;
}
