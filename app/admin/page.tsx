import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { AdminPage, AdminTableCard } from "@/components/admin-data";
import { Card, Field, Input, Textarea } from "@/components/ui";
import { SubmitButton } from "@/components/submit-button";
import { requireAdmin } from "@/lib/auth/guards";
import { getFileList, getNumber, getOptionalString, getString } from "@/lib/forms";
import { runPromptChainTest } from "@/lib/almostcrackd";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

type FlavorRow = {
  id: number;
  slug: string;
  description: string | null;
  created_datetime_utc: string | null;
};

type StepRow = {
  id: number;
  humor_flavor_id: number;
  order_by: number;
  description: string | null;
  llm_system_prompt: string | null;
  llm_user_prompt: string | null;
  llm_temperature: number | null;
  llm_input_type_id: number;
  llm_output_type_id: number;
  llm_model_id: number;
  humor_flavor_step_type_id: number;
};

type CaptionRow = {
  id: string;
  content: string | null;
  created_datetime_utc: string | null;
  image_id: string;
  humor_flavor_id: number | null;
  llm_prompt_chain_id: number | null;
};

type TestResultSummary = {
  flavorId: number;
  flavorName: string;
  runs: Array<{
    fileName: string;
    imageId: string;
    captions: string[];
  }>;
};

type DisplayCaption = {
  key: string;
  content: string;
  imageId: string;
  promptChainId: string;
  created: string;
  source: "latest-test" | "stored";
};

const STEP_TEMPLATES = [
  {
    order: 1,
    title: "Describe the image",
    guidance: "Take in an image and output a description of it in text.",
    defaultInstruction:
      "Describe the image clearly in text, focusing on the main subject, what is happening, the setting, and any obvious visual details.",
    placeholder:
      "Describe the image clearly in text, focusing on the main subject, what is happening, the setting, and any obvious visual details."
  },
  {
    order: 2,
    title: "Make it funny",
    guidance: "Take the output from step 1 and output something funny about it.",
    defaultInstruction:
      "Take the image description from step 1 and write one dry, witty, slightly sarcastic joke about it.",
    placeholder:
      "Take the image description from step 1 and write one dry, witty, slightly sarcastic joke about it."
  },
  {
    order: 3,
    title: "Write five captions",
    guidance: "Take the output from step 2 and output five short, funny captions.",
    defaultInstruction:
      "Take the joke from step 2 and produce five short, funny captions. Keep each caption concise, punchy, and distinct.",
    placeholder:
      "Take the joke from step 2 and produce five short, funny captions. Keep each caption concise, punchy, and distinct."
  }
] as const;

function toAdminUrl(kind: "message" | "error", value: string) {
  return `/admin?${kind}=${encodeURIComponent(value)}`;
}

function toAdminUrlWithResults(
  kind: "message" | "error",
  value: string,
  results?: TestResultSummary
) {
  const params = new URLSearchParams([[kind, value]]);
  if (results) {
    params.set("testResults", JSON.stringify(results));
  }
  return `/admin?${params.toString()}`;
}

async function finish(kind: "message" | "error", value: string) {
  revalidatePath("/admin");
  redirect(toAdminUrl(kind, value));
}

async function finishWithResults(kind: "message" | "error", value: string, results: TestResultSummary) {
  revalidatePath("/admin");
  redirect(toAdminUrlWithResults(kind, value, results));
}

async function createFlavor(formData: FormData) {
  "use server";

  const { supabase } = await requireAdmin();
  const slug = getString(formData, "slug");
  const description = getOptionalString(formData, "description");

  if (!slug) {
    await finish("error", "Humor flavor name is required.");
  }

  const { error } = await supabase.from("humor_flavors").insert({ slug, description });
  if (error) {
    await finish("error", error.message);
  }

  await finish("message", "Humor flavor created.");
}

async function updateFlavor(formData: FormData) {
  "use server";

  const { supabase } = await requireAdmin();
  const id = getNumber(formData, "id");
  const slug = getString(formData, "slug");
  const description = getOptionalString(formData, "description");

  if (!id || !slug) {
    await finish("error", "Flavor id and name are required.");
  }

  const { error } = await supabase.from("humor_flavors").update({ slug, description }).eq("id", id);
  if (error) {
    await finish("error", error.message);
  }

  await finish("message", `Flavor ${slug} updated.`);
}

