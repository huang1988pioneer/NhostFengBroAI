import { executeGraphqlWithAutoTrack } from "../../utils/hasuraAutoTrack";
import { buildCrudFieldSelection, resolveCrudTableConfig, sanitizeCrudRecord } from "../../utils/nhostCrudTables";

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

export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig();
  const body = await readBody<CrudBody>(event);
  const action = body.action;

  const rawTable = body.table || "";
  const tableConfig = resolveCrudTableConfig(rawTable);

  const graphqlUrl = body.graphqlUrl || config.public.nhostGraphqlUrl;

  if (!action) {
    throw createError({ statusCode: 400, statusMessage: "Missing CRUD action" });
  }

  if (!tableConfig) {
    throw createError({ statusCode: 400, statusMessage: `Unknown CRUD table: ${rawTable}` });
  }

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
    const query = `query FengbroCrudList {
      ${dbTableName} {
        ${buildCrudFieldSelection(tableConfig)}
      }
    }`;
    const response = await graphql<Record<string, Array<Record<string, unknown>>>>(graphqlUrl, headers, query, undefined, typeof adminSecret === "string" ? adminSecret : undefined);
    return { ok: true, rows: response[dbTableName] || [] };
  }

  if (action === "delete") {
    if (!body.id) throw createError({ statusCode: 400, statusMessage: "Missing row id" });
    const query = `mutation FengbroCrudDelete($id: uuid!) {
      delete_${dbTableName}_by_pk(id: $id) {
        id
      }
    }`;
    const response = await graphql<Record<string, { id: string } | null>>(graphqlUrl, headers, query, { id: body.id }, typeof adminSecret === "string" ? adminSecret : undefined);
    const row = response[`delete_${dbTableName}_by_pk`];
    return { ok: Boolean(row?.id), row };
  }

  if (action === "insert") {
    const object = sanitizeCrudRecord(tableConfig, body.record || {});
    const query = `mutation FengbroCrudInsert($object: ${dbTableName}_insert_input!) {
      insert_${dbTableName}_one(object: $object) {
        id
      }
    }`;
    const response = await graphql<Record<string, { id: string } | null>>(graphqlUrl, headers, query, { object }, typeof adminSecret === "string" ? adminSecret : undefined);
    const row = response[`insert_${dbTableName}_one`];
    return { ok: Boolean(row?.id), row };
  }

  if (action === "update") {
    if (!body.id) throw createError({ statusCode: 400, statusMessage: "Missing row id" });
    const set = sanitizeCrudRecord(tableConfig, body.record || {});
    const query = `mutation FengbroCrudUpdate($id: uuid!, $set: ${dbTableName}_set_input!) {
      update_${dbTableName}_by_pk(pk_columns: { id: $id }, _set: $set) {
        id
      }
    }`;
    const response = await graphql<Record<string, { id: string } | null>>(graphqlUrl, headers, query, { id: body.id, set }, typeof adminSecret === "string" ? adminSecret : undefined);
    const row = response[`update_${dbTableName}_by_pk`];
    return { ok: Boolean(row?.id), row };
  }

  if (action === "bulk-insert") {
    const objects = (body.records || []).map((record) => sanitizeCrudRecord(tableConfig, record)).filter((record) => Object.keys(record).length);
    const query = `mutation FengbroCrudBulkInsert($objects: [${dbTableName}_insert_input!]!) {
      insert_${dbTableName}(objects: $objects) {
        affected_rows
      }
    }`;
    const response = await graphql<Record<string, { affected_rows: number }>>(graphqlUrl, headers, query, { objects }, typeof adminSecret === "string" ? adminSecret : undefined);
    return { ok: true, affectedRows: response[`insert_${dbTableName}`]?.affected_rows || 0 };
  }
});

async function graphql<T>(
  graphqlUrl: string,
  headers: Record<string, string>,
  query: string,
  variables?: Record<string, unknown>,
  adminSecret?: string
): Promise<T> {
  let response: GraphqlResponse<T>;
  try {
    response = await executeGraphqlWithAutoTrack<T>(graphqlUrl, headers, query, variables, adminSecret);
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
