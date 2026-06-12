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

  const fileUrls = buildStorageFileCandidates(graphqlUrl, id);
  const headers: Record<string, string> = {};
  const range = getHeader(event, "range");
  const adminSecret = typeof query.adminSecret === "string" ? query.adminSecret : config.nhostAdminSecret;
  const authorization = typeof query.authorization === "string" ? query.authorization : getHeader(event, "authorization");

  if (range) headers.Range = range;
  if (authorization) headers.Authorization = authorization;
  if (adminSecret) headers["x-hasura-admin-secret"] = String(adminSecret);

  let response: Response | null = null;
  let lastStatus = 0;

  for (const fileUrl of fileUrls) {
    response = await fetch(fileUrl, { headers });
    if (response.ok || response.status === 206) break;
    lastStatus = response.status;
  }

  if (!response || (!response.ok && response.status !== 206)) {
    throw createError({
      statusCode: lastStatus || 502,
      statusMessage: `Nhost Storage file request failed (${lastStatus || "unknown"})`
    });
  }

  setResponseStatus(event, response.status);
  for (const header of ["content-type", "content-length", "content-range", "accept-ranges", "cache-control", "etag"]) {
    const value = response.headers.get(header);
    if (value) setHeader(event, header, value);
  }

  return response.body;
});

function buildStorageFileCandidates(graphqlUrl: string, id: string) {
  const encodedId = encodeURIComponent(id);
  const fileEndpoint = `${deriveStorageFilesEndpoint(graphqlUrl)}/${encodedId}`;
  return [`${fileEndpoint}/download`, `${fileEndpoint}/preview`, fileEndpoint];
}

function deriveStorageFilesEndpoint(graphqlUrl: string) {
  const url = new URL(graphqlUrl);
  url.hostname = url.hostname.replace(".graphql.", ".storage.");
  url.pathname = "/v1/files";
  url.search = "";
  return url.toString().replace(/\/$/, "");
}
