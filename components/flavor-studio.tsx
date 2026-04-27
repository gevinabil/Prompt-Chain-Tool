"use client";

import { useEffect, useMemo, useState } from "react";
import { Button, Card, Textarea } from "@/components/ui";
import { STEP_TEMPLATES } from "@/lib/flavor-wizard";

type StoredCaption = {
  key: string;
  content: string;
  imageId: string;
  promptChainId: string;
  created: string;
};

type FlavorStudioProps = {
  humorFlavorId: number;
  flavorName: string;
  initialInstructions: Record<number, string>;
  storedCaptions: StoredCaption[];
};

type GeneratedResult = {
  imageId: string;
  captions: string[];
};

export function FlavorStudio({
  humorFlavorId,
  flavorName,
  initialInstructions,
  storedCaptions
}: FlavorStudioProps) {
  const [activeStep, setActiveStep] = useState(0);
  const [file, setFile] = useState<File | null>(null);
  const [instructions, setInstructions] = useState<Record<number, string>>(initialInstructions);
  const [working, setWorking] = useState<"idle" | "saving" | "generating">("idle");
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [generated, setGenerated] = useState<GeneratedResult | null>(null);

  const previewUrl = useMemo(() => (file ? URL.createObjectURL(file) : null), [file]);

  useEffect(() => {
    return () => {
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
      }
    };
  }, [previewUrl]);

  async function submit(mode: "save" | "generate") {
    setWorking(mode === "save" ? "saving" : "generating");
    setSaveMessage(null);
    setError(null);

    const formData = new FormData();
    formData.set("mode", mode);
    formData.set("humor_flavor_id", String(humorFlavorId));

    for (const template of STEP_TEMPLATES) {
      formData.set(`step_${template.order}`, instructions[template.order] ?? "");
    }

    if (mode === "generate") {
      if (!file) {
        setError("Upload an image before generating captions.");
        setWorking("idle");
        return;
      }

      formData.set("image", file);
    }

    const response = await fetch("/api/flavor-studio", {
      method: "POST",
      body: formData
    });

    const json = (await response.json()) as {
      error?: string;
      message?: string;
      imageId?: string;
      captions?: string[];
    };

    if (!response.ok) {
      setError(json.error ?? "Something went wrong.");
      setWorking("idle");
      return;
    }

    if (mode === "save") {
      setSaveMessage(json.message ?? "Prompt chain saved.");
      setWorking("idle");
      return;
    }

    setGenerated({
      imageId: json.imageId ?? "",
      captions: json.captions ?? []
    });
    setActiveStep(4);
    setWorking("idle");
  }

  const stepMeta = [
    { label: "Add Image", title: "Add your image" },
    { label: "Step 1", title: "Describe the image" },
    { label: "Step 2", title: "Make it funny" },
    { label: "Step 3", title: "Write five captions" },
    { label: "Results", title: "Generated captions" }
  ];

  return (
    <Card className="stack-tight studio-card">
      <div className="split">
        <div className="stack-tight">
          <span className="eyebrow">Guided Studio</span>
          <h3>{flavorName}</h3>
          <p className="inline-hint">Move through one square panel at a time instead of editing everything at once.</p>
        </div>
        <div className="studio-progress" aria-label="Studio steps">
          {stepMeta.map((step, index) => (
            <span
              className={index === activeStep ? "studio-progress-chip is-active" : "studio-progress-chip"}
              key={step.label}
            >
              {step.label}
            </span>
          ))}
        </div>
      </div>

      {saveMessage ? (
        <div className="workflow-callout">
          <p>{saveMessage}</p>
        </div>
      ) : null}
      {error ? (
        <div className="workflow-callout studio-error">
          <p>{error}</p>
        </div>
      ) : null}

      <div className="studio-bubble">
        {activeStep === 0 ? (
          <div className="stack studio-panel">
            <div className="stack-tight">
              <span className="eyebrow">Step 1</span>
              <h2>{stepMeta[0].title}</h2>
              <p>Choose an image first. As soon as it is attached, the studio moves to the next step.</p>
            </div>
            <label className="studio-upload">
              <span className="studio-upload-copy">Select image</span>
              <input
                accept="image/*"
                className="sr-only"
                onChange={(event) => {
                  const nextFile = event.target.files?.[0] ?? null;
                  setFile(nextFile);
                  setGenerated(null);
                  setError(null);
                  if (nextFile) {
                    setActiveStep(1);
                  }
                }}
                type="file"
              />
            </label>
          </div>
        ) : null}

        {activeStep > 0 && activeStep < 4 ? (
          <div className="studio-grid">
            <div className="studio-preview">
              {previewUrl ? (
                <img alt="Uploaded preview" className="studio-preview-image" src={previewUrl} />
              ) : (
                <div className="empty-guide">
                  <p>No image selected.</p>
                </div>
              )}
            </div>
            <div className="stack studio-panel">
              {(() => {
                const template = STEP_TEMPLATES[activeStep - 1];
                return (
                  <>
                    <div className="stack-tight">
                      <span className="eyebrow">Step {template.order}</span>
                      <h2>{template.title}</h2>
                      <p>{template.guidance}</p>
                    </div>
                    <Textarea
                      onChange={(event) =>
                        setInstructions((current) => ({
                          ...current,
                          [template.order]: event.target.value
                        }))
                      }
                      rows={8}
                      value={instructions[template.order] ?? template.defaultInstruction}
                    />
                    <div className="split">
                      <div className="cluster">
                        <Button onClick={() => setActiveStep((current) => Math.max(0, current - 1))} variant="ghost">
                          Back
                        </Button>
                        <Button
                          onClick={() => submit("save")}
                          disabled={working !== "idle"}
                          variant="secondary"
                        >
                          {working === "saving" ? <span aria-hidden="true" className="btn-spinner" /> : null}
                          {working === "saving" ? "Saving..." : "Save current prompts"}
                        </Button>
                      </div>

                      {activeStep < 3 ? (
                        <Button onClick={() => setActiveStep((current) => current + 1)} variant="primary">
                          Continue
                        </Button>
                      ) : (
                        <Button
                          onClick={() => submit("generate")}
                          disabled={working !== "idle"}
                          variant="primary"
                        >
                          {working === "generating" ? <span aria-hidden="true" className="btn-spinner" /> : null}
                          {working === "generating" ? "Generating..." : "Generate captions"}
                        </Button>
                      )}
                    </div>
                  </>
                );
              })()}
            </div>
          </div>
        ) : null}

        {activeStep === 4 ? (
          <div className="stack studio-panel">
            <div className="stack-tight">
              <span className="eyebrow">Step 4</span>
              <h2>{stepMeta[4].title}</h2>
              <p>The system used your current three-step chain and the uploaded image to generate captions.</p>
            </div>

            {generated?.captions?.length ? (
              <div className="stack-tight">
                {generated.captions.map((caption, index) => (
                  <div className="workflow-callout" key={`${generated.imageId}-${index}`}>
                    <p>{caption}</p>
                  </div>
                ))}
              </div>
            ) : (
              <p>No captions were returned.</p>
            )}

            <div className="split">
              <div className="cluster">
                <Button onClick={() => setActiveStep(3)} variant="ghost">
                  Back to prompts
                </Button>
                <Button
                  onClick={() => {
                    setGenerated(null);
                    setFile(null);
                    setActiveStep(0);
                  }}
                  variant="secondary"
                >
                  Start over
                </Button>
              </div>
            </div>

            {storedCaptions.length > 0 ? (
              <div className="stack-tight">
                <span className="eyebrow">Stored captions</span>
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
                      {storedCaptions.map((caption) => (
                        <tr key={caption.key}>
                          <td>{caption.content}</td>
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
              </div>
            ) : null}
          </div>
        ) : null}
      </div>
    </Card>
  );
}
