import type { NhostConnection } from "./nhostData";

type GraphqlResult<T> = {
  data?: T;
  errors?: Array<{ message: string }>;
};

type HasuraRunSqlResponse = {
  result_type?: string;
  error?: string;
  code?: string;
};

export type CrudResult = {
  ok: boolean;
  affected: number;
  message: string;
  id?: string;
};

// ── Route through server-side proxy (reads NUXT env vars) ────────────────────

export async function insertRecord(
  conn: NhostConnection,
  table: string,
  object: Record<string, unknown>
): Promise<CrudResult> {
  const result = await $fetch<{ ok: boolean; row?: { id: string } | null }>("/api/nhost/crud", {
    method: "POST",
    body: { action: "insert", table, record: object, ...conn }
  });
  const id = result.row?.id;
  const ok = Boolean(result.ok && id);
  return {
    ok,
    affected: ok ? 1 : 0,
    id,
    message: ok ? `已新增到 ${table}` : `${table} 未新增資料，請檢查 Hasura 權限或 Admin Secret`
  };
}

export async function updateRecord(
  conn: NhostConnection,
  table: string,
  id: string,
  record: Record<string, unknown>
): Promise<CrudResult> {
  const result = await $fetch<{ ok: boolean; row?: { id: string } | null }>("/api/nhost/crud", {
    method: "POST",
    body: { action: "update", table, id, record, ...conn }
  });
  const ok = Boolean(result.ok && result.row?.id);
  return {
    ok,
    affected: ok ? 1 : 0,
    message: ok ? `已更新 ${table}` : `${table} 更新失敗，請確認資料 id 與寫入權限`
  };
}

export async function deleteRecordById(
  conn: NhostConnection,
  table: string,
  id: string
): Promise<CrudResult> {
  const result = await $fetch<{ ok: boolean; row?: { id: string } | null }>("/api/nhost/crud", {
    method: "POST",
    body: { action: "delete", table, id, ...conn }
  });
  return {
    ok: result.ok,
    affected: result.ok ? 1 : 0,
    message: result.ok ? `已刪除 ${table}` : `${table} 刪除失敗`
  };
}

export async function deleteRecordsByName(
  conn: NhostConnection,
  table: string,
  name: string,
  field = "name"
): Promise<CrudResult> {
  // Route through server graphql proxy to use server-side env vars
  const query = `mutation DeleteFengbroRecord($value: String!) {
    delete_${table}(where: { ${field}: { _eq: $value } }) { affected_rows }
  }`;

  const result = await $fetch<GraphqlResult<Record<string, { affected_rows: number }>>>(
    "/api/nhost/graphql",
    { method: "POST", body: { query, variables: { value: name }, ...conn } }
  );

  if (result.errors?.length) throw new Error(result.errors[0].message);
  const affected = result.data?.[`delete_${table}`]?.affected_rows ?? 0;
  return {
    ok: affected > 0,
    affected,
    message: affected > 0 ? `已刪除 ${table}` : `${table} 沒有找到可刪除資料`
  };
}

// ── Direct GraphQL (kept for read-only, non-critical use) ────────────────────

export async function directGraphql<T>(
  conn: NhostConnection,
  query: string,
  variables: Record<string, unknown> = {}
): Promise<T> {
  if (!conn.graphqlUrl) {
    throw new Error("請先在設定頁輸入 Nhost GraphQL URL。");
  }

  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (conn.adminSecret) headers["x-hasura-admin-secret"] = conn.adminSecret;
  if (conn.authorization) headers.Authorization = conn.authorization;

  const result = await $fetch<GraphqlResult<T>>(conn.graphqlUrl, {
    method: "POST",
    headers,
    body: { query, variables }
  });

  if (result.errors?.length) {
    throw new Error(result.errors.map((e) => e.message).join("; "));
  }
  if (!result.data) throw new Error("Nhost GraphQL 沒有回傳 data。");
  return result.data;
}

export async function createTablesDirect(
  conn: NhostConnection,
  sql: string
): Promise<{ ok: boolean; resultType: string }> {
  if (!conn.graphqlUrl) throw new Error("請先在設定頁輸入 Nhost GraphQL URL。");
  if (!conn.adminSecret) throw new Error("請先在設定頁輸入 Hasura Admin Secret。");

  const response = await $fetch<HasuraRunSqlResponse>(deriveHasuraQueryEndpoint(conn.graphqlUrl), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-hasura-admin-secret": conn.adminSecret
    },
    body: { type: "run_sql", args: { source: "default", sql, cascade: false, read_only: false } }
  });

  if (response.error) throw new Error(response.error);
  return { ok: true, resultType: response.result_type || "CommandOk" };
}

function deriveHasuraQueryEndpoint(graphqlUrl: string) {
  const url = new URL(graphqlUrl);
  url.hostname = url.hostname.replace(".graphql.", ".hasura.");
  url.pathname = url.pathname
    .replace(/\/v1\/graphql\/?$/, "/v2/query")
    .replace(/\/v1\/?$/, "/v2/query");
  if (!url.pathname.endsWith("/v2/query")) {
    url.pathname = `${url.pathname.replace(/\/$/, "")}/v2/query`;
  }
  return url.toString();
}