async function deleteFlavor(formData: FormData) {
  "use server";

  const { supabase } = await requireAdmin();
  const id = getNumber(formData, "id");

  if (!id) {
    await finish("error", "Flavor id is required.");
  }

  const { error } = await supabase.from("humor_flavors").delete().eq("id", id);
  if (error) {
    await finish("error", error.message);
  }

  await finish("message", `Flavor ${id} deleted.`);
}

async function loadStepDefaults(supabase: Awaited<ReturnType<typeof requireAdmin>>["supabase"]) {
  const [inputType, outputType, model, stepType] = await Promise.all([
    supabase.from("llm_input_types").select("id").order("id", { ascending: true }).limit(1).single(),
    supabase.from("llm_output_types").select("id").order("id", { ascending: true }).limit(1).single(),
    supabase.from("llm_models").select("id").order("id", { ascending: true }).limit(1).single(),
    supabase.from("humor_flavor_step_types").select("id").order("id", { ascending: true }).limit(1).single()
  ]);

  if (inputType.error || outputType.error || model.error || stepType.error) {
    throw new Error("Could not load step defaults from the database.");
  }

  return {
    llm_input_type_id: inputType.data.id,
    llm_output_type_id: outputType.data.id,
    llm_model_id: model.data.id,
    humor_flavor_step_type_id: stepType.data.id
  };
}

async function saveStep(formData: FormData) {
  "use server";

  const { supabase } = await requireAdmin();
  const stepId = getNumber(formData, "step_id");
  const humorFlavorId = getNumber(formData, "humor_flavor_id");
  const orderBy = getNumber(formData, "order_by");
  const title = getString(formData, "title");
  const guidance = getString(formData, "guidance");
  const instruction = getString(formData, "instruction");

  if (!humorFlavorId || !orderBy || !title || !guidance || !instruction) {
    await finish("error", "Each step needs its instruction before it can be saved.");
  }

  const payload = {
    description: title,
    llm_system_prompt: guidance,
    llm_user_prompt: instruction,
    llm_temperature: 0
  };

  if (stepId) {
    const { error } = await supabase.from("humor_flavor_steps").update(payload).eq("id", stepId);
    if (error) {
      await finish("error", error.message);
    }
    await finish("message", `Step ${orderBy} updated.`);
  }

  const defaults = await loadStepDefaults(supabase);
  const { error } = await supabase.from("humor_flavor_steps").insert({
    humor_flavor_id: humorFlavorId,
    order_by: orderBy,
    ...payload,
    ...defaults
  });

  if (error) {
    await finish("error", error.message);
  }

  await finish("message", `Step ${orderBy} created.`);
}

async function deleteStep(formData: FormData) {
  "use server";

  const { supabase } = await requireAdmin();
  const stepId = getNumber(formData, "step_id");
  const orderBy = getNumber(formData, "order_by");

  if (!stepId || !orderBy) {
    await finish("error", "Step id is required.");
  }

  const { error } = await supabase.from("humor_flavor_steps").delete().eq("id", stepId);
  if (error) {
    await finish("error", error.message);
  }

  await finish("message", `Step ${orderBy} deleted.`);
}

