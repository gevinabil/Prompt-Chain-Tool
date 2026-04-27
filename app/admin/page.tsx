import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { AdminPage, AdminTableCard } from "@/components/admin-data";
import { FlavorStudio } from "@/components/flavor-studio";
import { Card, Field, Input, Textarea } from "@/components/ui";
import { SubmitButton } from "@/components/submit-button";
import { requireAdmin } from "@/lib/auth/guards";
import { getNumber, getOptionalString, getString } from "@/lib/forms";
import { STEP_TEMPLATES } from "@/lib/flavor-wizard";

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

function toAdminUrl(kind: "message" | "error", value: string) {
  return `/admin?${kind}=${encodeURIComponent(value)}`;
}

async function finish(kind: "message" | "error", value: string) {
  revalidatePath("/admin");
  redirect(toAdminUrl(kind, value));
}

function invariant<T>(value: T | null | undefined, message: string): T {
  if (value == null) {
    throw new Error(message);
  }

  return value;
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

async function duplicateFlavor(formData: FormData) {
  "use server";

  const { supabase } = await requireAdmin();
  const sourceFlavorId = getNumber(formData, "source_flavor_id");
  const newSlug = getString(formData, "new_slug");

  if (!sourceFlavorId || !newSlug) {
    await finish("error", "Pick a flavor and provide a new unique name.");
  }

  const [sourceFlavorRes, sourceStepsRes, existingFlavorRes] = await Promise.all([
    supabase.from("humor_flavors").select("id, slug, description").eq("id", sourceFlavorId).single(),
    supabase
      .from("humor_flavor_steps")
      .select(
        "order_by, description, llm_system_prompt, llm_user_prompt, llm_temperature, llm_input_type_id, llm_output_type_id, llm_model_id, humor_flavor_step_type_id"
      )
      .eq("humor_flavor_id", sourceFlavorId)
      .order("order_by", { ascending: true }),
    supabase.from("humor_flavors").select("id").eq("slug", newSlug).maybeSingle()
  ]);

  if (sourceFlavorRes.error || !sourceFlavorRes.data) {
    await finish("error", sourceFlavorRes.error?.message ?? "Source flavor not found.");
  }

  if (sourceStepsRes.error) {
    await finish("error", sourceStepsRes.error.message);
  }

  if (existingFlavorRes.error) {
    await finish("error", existingFlavorRes.error.message);
  }

  if (existingFlavorRes.data) {
    await finish("error", `A humor flavor named "${newSlug}" already exists. Choose a unique name.`);
  }

  const sourceFlavor = sourceFlavorRes.data as Pick<FlavorRow, "slug" | "description">;
  const sourceSteps = sourceStepsRes.data ?? [];
  const duplicateDescription = sourceFlavor.description
    ? `${sourceFlavor.description}\n\nDuplicated from ${sourceFlavor.slug}.`
    : `Duplicated from ${sourceFlavor.slug}.`;

  const createdFlavorRes = await supabase
    .from("humor_flavors")
    .insert({ slug: newSlug, description: duplicateDescription })
    .select("id")
    .single();

  if (createdFlavorRes.error || !createdFlavorRes.data) {
    await finish("error", createdFlavorRes.error?.message ?? "Could not create duplicated flavor.");
  }

  const duplicatedFlavor = invariant(createdFlavorRes.data, "Could not create duplicated flavor.");
  const duplicatedFlavorId = duplicatedFlavor.id;

  if (sourceSteps.length > 0) {
    const stepPayload = sourceSteps.map((step) => ({
      humor_flavor_id: duplicatedFlavorId,
      order_by: step.order_by,
      description: step.description,
      llm_system_prompt: step.llm_system_prompt,
      llm_user_prompt: step.llm_user_prompt,
      llm_temperature: step.llm_temperature,
      llm_input_type_id: step.llm_input_type_id,
      llm_output_type_id: step.llm_output_type_id,
      llm_model_id: step.llm_model_id,
      humor_flavor_step_type_id: step.humor_flavor_step_type_id
    }));

    const { error } = await supabase.from("humor_flavor_steps").insert(stepPayload);
    if (error) {
      await finish("error", error.message);
    }
  }

  await finish("message", `Created duplicate flavor "${newSlug}" with ${sourceSteps.length} copied step(s).`);
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

function messageValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function getSelectedFlavorId(value: string | string[] | undefined) {
  const resolved = messageValue(value);
  if (!resolved) return null;

  const parsed = Number(resolved);
  return Number.isFinite(parsed) ? parsed : null;
}

export const dynamic = "force-dynamic";

export default async function AdminPageRoot({ searchParams }: { searchParams: SearchParams }) {
  const { supabase } = await requireAdmin();
  const [resolvedSearch, flavorsRes] = await Promise.all([
    searchParams,
    supabase
      .from("humor_flavors")
      .select("id, slug, description, created_datetime_utc")
      .order("created_datetime_utc", { ascending: false })
      .order("id", { ascending: false })
  ]);

  const error = flavorsRes.error;

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

  const flavors = [...((flavorsRes.data ?? []) as FlavorRow[])].sort((left, right) => {
    const leftTime = left.created_datetime_utc ? new Date(left.created_datetime_utc).getTime() : 0;
    const rightTime = right.created_datetime_utc ? new Date(right.created_datetime_utc).getTime() : 0;

    if (rightTime !== leftTime) return rightTime - leftTime;
    return right.id - left.id;
  });
  const message = messageValue(resolvedSearch.message);
  const actionError = messageValue(resolvedSearch.error);
  const requestedFlavorId = getSelectedFlavorId(resolvedSearch.flavor);

  const selectedFlavor =
    flavors.find((flavor) => flavor.id === requestedFlavorId) ??
    flavors[0] ??
    null;

  const [selectedStepsRes, selectedCaptionsRes] = selectedFlavor
    ? await Promise.all([
        supabase
          .from("humor_flavor_steps")
          .select(
            "id, humor_flavor_id, order_by, description, llm_system_prompt, llm_user_prompt, llm_temperature, llm_input_type_id, llm_output_type_id, llm_model_id, humor_flavor_step_type_id"
          )
          .eq("humor_flavor_id", selectedFlavor.id)
          .order("order_by", { ascending: true }),
        supabase
          .from("captions")
          .select("id, content, created_datetime_utc, image_id, humor_flavor_id, llm_prompt_chain_id")
          .eq("humor_flavor_id", selectedFlavor.id)
          .order("created_datetime_utc", { ascending: false })
          .limit(20)
      ])
    : [null, null];

  const selectedError = selectedStepsRes?.error || selectedCaptionsRes?.error;

  if (selectedError) {
    return (
      <AdminPage
        eyebrow="Prompt Chain Tool"
        title="Humor Flavor Manager"
        description="Create, update, reorder, and test humor flavors against the REST API."
      >
        <AdminTableCard title="Load Error">
          <p>{selectedError.message}</p>
        </AdminTableCard>
      </AdminPage>
    );
  }

  const selectedSteps = (selectedStepsRes?.data ?? []) as StepRow[];
  const selectedCaptions = (selectedCaptionsRes?.data ?? []) as CaptionRow[];

  return (
    <AdminPage
      eyebrow="Prompt Chain Tool"
      title="Humor Flavor Manager"
      description="Create, duplicate, refine, and test humor flavors with a fixed three-step prompt chain."
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
        <form action={createFlavor} className="form-grid spotlight-form">
          <Field label="Humor flavor name" hint="Stored in the existing humor_flavors.slug column.">
            <Input name="slug" placeholder="old-british-humor" required />
          </Field>
          <Field label="Description">
            <Textarea name="description" placeholder="Very witty humor with a bit of sarcasm." rows={4} />
          </Field>
          <SubmitButton idleLabel="Create Flavor" pendingLabel="Creating Flavor..." />
        </form>
      </AdminTableCard>

      {flavors.length === 0 ? (
        <AdminTableCard
          title="Start Here"
          description="The simplest flow is create a flavor, fill the three required steps, then test with images."
        >
          <div className="empty-guide stack-tight">
            <p>1. Create a humor flavor with a name and short description.</p>
            <p>2. Fill in the three required prompt steps.</p>
            <p>3. Upload images and generate captions to see the result.</p>
          </div>
        </AdminTableCard>
      ) : null}

      <div className="admin-workspace">
        <AdminTableCard
          title="Flavor Library"
          description="Pick one flavor to edit. New flavors appear at the top automatically."
        >
          {flavors.length === 0 ? (
            <p>No flavors yet.</p>
          ) : (
            <div className="flavor-selector-grid">
              {flavors.map((flavor) => {
                const isSelected = selectedFlavor?.id === flavor.id;
                const selectorHref = `/admin?flavor=${flavor.id}`;

                return (
                  <a
                    className={isSelected ? "flavor-selector is-selected" : "flavor-selector"}
                    href={selectorHref}
                    key={flavor.id}
                  >
                    <span className="flavor-selector-title">{flavor.slug}</span>
                    <span className="flavor-selector-meta">
                      {flavor.created_datetime_utc ? new Date(flavor.created_datetime_utc).toLocaleDateString() : "No date"}
                    </span>
                  </a>
                );
              })}
            </div>
          )}
        </AdminTableCard>

        <div className="image-list">
        {selectedFlavor ? (() => {
          const flavor = selectedFlavor;
          const flavorSteps = selectedSteps;
          const flavorCaptions = selectedCaptions;
          const stepMap = new Map(flavorSteps.map((step) => [step.order_by, step]));

          return (
            <Card className="stack flavor-card" key={flavor.id}>
              <div className="flavor-header split">
                <div className="stack-tight flavor-header-copy">
                  <span className="eyebrow">Humor Flavor #{flavor.id}</span>
                  <h2>{flavor.slug}</h2>
                  <p>{flavor.description ?? "No description yet."}</p>
                  <div className="cluster flavor-meta">
                    <small>
                      Created {flavor.created_datetime_utc ? new Date(flavor.created_datetime_utc).toLocaleString() : "-"}
                    </small>
                    <span
                      className={`status-pill ${
                        STEP_TEMPLATES.every((template) => Boolean(stepMap.get(template.order)?.llm_user_prompt?.trim()))
                          ? "is-ready"
                          : "is-draft"
                      }`}
                    >
                      {STEP_TEMPLATES.every((template) => Boolean(stepMap.get(template.order)?.llm_user_prompt?.trim()))
                        ? "Ready to test"
                        : "Needs setup"}
                    </span>
                  </div>
                </div>
                <div className="cluster flavor-actions">
                  <form action={deleteFlavor}>
                    <input name="id" type="hidden" value={flavor.id} />
                    <SubmitButton idleLabel="Delete Flavor" pendingLabel="Deleting..." variant="danger" />
                  </form>
                </div>
              </div>

              <div className="editor-grid">
                <Card className="stack-tight gloss-panel">
                  <span className="eyebrow">Flavor Details</span>
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
                </Card>

                <Card className="stack-tight gloss-panel">
                  <span className="eyebrow">Duplicate Flavor</span>
                  <p className="inline-hint">
                    Clone this flavor and all three ordered steps into a new flavor with a unique name.
                  </p>
                  <form action={duplicateFlavor} className="form-grid-wide">
                    <input name="source_flavor_id" type="hidden" value={flavor.id} />
                    <Field
                      label="New flavor name"
                      hint={`Example: ${flavor.slug}-copy or ${flavor.slug}-v2`}
                    >
                      <Input defaultValue={`${flavor.slug}-copy`} name="new_slug" required />
                    </Field>
                    <SubmitButton
                      idleLabel="Duplicate Flavor"
                      pendingLabel="Duplicating Flavor..."
                      variant="primary"
                    />
                  </form>
                </Card>
              </div>

              <FlavorStudio
                flavorName={flavor.slug}
                humorFlavorId={flavor.id}
                initialInstructions={Object.fromEntries(
                  STEP_TEMPLATES.map((template) => [
                    template.order,
                    stepMap.get(template.order)?.llm_user_prompt ?? template.defaultInstruction
                  ])
                )}
                storedCaptions={flavorCaptions.map((caption) => ({
                  key: caption.id,
                  content: caption.content ?? "-",
                  imageId: caption.image_id,
                  promptChainId: caption.llm_prompt_chain_id ? String(caption.llm_prompt_chain_id) : "-",
                  created: caption.created_datetime_utc ? new Date(caption.created_datetime_utc).toLocaleString() : "-"
                }))}
              />
            </Card>
          );
        })() : null}
        </div>
      </div>
    </AdminPage>
  );
}
