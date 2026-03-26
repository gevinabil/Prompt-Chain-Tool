import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { AdminPage, AdminTableCard } from "@/components/admin-data";
import { Button, Card, Field, Input, Select, Textarea } from "@/components/ui";
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

type OptionRow = {
  id: number;
  slug?: string | null;
  name?: string | null;
  description?: string | null;
};

function toAdminUrl(kind: "message" | "error", value: string) {
  return `/admin?${kind}=${encodeURIComponent(value)}`;
}

async function finish(kind: "message" | "error", value: string) {
  revalidatePath("/admin");
  redirect(toAdminUrl(kind, value));
}

async function createFlavor(formData: FormData) {
  "use server";

  const { supabase } = await requireAdmin();
  const slug = getString(formData, "slug");
  const description = getOptionalString(formData, "description");

  if (!slug) {
    await finish("error", "Flavor slug is required.");
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
    await finish("error", "Flavor id and slug are required.");
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

async function createStep(formData: FormData) {
  "use server";

  const { supabase } = await requireAdmin();
  const humorFlavorId = getNumber(formData, "humor_flavor_id");
  const description = getOptionalString(formData, "description");
  const llmSystemPrompt = getOptionalString(formData, "llm_system_prompt");
  const llmUserPrompt = getOptionalString(formData, "llm_user_prompt");
  const llmTemperature = getNumber(formData, "llm_temperature");
  const llmInputTypeId = getNumber(formData, "llm_input_type_id");
  const llmOutputTypeId = getNumber(formData, "llm_output_type_id");
  const llmModelId = getNumber(formData, "llm_model_id");
  const humorFlavorStepTypeId = getNumber(formData, "humor_flavor_step_type_id");

  if (!humorFlavorId || !llmInputTypeId || !llmOutputTypeId || !llmModelId || !humorFlavorStepTypeId) {
    await finish("error", "All step configuration fields are required.");
  }

  const { data: lastStep } = await supabase
    .from("humor_flavor_steps")
    .select("order_by")
    .eq("humor_flavor_id", humorFlavorId)
    .order("order_by", { ascending: false })
    .limit(1)
    .maybeSingle();

  const orderBy = Number(lastStep?.order_by ?? 0) + 1;

  const { error } = await supabase.from("humor_flavor_steps").insert({
    humor_flavor_id: humorFlavorId,
    order_by: orderBy,
    description,
    llm_system_prompt: llmSystemPrompt,
    llm_user_prompt: llmUserPrompt,
    llm_temperature: llmTemperature,
    llm_input_type_id: llmInputTypeId,
    llm_output_type_id: llmOutputTypeId,
    llm_model_id: llmModelId,
    humor_flavor_step_type_id: humorFlavorStepTypeId
  });

  if (error) {
    await finish("error", error.message);
  }

  await finish("message", `Step added to flavor ${humorFlavorId}.`);
}

async function updateStep(formData: FormData) {
  "use server";

  const { supabase } = await requireAdmin();
  const id = getNumber(formData, "id");
  const description = getOptionalString(formData, "description");
  const llmSystemPrompt = getOptionalString(formData, "llm_system_prompt");
  const llmUserPrompt = getOptionalString(formData, "llm_user_prompt");
  const llmTemperature = getNumber(formData, "llm_temperature");
  const llmInputTypeId = getNumber(formData, "llm_input_type_id");
  const llmOutputTypeId = getNumber(formData, "llm_output_type_id");
  const llmModelId = getNumber(formData, "llm_model_id");
  const humorFlavorStepTypeId = getNumber(formData, "humor_flavor_step_type_id");

  if (!id || !llmInputTypeId || !llmOutputTypeId || !llmModelId || !humorFlavorStepTypeId) {
    await finish("error", "Step id and configuration are required.");
  }

  const { error } = await supabase
    .from("humor_flavor_steps")
    .update({
      description,
      llm_system_prompt: llmSystemPrompt,
      llm_user_prompt: llmUserPrompt,
      llm_temperature: llmTemperature,
      llm_input_type_id: llmInputTypeId,
      llm_output_type_id: llmOutputTypeId,
      llm_model_id: llmModelId,
      humor_flavor_step_type_id: humorFlavorStepTypeId
    })
    .eq("id", id);

  if (error) {
    await finish("error", error.message);
  }

  await finish("message", `Step ${id} updated.`);
}

async function deleteStep(formData: FormData) {
  "use server";

  const { supabase } = await requireAdmin();
  const id = getNumber(formData, "id");
  const humorFlavorId = getNumber(formData, "humor_flavor_id");

  if (!id || !humorFlavorId) {
    await finish("error", "Step id and flavor id are required.");
  }

  const { error } = await supabase.from("humor_flavor_steps").delete().eq("id", id);
  if (error) {
    await finish("error", error.message);
  }

  const { data: remaining } = await supabase
    .from("humor_flavor_steps")
    .select("id")
    .eq("humor_flavor_id", humorFlavorId)
    .order("order_by", { ascending: true });

  for (const [index, row] of (remaining ?? []).entries()) {
    await supabase.from("humor_flavor_steps").update({ order_by: index + 1 }).eq("id", row.id);
  }

  await finish("message", `Step ${id} deleted.`);
}

async function moveStep(formData: FormData) {
  "use server";

  const { supabase } = await requireAdmin();
  const id = getNumber(formData, "id");
  const humorFlavorId = getNumber(formData, "humor_flavor_id");
  const direction = getString(formData, "direction");

  if (!id || !humorFlavorId || !direction) {
    await finish("error", "Step move payload is incomplete.");
  }

  const { data: steps, error } = await supabase
    .from("humor_flavor_steps")
    .select("id, order_by")
    .eq("humor_flavor_id", humorFlavorId)
    .order("order_by", { ascending: true });

  if (error) {
    await finish("error", error.message);
  }

  const rows = (steps ?? []) as Array<{ id: number; order_by: number }>;
  const index = rows.findIndex((row) => row.id === id);
  const targetIndex = direction === "up" ? index - 1 : index + 1;

  if (index < 0 || targetIndex < 0 || targetIndex >= rows.length) {
    await finish("message", "Step order unchanged.");
  }

  const current = rows[index];
  const target = rows[targetIndex];

  await supabase.from("humor_flavor_steps").update({ order_by: -1 }).eq("id", current.id);
  await supabase.from("humor_flavor_steps").update({ order_by: current.order_by }).eq("id", target.id);
  await supabase.from("humor_flavor_steps").update({ order_by: target.order_by }).eq("id", current.id);

  await finish("message", `Step ${id} moved ${direction}.`);
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
      .select(
        "id, humor_flavor_id, order_by, description, llm_system_prompt, llm_user_prompt, llm_temperature, llm_input_type_id, llm_output_type_id, llm_model_id, humor_flavor_step_type_id"
      )
      .eq("humor_flavor_id", humorFlavorId)
      .order("order_by", { ascending: true }),
    supabase.auth.getSession()
  ]);

  if (flavorRes.error || !flavorRes.data) {
    await finish("error", flavorRes.error?.message ?? "Flavor not found.");
  }
  const flavor = flavorRes.data as { id: number; slug: string; description: string | null };

  if (stepsRes.error) {
    await finish("error", stepsRes.error.message);
  }

  const sessionToken = sessionRes.data.session?.access_token ?? process.env.ALMOSTCRACKD_API_TOKEN;
  if (!sessionToken) {
    await finish("error", "No REST API token was available for testing.");
  }
  const token = sessionToken as string;

  for (const file of files) {
    await runPromptChainTest({
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
      steps: ((stepsRes.data ?? []) as StepRow[]).map((step) => ({
        id: String(step.id),
        flavor_id: String(step.humor_flavor_id),
        title: step.description ?? `Step ${step.order_by}`,
        instruction: [step.llm_system_prompt, step.llm_user_prompt].filter(Boolean).join("\n\n"),
        step_order: step.order_by,
        created_at: "",
        updated_at: ""
      }))
    });
  }

  await finish("message", `Ran ${files.length} image test(s) for flavor ${flavor.slug}.`);
}

function messageValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function optionLabel(row: OptionRow) {
  return row.slug ?? row.name ?? row.description ?? String(row.id);
}

export const dynamic = "force-dynamic";

export default async function AdminPageRoot({ searchParams }: { searchParams: SearchParams }) {
  const { supabase } = await requireAdmin();
  const [resolvedSearch, flavorsRes, stepsRes, captionsRes, inputTypesRes, outputTypesRes, stepTypesRes, modelsRes] =
    await Promise.all([
      searchParams,
      supabase.from("humor_flavors").select("id, slug, description, created_datetime_utc").order("id", { ascending: true }),
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
        .limit(120),
      supabase.from("llm_input_types").select("id, slug, description"),
      supabase.from("llm_output_types").select("id, slug, description"),
      supabase.from("humor_flavor_step_types").select("id, slug, description"),
      supabase.from("llm_models").select("id, name")
    ]);

  const error =
    flavorsRes.error ||
    stepsRes.error ||
    captionsRes.error ||
    inputTypesRes.error ||
    outputTypesRes.error ||
    stepTypesRes.error ||
    modelsRes.error;

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
  const inputTypes = (inputTypesRes.data ?? []) as OptionRow[];
  const outputTypes = (outputTypesRes.data ?? []) as OptionRow[];
  const stepTypes = (stepTypesRes.data ?? []) as OptionRow[];
  const models = (modelsRes.data ?? []) as OptionRow[];
  const message = messageValue(resolvedSearch.message);
  const actionError = messageValue(resolvedSearch.error);
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
      description="This tool only manages humor flavors, ordered steps, generated captions, and image test runs."
    >
      {message ? <Card className="status-card success"><p>{message}</p></Card> : null}
      {actionError ? <Card className="status-card danger"><p>{actionError}</p></Card> : null}

      <AdminTableCard
        title="Prompt Chain Goal"
        description="A humor flavor is a sequence of steps that transforms an image into captions."
      >
        <div className="stack-tight">
          <p>Example chain:</p>
          <ol className="ordered-list">
            <li>Describe the image in text.</li>
            <li>Take that description and produce something funny about it.</li>
            <li>Turn the joke into five short captions.</li>
          </ol>
        </div>
      </AdminTableCard>

      <AdminTableCard
        title="Create Humor Flavor"
        description="Create a new humor flavor definition before adding ordered steps."
      >
        <form action={createFlavor} className="form-grid">
          <Field label="Humor flavor name" hint="Stored in the existing humor_flavors.slug column.">
            <Input name="slug" placeholder="mean-understated" required />
          </Field>
          <Field label="Description">
            <Textarea name="description" placeholder="Uncomfortable jokes delivered with a calm tone." rows={4} />
          </Field>
          <Button type="submit">Create Flavor</Button>
        </form>
      </AdminTableCard>

      <div className="image-list">
        {flavors.map((flavor) => {
          const flavorSteps = stepsByFlavor.get(flavor.id) ?? [];
          const flavorCaptions = captionsByFlavor.get(flavor.id) ?? [];

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
                  <Button type="submit" variant="danger">
                    Delete Flavor
                  </Button>
                </form>
              </div>

              <form action={updateFlavor} className="form-grid-wide">
                <input name="id" type="hidden" value={flavor.id} />
                <Field label="Humor flavor name" hint="Stored in humor_flavors.slug.">
                  <Input defaultValue={flavor.slug} name="slug" required />
                </Field>
                <Field label="Description">
                  <Textarea defaultValue={flavor.description ?? ""} name="description" rows={3} />
                </Field>
                <Button type="submit" variant="secondary">
                  Save Flavor
                </Button>
              </form>

              <Card className="stack-tight">
                <span className="eyebrow">Test Humor Flavor</span>
                <form action={testFlavor} className="form-grid-wide">
                  <input name="humor_flavor_id" type="hidden" value={flavor.id} />
                  <Field label="Image test set" hint="Upload one or more images to generate captions using this humor flavor.">
                    <Input accept="image/*" multiple name="images" type="file" />
                  </Field>
                  <Button type="submit">Generate Captions</Button>
                </form>
              </Card>

              <div className="stack">
                <div className="split">
                  <div className="stack-tight">
                    <span className="eyebrow">Ordered Steps</span>
                    <h3>{flavorSteps.length} step{flavorSteps.length === 1 ? "" : "s"}</h3>
                  </div>
                </div>

                {flavorSteps.map((step) => (
                  <Card className="stack-tight" key={step.id}>
                    <div className="split">
                      <span className="eyebrow">Step {step.order_by}</span>
                      <div className="cluster">
                        <form action={moveStep}>
                          <input name="id" type="hidden" value={step.id} />
                          <input name="humor_flavor_id" type="hidden" value={flavor.id} />
                          <input name="direction" type="hidden" value="up" />
                          <Button type="submit" variant="ghost">
                            Up
                          </Button>
                        </form>
                        <form action={moveStep}>
                          <input name="id" type="hidden" value={step.id} />
                          <input name="humor_flavor_id" type="hidden" value={flavor.id} />
                          <input name="direction" type="hidden" value="down" />
                          <Button type="submit" variant="ghost">
                            Down
                          </Button>
                        </form>
                        <form action={deleteStep}>
                          <input name="id" type="hidden" value={step.id} />
                          <input name="humor_flavor_id" type="hidden" value={flavor.id} />
                          <Button type="submit" variant="danger">
                            Delete
                          </Button>
                        </form>
                      </div>
                    </div>

                    <form action={updateStep} className="form-grid-wide">
                      <input name="id" type="hidden" value={step.id} />
                      <Field label="Step description">
                        <Input defaultValue={step.description ?? ""} name="description" />
                      </Field>
                      <Field label="Step type">
                        <Select defaultValue={String(step.humor_flavor_step_type_id)} name="humor_flavor_step_type_id">
                          {stepTypes.map((row) => (
                            <option key={row.id} value={row.id}>
                              {optionLabel(row)}
                            </option>
                          ))}
                        </Select>
                      </Field>
                      <Field label="Input type">
                        <Select defaultValue={String(step.llm_input_type_id)} name="llm_input_type_id">
                          {inputTypes.map((row) => (
                            <option key={row.id} value={row.id}>
                              {optionLabel(row)}
                            </option>
                          ))}
                        </Select>
                      </Field>
                      <Field label="Output type">
                        <Select defaultValue={String(step.llm_output_type_id)} name="llm_output_type_id">
                          {outputTypes.map((row) => (
                            <option key={row.id} value={row.id}>
                              {optionLabel(row)}
                            </option>
                          ))}
                        </Select>
                      </Field>
                      <Field label="Model">
                        <Select defaultValue={String(step.llm_model_id)} name="llm_model_id">
                          {models.map((row) => (
                            <option key={row.id} value={row.id}>
                              {optionLabel(row)}
                            </option>
                          ))}
                        </Select>
                      </Field>
                      <Field label="Temperature">
                        <Input defaultValue={step.llm_temperature ?? 0} name="llm_temperature" step="0.1" type="number" />
                      </Field>
                      <Field label="System prompt">
                        <Textarea defaultValue={step.llm_system_prompt ?? ""} name="llm_system_prompt" rows={4} />
                      </Field>
                      <Field label="User prompt">
                        <Textarea defaultValue={step.llm_user_prompt ?? ""} name="llm_user_prompt" rows={4} />
                      </Field>
                      <Button type="submit" variant="secondary">
                        Save Step
                      </Button>
                    </form>
                  </Card>
                ))}

                <Card className="stack-tight">
                  <span className="eyebrow">Add Step</span>
                  <form action={createStep} className="form-grid-wide">
                    <input name="humor_flavor_id" type="hidden" value={flavor.id} />
                    <Field label="Step description">
                      <Input name="description" placeholder="Describe the image in text." />
                    </Field>
                    <Field label="Step type">
                      <Select name="humor_flavor_step_type_id">
                        {stepTypes.map((row) => (
                          <option key={row.id} value={row.id}>
                            {optionLabel(row)}
                          </option>
                        ))}
                      </Select>
                    </Field>
                    <Field label="Input type">
                      <Select name="llm_input_type_id">
                        {inputTypes.map((row) => (
                          <option key={row.id} value={row.id}>
                            {optionLabel(row)}
                          </option>
                        ))}
                      </Select>
                    </Field>
                    <Field label="Output type">
                      <Select name="llm_output_type_id">
                        {outputTypes.map((row) => (
                          <option key={row.id} value={row.id}>
                            {optionLabel(row)}
                          </option>
                        ))}
                      </Select>
                    </Field>
                    <Field label="Model">
                      <Select name="llm_model_id">
                        {models.map((row) => (
                          <option key={row.id} value={row.id}>
                            {optionLabel(row)}
                          </option>
                        ))}
                      </Select>
                    </Field>
                    <Field label="Temperature">
                      <Input defaultValue="0" name="llm_temperature" step="0.1" type="number" />
                    </Field>
                    <Field label="System prompt">
                      <Textarea name="llm_system_prompt" rows={4} />
                    </Field>
                    <Field label="User prompt">
                      <Textarea name="llm_user_prompt" rows={4} />
                    </Field>
                    <Button type="submit">Create Step</Button>
                  </form>
                </Card>
              </div>

              <Card className="stack-tight">
                <span className="eyebrow">Generated Captions</span>
                {flavorCaptions.length === 0 ? <p>No captions recorded for this flavor yet.</p> : null}
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
                      {flavorCaptions.map((caption) => (
                        <tr key={caption.id}>
                          <td>{caption.content ?? "-"}</td>
                          <td>
                            <code>{caption.image_id}</code>
                          </td>
                          <td>{caption.llm_prompt_chain_id ?? "-"}</td>
                          <td>
                            {caption.created_datetime_utc
                              ? new Date(caption.created_datetime_utc).toLocaleString()
                              : "-"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Card>
            </Card>
          );
        })}
      </div>
    </AdminPage>
  );
}
