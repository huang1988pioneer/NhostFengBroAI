type UploadResponse = {
  id?: string;
  name?: string;
  size?: number;
};

type UploadFields = {
  graphqlUrl?: string;
  adminSecret?: string;
  authorization?: string;
  bucketId?: string;
};

export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig();
  const parts = await readMultipartFormData(event);
  if (!parts?.length) {
    throw createError({ statusCode: 400, statusMessage: "Missing upload form data" });
  }

  const fields: UploadFields = {};
  const filePart = parts.find((part) => part.name === "file" && part.filename);
  for (const part of parts) {
    if (!part.name || part.name === "file") continue;
    fields[part.name as keyof UploadFields] = part.data.toString("utf8");
  }

  if (!filePart?.filename || !filePart.type) {
    throw createError({ statusCode: 400, statusMessage: "Missing upload file" });
  }

  const graphqlUrl = fields.graphqlUrl || config.public.nhostGraphqlUrl;
  if (!graphqlUrl || typeof graphqlUrl !== "string") {
    throw createError({ statusCode: 400, statusMessage: "Missing Nhost GraphQL URL" });
  }

  const adminSecret = fields.adminSecret || config.nhostAdminSecret;
  const authorization = fields.authorization || getHeader(event, "authorization");
  const uploadEndpoint = deriveStorageFilesEndpoint(graphqlUrl);
  const form = new FormData();
  form.append("file", new Blob([filePart.data], { type: filePart.type }), filePart.filename);
  form.append("bucket-id", fields.bucketId || "default");

  const headers: Record<string, string> = {};
  if (authorization) headers.Authorization = authorization;
  if (adminSecret) headers["x-hasura-admin-secret"] = String(adminSecret);

  try {
    const uploaded = await $fetch<UploadResponse>(uploadEndpoint, {
      method: "POST",
      headers,
      body: form
    });
    const fileId = uploaded.id;
    return {
      ok: true,
      id: fileId,
      name: uploaded.name || filePart.filename,
      size: uploaded.size ?? filePart.data.byteLength,
      url: fileId ? `${uploadEndpoint}/${fileId}` : uploadEndpoint
    };
  } catch (error: unknown) {
    throw createError({
      statusCode: 502,
      statusMessage: formatUploadError(error)
    });
  }
});

function deriveStorageFilesEndpoint(graphqlUrl: string) {
  const url = new URL(graphqlUrl);
  url.hostname = url.hostname.replace(".graphql.", ".storage.");
  url.pathname = "/v1/files";
  url.search = "";
  return url.toString();
}

function formatUploadError(error: unknown) {
  if (error && typeof error === "object") {
    const uploadError = error as {
      data?: { statusMessage?: string; message?: string; error?: string };
      statusMessage?: string;
      message?: string;
    };
    return uploadError.data?.statusMessage || uploadError.data?.message || uploadError.data?.error || uploadError.statusMessage || uploadError.message || "Nhost Storage upload failed";
  }

  return String(error || "Nhost Storage upload failed");
}
