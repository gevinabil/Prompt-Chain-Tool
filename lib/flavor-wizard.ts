export const STEP_TEMPLATES = [
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

export type StepTemplate = (typeof STEP_TEMPLATES)[number];
