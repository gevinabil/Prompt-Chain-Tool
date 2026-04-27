import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { runPromptChainTest } from "@/lib/almostcrackd";
import { STEP_TEMPLATES } from "@/lib/flavor-wizard";

async function requireAdminSupabase() {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: NextResponse.json({ error: "Not authenticated" }, { status: 401 }) };
  }

  const { data: profile, error } = await supabase
    .from("profiles")
    .select("id, is_superadmin, is_matrix_admin")
    .eq("id", user.id)
    .single();

  if (error || !(profile?.is_superadmin || profile?.is_matrix_admin)) {
    return { error: NextResponse.json({ error: "Not authorized" }, { status: 403 }) };
  }

  return { supabase, user };
}

async function loadStepDefaults(supabase: Awaited<ReturnType<typeof createServerSupabaseClient>>) {
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

async function saveSteps(
  supabase: Awaited<ReturnType<typeof createServerSupabaseClient>>,
  humorFlavorId: number,
  instructions: Record<number, string>
) {
  const existingStepsRes = await supabase
    .from("humor_flavor_steps")
    .select("id, order_by")
    .eq("humor_flavor_id", humorFlavorId)
    .order("order_by", { ascending: true });

  if (existingStepsRes.error) {
    throw new Error(existingStepsRes.error.message);
  }

  const existingStepMap = new Map((existingStepsRes.data ?? []).map((step) => [step.order_by, step]));
  const defaults = await loadStepDefaults(supabase);

  for (const template of STEP_TEMPLATES) {
    const payload = {
      description: template.title,
      llm_system_prompt: template.guidance,
      llm_user_prompt: instructions[template.order] ?? template.defaultInstruction,
      llm_temperature: 0
    };
    const existingStep = existingStepMap.get(template.order);

    if (existingStep) {
      const { error } = await supabase.from("humor_flavor_steps").update(payload).eq("id", existingStep.id);
      if (error) throw new Error(error.message);
      continue;
    }

    const { error } = await supabase.from("humor_flavor_steps").insert({
      humor_flavor_id: humorFlavorId,
      order_by: template.order,
      ...payload,
      ...defaults
    });

    if (error) throw new Error(error.message);
  }
}

export async function POST(request: Request) {
  const auth = await requireAdminSupabase();
  if ("error" in auth) {
    return auth.error;
  }

  try {
    const { supabase } = auth;
    const formData = await request.formData();
    const mode = String(formData.get("mode") ?? "");
    const humorFlavorId = Number(formData.get("humor_flavor_id"));

    if (!humorFlavorId) {
      return NextResponse.json({ error: "Flavor id is required." }, { status: 400 });
    }

    const instructions = Object.fromEntries(
      STEP_TEMPLATES.map((template) => [template.order, String(formData.get(`step_${template.order}`) ?? "").trim()])
    ) as Record<number, string>;

    if (STEP_TEMPLATES.some((template) => !instructions[template.order])) {
      return NextResponse.json({ error: "Complete all three steps before continuing." }, { status: 400 });
    }

    await saveSteps(supabase, humorFlavorId, instructions);

    if (mode === "save") {
      return NextResponse.json({ message: "Prompt chain saved." });
    }

    if (mode !== "generate") {
      return NextResponse.json({ error: "Unsupported mode." }, { status: 400 });
    }

    const image = formData.get("image");
    if (!(image instanceof File) || image.size === 0) {
      return NextResponse.json({ error: "Upload an image before generating captions." }, { status: 400 });
    }

    const [flavorRes, sessionRes] = await Promise.all([
      supabase.from("humor_flavors").select("id, slug, description").eq("id", humorFlavorId).single(),
      supabase.auth.getSession()
    ]);

    if (flavorRes.error || !flavorRes.data) {
      return NextResponse.json({ error: flavorRes.error?.message ?? "Flavor not found." }, { status: 404 });
    }

    const token = sessionRes.data.session?.access_token ?? process.env.ALMOSTCRACKD_API_TOKEN;
    if (!token) {
      return NextResponse.json({ error: "No API token is available for testing." }, { status: 401 });
    }

    const result = await runPromptChainTest({
      file: image,
      token,
      baseUrl: process.env.ALMOSTCRACKD_API_BASE_URL ?? "https://api.almostcrackd.ai",
      flavor: {
        id: String(flavorRes.data.id),
        name: flavorRes.data.slug,
        description: flavorRes.data.description,
        created_at: "",
        updated_at: ""
      },
      steps: STEP_TEMPLATES.map((template) => ({
        id: `wizard-${template.order}`,
        flavor_id: String(humorFlavorId),
        title: template.title,
        instruction: instructions[template.order],
        step_order: template.order,
        created_at: "",
        updated_at: ""
      }))
    });

    return NextResponse.json({
      imageId: result.imageId,
      captions: result.captions
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unexpected server error." },
      { status: 500 }
    );
  }
}
