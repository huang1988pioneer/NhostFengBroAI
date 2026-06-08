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
  subscription: { table: "subscription", fields: ["id", "name", "site", "price", "nextdate", "note", "account", "currency", "continue"] },
  video: { table: "video", fields: ["id", "name", "url", "note"] }
};

export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig();
  const body = await readBody<CrudBody>(event);
  const action = body.action;
  const tableConfig = body.table ? crudTables[body.table] : undefined;
  const graphqlUrl = body.graphqlUrl || config.public.nhostGraphqlUrl;

  if (!action) {
    throw createError({ statusCode: 400, statusMessage: "Missing CRUD action" });
  }

  if (!tableConfig) {
    throw createError({ statusCode: 400, statusMessage: "Unknown CRUD table" });
  }

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
    const query = `query FengbroCrudList {
      ${tableConfig.table} {
        ${tableConfig.fields.join("\n")}
      }
    }`;
    const response = await graphql<Record<string, Array<Record<string, unknown>>>>(graphqlUrl, headers, query);
    return { ok: true, rows: response[tableConfig.table] || [] };
  }

  if (action === "delete") {
    if (!body.id) throw createError({ statusCode: 400, statusMessage: "Missing row id" });
    const query = `mutation FengbroCrudDelete($id: uuid!) {
      delete_${tableConfig.table}_by_pk(id: $id) {
        id
      }
    }`;
    const response = await graphql<Record<string, { id: string } | null>>(graphqlUrl, headers, query, { id: body.id });
    return { ok: true, row: response[`delete_${tableConfig.table}_by_pk`] };
  }

  if (action === "insert") {
    const object = sanitizeRecord(tableConfig, body.record || {});
    const query = `mutation FengbroCrudInsert($object: ${tableConfig.table}_insert_input!) {
      insert_${tableConfig.table}_one(object: $object) {
        id
      }
    }`;
    const response = await graphql<Record<string, { id: string } | null>>(graphqlUrl, headers, query, { object });
    return { ok: true, row: response[`insert_${tableConfig.table}_one`] };
  }

  if (action === "update") {
    if (!body.id) throw createError({ statusCode: 400, statusMessage: "Missing row id" });
    const set = sanitizeRecord(tableConfig, body.record || {});
    const query = `mutation FengbroCrudUpdate($id: uuid!, $set: ${tableConfig.table}_set_input!) {
      update_${tableConfig.table}_by_pk(pk_columns: { id: $id }, _set: $set) {
        id
      }
    }`;
    const response = await graphql<Record<string, { id: string } | null>>(graphqlUrl, headers, query, { id: body.id, set });
    return { ok: true, row: response[`update_${tableConfig.table}_by_pk`] };
  }

  if (action === "bulk-insert") {
    const objects = (body.records || []).map((record) => sanitizeRecord(tableConfig, record)).filter((record) => Object.keys(record).length);
    const query = `mutation FengbroCrudBulkInsert($objects: [${tableConfig.table}_insert_input!]!) {
      insert_${tableConfig.table}(objects: $objects) {
        affected_rows
      }
    }`;
    const response = await graphql<Record<string, { affected_rows: number }>>(graphqlUrl, headers, query, { objects });
    return { ok: true, affectedRows: response[`insert_${tableConfig.table}`]?.affected_rows || 0 };
  }
});

async function graphql<T>(
  graphqlUrl: string,
  headers: Record<string, string>,
  query: string,
  variables?: Record<string, unknown>
): Promise<T> {
  const response = await $fetch<GraphqlResponse<T>>(graphqlUrl, {
    method: "POST",
    headers,
    body: { query, variables }
  });

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
    output[key] = normalizeValue(value);
  }

  return output;
}

function normalizeValue(value: unknown) {
  if (value === "") return null;
  return value;
}