async function testFlavor(formData: FormData) {
  "use server";

  const { supabase } = await requireAdmin();
  const humorFlavorId = getNumber(formData, "humor_flavor_id");
  const files = getFileList(formData, "images");

  if (!humorFlavorId || files.length === 0) {
    await finish("error", "Select a flavor and at least one image.");
  }

  const [flavorRes, stepsRes, sessionRes] = await Promise.all([
    supabase.from("humor_flavors").select("id, slug, description").eq("id", humorFlavorId).single(),
    supabase
      .from("humor_flavor_steps")
      .select("id, humor_flavor_id, order_by, description, llm_system_prompt, llm_user_prompt")
      .eq("humor_flavor_id", humorFlavorId)
      .order("order_by", { ascending: true }),
    supabase.auth.getSession()
  ]);

  if (flavorRes.error || !flavorRes.data) {
    await finish("error", flavorRes.error?.message ?? "Flavor not found.");
  }

  if (stepsRes.error) {
    await finish("error", stepsRes.error.message);
  }

  const flavor = flavorRes.data as { id: number; slug: string; description: string | null };
  const liveSteps = (stepsRes.data ?? []) as Array<{
    id: number;
    humor_flavor_id: number;
    order_by: number;
    description: string | null;
    llm_system_prompt: string | null;
    llm_user_prompt: string | null;
  }>;

  const hasAllThreeSteps = STEP_TEMPLATES.every((template) =>
    liveSteps.some((step) => step.order_by === template.order && step.llm_user_prompt?.trim())
  );

  if (!hasAllThreeSteps) {
    await finish("error", "Complete all three ordered steps before testing images.");
  }

  const sessionToken = sessionRes.data.session?.access_token ?? process.env.ALMOSTCRACKD_API_TOKEN;
  if (!sessionToken) {
    await finish("error", "No REST API token was available for testing.");
  }

  const token = sessionToken as string;
  const results: TestResultSummary = {
    flavorId: flavor.id,
    flavorName: flavor.slug,
    runs: []
  };

  for (const file of files) {
    const result = await runPromptChainTest({
      file,
      token,
      baseUrl: process.env.ALMOSTCRACKD_API_BASE_URL ?? "https://api.almostcrackd.ai",
      flavor: {
        id: String(flavor.id),
        name: flavor.slug,
        description: flavor.description,
        created_at: "",
        updated_at: ""
      },
      steps: liveSteps.map((step) => ({
        id: String(step.id),
        flavor_id: String(step.humor_flavor_id),
        title: step.description ?? `Step ${step.order_by}`,
        instruction: [step.llm_system_prompt, step.llm_user_prompt].filter(Boolean).join("\n\n"),
        step_order: step.order_by,
        created_at: "",
        updated_at: ""
      }))
    });

    results.runs.push({
      fileName: file.name,
      imageId: result.imageId,
      captions: result.captions
    });
  }

  await finishWithResults("message", `Ran ${files.length} image test(s) for flavor ${flavor.slug}.`, results);
}

function messageValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export const dynamic = "force-dynamic";

