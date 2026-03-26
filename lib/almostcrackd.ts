const MAX_IMAGE_BYTES = 8 * 1024 * 1024;
const ALLOWED_CONTENT_TYPES = new Set([
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
  "image/gif",
  "image/heic",
]);

type PresignResponse = {
  presignedUrl?: string;
  cdnUrl?: string;
};

type UploadFromUrlResponse = {
  imageId?: string;
};

export function extractCaptionStrings(payload: unknown): string[] {
  if (Array.isArray(payload)) {
    return payload
      .map((item) => {
        if (typeof item === "string") return item;
        if (!item || typeof item !== "object") return null;
        const value = item as { content?: unknown; caption?: unknown; text?: unknown };
        if (typeof value.content === "string") return value.content;
        if (typeof value.caption === "string") return value.caption;
        if (typeof value.text === "string") return value.text;
        return null;
      })
      .filter((value): value is string => Boolean(value && value.trim()))
      .map((value) => value.trim());
  }

  if (payload && typeof payload === "object") {
    const obj = payload as {
      captions?: unknown;
      data?: unknown;
      content?: unknown;
      caption?: unknown;
      text?: unknown;
    };

    if (Array.isArray(obj.captions)) return extractCaptionStrings(obj.captions);
    if (Array.isArray(obj.data)) return extractCaptionStrings(obj.data);
    if (typeof obj.content === "string" && obj.content.trim()) return [obj.content.trim()];
    if (typeof obj.caption === "string" && obj.caption.trim()) return [obj.caption.trim()];
    if (typeof obj.text === "string" && obj.text.trim()) return [obj.text.trim()];
  }

  return [];
}

function buildPrompt(flavor: PromptFlavor, steps: PromptStep[]) {
  const description = flavor.description?.trim();
  const stepText = steps
    .sort((left, right) => left.step_order - right.step_order)
    .map((step, index) => `${index + 1}. ${step.title}: ${step.instruction}`)
    .join("\n");

  return [
    `Humor flavor: ${flavor.name}`,
    description ? `Flavor brief: ${description}` : null,
    "Run the following prompt chain against the image in order:",
    stepText,
    "Return only short caption candidates.",
  ]
    .filter(Boolean)
    .join("\n");
}

async function generatePresignedUpload(
  baseUrl: string,
  token: string,
  contentType: string
): Promise<{ presignedUrl: string; cdnUrl: string }> {
  const response = await fetch(`${baseUrl}/pipeline/generate-presigned-url`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ contentType }),
  });

  if (!response.ok) {
    throw new Error(`Failed to generate presigned URL: ${await response.text()}`);
  }

  const payload = (await response.json()) as PresignResponse;

  if (!payload.presignedUrl || !payload.cdnUrl) {
    throw new Error("Presign response missing presignedUrl or cdnUrl");
  }

  return {
    presignedUrl: payload.presignedUrl,
    cdnUrl: payload.cdnUrl,
  };
}

async function registerUploadedImage(baseUrl: string, token: string, cdnUrl: string) {
  const response = await fetch(`${baseUrl}/pipeline/upload-image-from-url`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      imageUrl: cdnUrl,
      isCommonUse: false,
    }),
  });

  if (!response.ok) {
    throw new Error(`Failed to register uploaded image URL: ${await response.text()}`);
  }

  const payload = (await response.json()) as UploadFromUrlResponse;
  if (!payload.imageId) throw new Error("Upload registration did not return imageId");
  return payload.imageId;
}

export async function runPromptChainTest(args: {
  file: File;
  token: string;
  baseUrl: string;
  flavor: PromptFlavor;
  steps: PromptStep[];
}) {
  const contentType = args.file.type.toLowerCase();
  if (!ALLOWED_CONTENT_TYPES.has(contentType)) {
    throw new Error(`Unsupported file type: ${args.file.type}`);
  }

  if (args.file.size > MAX_IMAGE_BYTES) {
    throw new Error("Image is too large (max 8MB)");
  }

  const presign = await generatePresignedUpload(args.baseUrl, args.token, args.file.type);
  const uploadRes = await fetch(presign.presignedUrl, {
    method: "PUT",
    headers: {
      "Content-Type": args.file.type,
    },
    body: args.file,
  });

  if (!uploadRes.ok) {
    throw new Error(`Failed to upload image bytes: ${await uploadRes.text()}`);
  }

  const imageId = await registerUploadedImage(args.baseUrl, args.token, presign.cdnUrl);
  const prompt = buildPrompt(args.flavor, args.steps);
  const customBody = {
    imageId,
    humorFlavor: {
      name: args.flavor.name,
      description: args.flavor.description,
      steps: args.steps.map((step) => ({
        id: step.id,
        order: step.step_order,
        title: step.title,
        instruction: step.instruction,
      })),
    },
    promptChain: args.steps
      .sort((left, right) => left.step_order - right.step_order)
      .map((step) => step.instruction),
    prompt,
  };

  let mode = "custom-chain";
  let response = await fetch(`${args.baseUrl}/pipeline/generate-captions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${args.token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(customBody),
  });

  let customAttemptError: string | null = null;

  if (!response.ok) {
    customAttemptError = await response.text();
    mode = "fallback-default-pipeline";
    response = await fetch(`${args.baseUrl}/pipeline/generate-captions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${args.token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ imageId }),
    });
  }

  if (!response.ok) {
    throw new Error(`Failed to generate captions: ${await response.text()}`);
  }

  const payload = (await response.json()) as unknown;
  const captions = extractCaptionStrings(payload);

  if (captions.length === 0) {
    throw new Error("No captions returned by pipeline");
  }

  return {
    imageId,
    captions,
    imageUrl: presign.cdnUrl,
    trace: {
      mode,
      customAttemptError,
      prompt,
      steps: args.steps
        .sort((left, right) => left.step_order - right.step_order)
        .map((step) => ({
          id: step.id,
          order: step.step_order,
          title: step.title,
          instruction: step.instruction,
        })),
      raw: payload,
    },
  };
}
type PromptFlavor = {
  id: string;
  name: string;
  description: string | null;
  created_at: string;
  updated_at: string;
};

type PromptStep = {
  id: string;
  flavor_id: string;
  title: string;
  instruction: string;
  step_order: number;
  created_at: string;
  updated_at: string;
};
