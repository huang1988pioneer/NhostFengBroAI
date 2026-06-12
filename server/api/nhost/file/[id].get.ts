export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig();
  const id = getRouterParam(event, "id");
  if (!id) {
    throw createError({ statusCode: 400, statusMessage: "Missing Nhost file id" });
  }

  const query = getQuery(event);
  const graphqlUrl = typeof query.graphqlUrl === "string" ? query.graphqlUrl : config.public.nhostGraphqlUrl;
  if (!graphqlUrl || typeof graphqlUrl !== "string") {
    throw createError({ statusCode: 400, statusMessage: "Missing Nhost GraphQL URL" });
  }

  const fileUrl = `${deriveStorageFilesEndpoint(graphqlUrl)}/${encodeURIComponent(id)}`;
  const headers: Record<string, string> = {};
  const range = getHeader(event, "range");
  const adminSecret = config.nhostAdminSecret;
  const authorization = getHeader(event, "authorization");

  if (range) headers.Range = range;
  if (authorization) headers.Authorization = authorization;
  if (adminSecret) headers["x-hasura-admin-secret"] = String(adminSecret);

  const response = await fetch(fileUrl, { headers });
  if (!response.ok && response.status !== 206) {
    throw createError({
      statusCode: response.status,
      statusMessage: `Nhost Storage file request failed (${response.status})`
    });
  }

  setResponseStatus(event, response.status);
  for (const header of ["content-type", "content-length", "content-range", "accept-ranges", "cache-control", "etag"]) {
    const value = response.headers.get(header);
    if (value) setHeader(event, header, value);
  }

  return response.body;
});

function deriveStorageFilesEndpoint(graphqlUrl: string) {
  const url = new URL(graphqlUrl);
  url.hostname = url.hostname.replace(".graphql.", ".storage.");
  url.pathname = "/v1/files";
  url.search = "";
  return url.toString().replace(/\/$/, "");
}