export default async function AdminPageRoot({ searchParams }: { searchParams: SearchParams }) {
  const { supabase } = await requireAdmin();
  const [resolvedSearch, flavorsRes, stepsRes, captionsRes] = await Promise.all([
    searchParams,
    supabase.from("humor_flavors").select("id, slug, description, created_datetime_utc").order("id", { ascending: false }),
    supabase
      .from("humor_flavor_steps")
      .select(
        "id, humor_flavor_id, order_by, description, llm_system_prompt, llm_user_prompt, llm_temperature, llm_input_type_id, llm_output_type_id, llm_model_id, humor_flavor_step_type_id"
      )
      .order("humor_flavor_id", { ascending: true })
      .order("order_by", { ascending: true }),
    supabase
      .from("captions")
      .select("id, content, created_datetime_utc, image_id, humor_flavor_id, llm_prompt_chain_id")
      .order("created_datetime_utc", { ascending: false })
      .limit(120)
  ]);

  const error = flavorsRes.error || stepsRes.error || captionsRes.error;

  if (error) {
    return (
      <AdminPage
        eyebrow="Prompt Chain Tool"
        title="Humor Flavor Manager"
        description="Create, update, reorder, and test humor flavors against the REST API."
      >
        <AdminTableCard title="Load Error">
          <p>{error.message}</p>
        </AdminTableCard>
      </AdminPage>
    );
  }

  const flavors = (flavorsRes.data ?? []) as FlavorRow[];
  const steps = (stepsRes.data ?? []) as StepRow[];
  const captions = (captionsRes.data ?? []) as CaptionRow[];
  const message = messageValue(resolvedSearch.message);
  const actionError = messageValue(resolvedSearch.error);
  const rawTestResults = messageValue(resolvedSearch.testResults);
  let testResults: TestResultSummary | null = null;

  if (rawTestResults) {
    try {
      testResults = JSON.parse(rawTestResults) as TestResultSummary;
    } catch {
      testResults = null;
    }
  }

  const stepsByFlavor = new Map<number, StepRow[]>();
  const captionsByFlavor = new Map<number, CaptionRow[]>();

  for (const step of steps) {
    const bucket = stepsByFlavor.get(step.humor_flavor_id) ?? [];
    bucket.push(step);
    stepsByFlavor.set(step.humor_flavor_id, bucket);
  }

  for (const caption of captions) {
    if (!caption.humor_flavor_id) continue;
    const bucket = captionsByFlavor.get(caption.humor_flavor_id) ?? [];
    bucket.push(caption);
    captionsByFlavor.set(caption.humor_flavor_id, bucket);
  }

  return (
    <AdminPage
      eyebrow="Prompt Chain Tool"
      title="Humor Flavor Manager"
      description="This tool presents one fixed three-step caption flow and lets you test it with image uploads."
    >
      {message ? (
        <Card className="status-card success">
          <p>{message}</p>
        </Card>
      ) : null}
      {actionError ? (
        <Card className="status-card danger">
          <p>{actionError}</p>
        </Card>
      ) : null}
      <AdminTableCard
        title="Required Prompt Chain"
        description="Every humor flavor in this tool follows the same exact three-step structure."
      >
        <ol className="ordered-list">
          {STEP_TEMPLATES.map((step) => (
            <li key={step.order}>
              <strong>{step.title}:</strong> {step.guidance}
            </li>
          ))}
        </ol>
      </AdminTableCard>

      <AdminTableCard
        title="Create Humor Flavor"
        description="Create a humor flavor first. Then fill in the three required steps below."
      >
        <form action={createFlavor} className="form-grid">
          <Field label="Humor flavor name" hint="Stored in the existing humor_flavors.slug column.">
            <Input name="slug" placeholder="old-british-humor" required />
          </Field>
          <Field label="Description">
            <Textarea name="description" placeholder="Very witty humor with a bit of sarcasm." rows={4} />
          </Field>
          <SubmitButton idleLabel="Create Flavor" pendingLabel="Creating Flavor..." />
        </form>
      </AdminTableCard>

      <div className="image-list">
        {flavors.map((flavor) => {
          const flavorSteps = stepsByFlavor.get(flavor.id) ?? [];
          const flavorCaptions = captionsByFlavor.get(flavor.id) ?? [];
          const stepMap = new Map(flavorSteps.map((step) => [step.order_by, step]));
          const readyToTest = STEP_TEMPLATES.every((template) => {
            const step = stepMap.get(template.order);
            return Boolean(step?.llm_user_prompt?.trim());
          });

          return (
            <Card className="stack" key={flavor.id}>
              <div className="split">
                <div className="stack-tight">
                  <span className="eyebrow">Humor Flavor #{flavor.id}</span>
                  <h2>{flavor.slug}</h2>
                  <p>{flavor.description ?? "No description yet."}</p>
                  <small>
                    Created {flavor.created_datetime_utc ? new Date(flavor.created_datetime_utc).toLocaleString() : "-"}
                  </small>
                </div>
                <form action={deleteFlavor}>
                  <input name="id" type="hidden" value={flavor.id} />
                  <SubmitButton idleLabel="Delete Flavor" pendingLabel="Deleting..." variant="danger" />
                </form>
              </div>

              <form action={updateFlavor} className="form-grid-wide">
                <input name="id" type="hidden" value={flavor.id} />
                <Field label="Humor flavor name">
                  <Input defaultValue={flavor.slug} name="slug" required />
                </Field>
                <Field label="Description">
                  <Textarea defaultValue={flavor.description ?? ""} name="description" rows={3} />
                </Field>
                <SubmitButton idleLabel="Save Flavor" pendingLabel="Saving Flavor..." variant="secondary" />
              </form>

              <Card className="stack-tight">
                <span className="eyebrow">Generation Flow</span>
                <div className="flow-strip" aria-label="caption generation flow">
                  <span className="flow-chip">Upload image</span>
                  <span className="flow-arrow">→</span>
                  <span className="flow-chip">Step 1</span>
                  <span className="flow-arrow">→</span>
                  <span className="flow-chip">Step 2</span>
                  <span className="flow-arrow">→</span>
                  <span className="flow-chip">Step 3</span>
                  <span className="flow-arrow">→</span>
                  <span className="flow-chip">Generated captions</span>
                </div>
              </Card>

              <Card className="stack-tight">
                <span className="eyebrow">Strict Three-Step Flow</span>
                <p className="inline-hint">
                  You can only edit these three steps, in this order, and nothing else.
                </p>

                {STEP_TEMPLATES.map((template) => {
                  const step = stepMap.get(template.order);

                  return (
                    <Card className="stack-tight" key={`${flavor.id}-${template.order}`}>
                      <div className="stack-tight">
                        <span className="eyebrow">Step {template.order}</span>
                        <h3>{template.title}</h3>
                        <p>{template.guidance}</p>
                      </div>

                      <form action={saveStep} className="form-grid">
                        <input name="step_id" type="hidden" value={step?.id ?? ""} />
                        <input name="humor_flavor_id" type="hidden" value={flavor.id} />
                        <input name="order_by" type="hidden" value={template.order} />
                        <input name="title" type="hidden" value={template.title} />
                        <input name="guidance" type="hidden" value={template.guidance} />
                        <Field
                          label="Instruction"
                          hint="This is the exact instruction that will be sent as part of the prompt chain for this step."
                        >
                          <Textarea
                            defaultValue={step?.llm_user_prompt ?? template.defaultInstruction}
                            name="instruction"
                            placeholder={template.placeholder}
                            rows={4}
                          />
                        </Field>
                        <SubmitButton
                          idleLabel={step ? `Save Step ${template.order}` : `Create Step ${template.order}`}
                          pendingLabel={step ? `Saving Step ${template.order}...` : `Creating Step ${template.order}...`}
                          variant="secondary"
                        />
                      </form>
                      {step ? (
                        <form action={deleteStep}>
                          <input name="step_id" type="hidden" value={step.id} />
                          <input name="order_by" type="hidden" value={template.order} />
                          <SubmitButton idleLabel="Clear Step" pendingLabel="Clearing..." variant="ghost" />
                        </form>
                      ) : null}
                    </Card>
                  );
                })}
              </Card>

              <Card className="stack-tight">
                <span className="eyebrow">Test Humor Flavor</span>
                <form action={testFlavor} className="form-grid-wide">
                  <input name="humor_flavor_id" type="hidden" value={flavor.id} />
                  <Field
                    label="Image test set"
                    hint="Upload one or more images. Testing stays disabled until all three required steps are filled in."
                  >
                    <Input accept="image/*" multiple name="images" type="file" />
                  </Field>
                  <div className="stack-tight">
                    <SubmitButton
                      disabled={!readyToTest}
                      idleLabel="Generate Captions"
                      pendingLabel="Generating Captions..."
                    />
                    <p className="inline-hint">
                      {readyToTest
                        ? "All three steps are ready. You can now test this flavor with images."
                        : "Complete all three steps above before testing images."}
                    </p>
                  </div>
                </form>
              </Card>

              <Card className="stack-tight">
                <span className="eyebrow">Generated Captions</span>
                {(() => {
                  const latestTestCaptions: DisplayCaption[] =
                    testResults?.flavorId === flavor.id
                      ? testResults.runs.flatMap((run) =>
                          run.captions.map((caption, captionIndex) => ({
                            key: `latest-${run.imageId}-${captionIndex}`,
                            content: caption,
                            imageId: run.imageId,
                            promptChainId: "latest test",
                            created: `just now · ${run.fileName}`,
                            source: "latest-test" as const
                          }))
                        )
                      : [];

                  const storedCaptions: DisplayCaption[] = flavorCaptions.map((caption) => ({
                    key: caption.id,
                    content: caption.content ?? "-",
                    imageId: caption.image_id,
                    promptChainId: caption.llm_prompt_chain_id ? String(caption.llm_prompt_chain_id) : "-",
                    created: caption.created_datetime_utc
                      ? new Date(caption.created_datetime_utc).toLocaleString()
                      : "-",
                    source: "stored" as const
                  }));

                  const displayCaptions = [...latestTestCaptions, ...storedCaptions];

                  return displayCaptions.length === 0 ? <p>No captions recorded for this flavor yet.</p> : (
                    <div className="table-wrap">
                      <table>
                        <thead>
                          <tr>
                            <th>Caption</th>
                            <th>Image</th>
                            <th>Prompt Chain</th>
                            <th>Created</th>
                          </tr>
                        </thead>
                        <tbody>
                          {displayCaptions.map((caption) => (
                            <tr key={caption.key}>
                              <td>
                                {caption.content}
                                {caption.source === "latest-test" ? (
                                  <span className="caption-badge">Latest test</span>
                                ) : null}
                              </td>
                              <td>
                                <code>{caption.imageId}</code>
                              </td>
                              <td>{caption.promptChainId}</td>
                              <td>{caption.created}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  );
                })()}
              </Card>
            </Card>
          );
        })}
      </div>
    </AdminPage>
  );
}
