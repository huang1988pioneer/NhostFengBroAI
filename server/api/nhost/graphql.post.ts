type GraphqlBody = {
  query?: string;
  variables?: Record<string, unknown>;
};

export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig();
  const body = await readBody<GraphqlBody>(event);
  const graphqlUrl = config.public.nhostGraphqlUrl;

  if (!graphqlUrl || typeof graphqlUrl !== "string") {
    throw createError({
      statusCode: 500,
      statusMessage: "Missing NUXT_PUBLIC_NHOST_GRAPHQL_URL"
    });
  }

  if (!body?.query) {
    throw createError({
      statusCode: 400,
      statusMessage: "Missing GraphQL query"
    });
  }

  const authorization = getHeader(event, "authorization");
  const headers: Record<string, string> = {
    "Content-Type": "application/json"
  };

  if (authorization) {
    headers.Authorization = authorization;
  }

  if (config.nhostAdminSecret) {
    headers["x-hasura-admin-secret"] = String(config.nhostAdminSecret);
  }

  return await $fetch(graphqlUrl, {
    method: "POST",
    headers,
    body
  });
});

