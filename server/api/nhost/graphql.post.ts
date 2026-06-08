type GraphqlBody = {
  query?: string;
  variables?: Record<string, unknown>;
  graphqlUrl?: string;
  adminSecret?: string;
  authorization?: string;
};

export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig();
  const body = await readBody<GraphqlBody>(event);
  const graphqlUrl = body.graphqlUrl || config.public.nhostGraphqlUrl;

  if (!graphqlUrl || typeof graphqlUrl !== "string") {
    throw createError({
      statusCode: 500,
      statusMessage: "Missing Nhost GraphQL URL"
    });
  }

  if (!body?.query) {
    throw createError({
      statusCode: 400,
      statusMessage: "Missing GraphQL query"
    });
  }

  const authorization = body.authorization || getHeader(event, "authorization");
  const headers: Record<string, string> = {
    "Content-Type": "application/json"
  };

  if (authorization) {
    headers.Authorization = authorization;
  }

  const adminSecret = body.adminSecret || config.nhostAdminSecret;
  if (adminSecret) {
    headers["x-hasura-admin-secret"] = String(adminSecret);
  }

  return await $fetch(graphqlUrl, {
    method: "POST",
    headers,
    body
  });
});
