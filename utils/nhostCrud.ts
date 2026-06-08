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
};

export async function directGraphql<T>(
  conn: NhostConnection,
  query: string,
  variables: Record<string, unknown> = {}
): Promise<T> {
  if (!conn.graphqlUrl) {
    throw new Error("請先在設定頁輸入 Nhost GraphQL URL。");
  }

  const headers: Record<string, string> = {
    "Content-Type": "application/json"
  };

  if (conn.adminSecret) headers["x-hasura-admin-secret"] = conn.adminSecret;
  if (conn.authorization) headers.Authorization = conn.authorization;

  const result = await $fetch<GraphqlResult<T>>(conn.graphqlUrl, {
    method: "POST",
    headers,
    body: { query, variables }
  });

  if (result.errors?.length) {
    throw new Error(result.errors.map((error) => error.message).join("; "));
  }

  if (!result.data) {
    throw new Error("Nhost GraphQL 沒有回傳 data。");
  }

  return result.data;
}

export async function insertRecord(
  conn: NhostConnection,
  table: string,
  object: Record<string, unknown>
): Promise<CrudResult> {
  const mutationName = `insert_${table}`;
  const inputName = `${table}_insert_input`;
  const query = `mutation InsertFengbroRecord($object: ${inputName}!) {
    ${mutationName}(objects: [$object]) { affected_rows }
  }`;

  const data = await directGraphql<Record<string, { affected_rows: number }>>(conn, query, { object });
  const affected = data[mutationName]?.affected_rows ?? 0;

  return {
    ok: affected > 0,
    affected,
    message: affected > 0 ? `已新增到 ${table}` : `${table} 未新增資料`
  };
}

export async function deleteRecordsByName(
  conn: NhostConnection,
  table: string,
  name: string,
  field = "name"
): Promise<CrudResult> {
  const mutationName = `delete_${table}`;
  const query = `mutation DeleteFengbroRecord($value: String!) {
    ${mutationName}(where: { ${field}: { _eq: $value } }) { affected_rows }
  }`;

  const data = await directGraphql<Record<string, { affected_rows: number }>>(conn, query, { value: name });
  const affected = data[mutationName]?.affected_rows ?? 0;

  return {
    ok: affected > 0,
    affected,
    message: affected > 0 ? `已刪除 ${table}` : `${table} 沒有找到可刪除資料`
  };
}

export async function createTablesDirect(
  conn: NhostConnection,
  sql: string
): Promise<{ ok: boolean; resultType: string }> {
  if (!conn.graphqlUrl) {
    throw new Error("請先在設定頁輸入 Nhost GraphQL URL。");
  }

  if (!conn.adminSecret) {
    throw new Error("請先在設定頁輸入 Hasura Admin Secret。");
  }

  const response = await $fetch<HasuraRunSqlResponse>(deriveHasuraQueryEndpoint(conn.graphqlUrl), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-hasura-admin-secret": conn.adminSecret
    },
    body: {
      type: "run_sql",
      args: {
        source: "default",
        sql,
        cascade: false,
        read_only: false
      }
    }
  });

  if (response.error) {
    throw new Error(response.error);
  }

  return {
    ok: true,
    resultType: response.result_type || "CommandOk"
  };
}

function deriveHasuraQueryEndpoint(graphqlUrl: string) {
  const url = new URL(graphqlUrl);
  url.pathname = url.pathname.replace(/\/v1\/graphql\/?$/, "/v2/query").replace(/\/v1\/?$/, "/v2/query");

  if (!url.pathname.endsWith("/v2/query")) {
    url.pathname = `${url.pathname.replace(/\/$/, "")}/v2/query`;
  }

  return url.toString();
}
