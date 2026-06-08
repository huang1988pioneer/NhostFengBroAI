import { createNhostTablesSql } from "~/utils/nhostSchema";

type HasuraRunSqlResponse = {
  result_type?: string;
  result?: string[][];
  error?: string;
  code?: string;
};

export default defineEventHandler(async () => {
  const config = useRuntimeConfig();
  const graphqlUrl = config.public.nhostGraphqlUrl;

  if (!graphqlUrl || typeof graphqlUrl !== "string") {
    throw createError({
      statusCode: 500,
      statusMessage: "Missing NUXT_PUBLIC_NHOST_GRAPHQL_URL"
    });
  }

  if (!config.nhostAdminSecret) {
    throw createError({
      statusCode: 500,
      statusMessage: "Missing NUXT_NHOST_ADMIN_SECRET"
    });
  }

  const sqlEndpoint = deriveHasuraQueryEndpoint(graphqlUrl);
  const response = await $fetch<HasuraRunSqlResponse>(sqlEndpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-hasura-admin-secret": String(config.nhostAdminSecret)
    },
    body: {
      type: "run_sql",
      args: {
        source: "default",
        sql: createNhostTablesSql,
        cascade: false,
        read_only: false
      }
    }
  });

  if (response.error) {
    throw createError({
      statusCode: 500,
      statusMessage: response.error,
      data: response
    });
  }

  return {
    ok: true,
    endpoint: sqlEndpoint,
    tables: 8,
    resultType: response.result_type || "CommandOk"
  };
});

function deriveHasuraQueryEndpoint(graphqlUrl: string) {
  const url = new URL(graphqlUrl);
  url.pathname = url.pathname.replace(/\/v1\/graphql\/?$/, "/v2/query").replace(/\/v1\/?$/, "/v2/query");

  if (!url.pathname.endsWith("/v2/query")) {
    url.pathname = `${url.pathname.replace(/\/$/, "")}/v2/query`;
  }

  return url.toString();
}

