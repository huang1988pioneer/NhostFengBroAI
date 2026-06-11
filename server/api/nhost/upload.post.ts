type UploadResponse = {
  id?: string;
  fileMetadata?: {
    id?: string;
    name?: string;
    size?: number;
  };
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
  const file = new File([filePart.data], filePart.filename, { type: filePart.type });
  form.append("file[]", file);
  form.append("file", file);
  form.append("bucket-id", fields.bucketId || "default");

  const headers: Record<string, string> = {};
  if (authorization) headers.Authorization = authorization;
  if (adminSecret) headers["x-hasura-admin-secret"] = String(adminSecret);

  try {
    const response = await $fetch<UploadResponse | UploadResponse[]>(uploadEndpoint, {
      method: "POST",
      headers,
      body: form
    });
    const uploaded = Array.isArray(response) ? response[0] : response;
    const fileId = uploaded?.id || uploaded?.fileMetadata?.id;
    const fileName = uploaded?.name || uploaded?.fileMetadata?.name || filePart.filename;
    return {
      ok: true,
      id: fileId,
      name: fileName,
      size: uploaded?.size ?? uploaded?.fileMetadata?.size ?? filePart.data.byteLength,
      url: fileId ? `${uploadEndpoint}/${fileId}` : uploadEndpoint
    };
  } catch (error: unknown) {
    throw createError({
      statusCode: 500,
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
      data?: { statusMessage?: string; message?: string; error?: string; errors?: Array<{ message?: string }> };
      statusMessage?: string;
      message?: string;
    };
    const messages = uploadError.data?.errors?.map((item) => item.message).filter(Boolean).join("; ");
    return messages || uploadError.data?.statusMessage || uploadError.data?.message || uploadError.data?.error || uploadError.statusMessage || uploadError.message || "Nhost Storage upload failed";
  }

  return String(error || "Nhost Storage upload failed");
}
