/**
 * The short list of models offered to the visitor: free OpenRouter models only,
 * with tool calling. Chosen on 2026-11-17 from https://openrouter.ai/api/v1/models
 * and checked with `pnpm eval:bot`; see docs/decisiones.md. Free models change
 * often and have a daily request quota, so the list needs checking again from
 * time to time.
 */

export interface Model {
  id: string;
  label: string;
}

export const MODELS: Model[] = [
  { id: "nvidia/nemotron-3.5-super-vl:free", label: "Nemotron 3.5 Super" },
  { id: "nvidia/nemotron-3.5-lightning:free", label: "Nemotron 3.5 Lightning" },
  { id: "inclusionai/ling-3.2-flash:free", label: "Ling 3.2 Flash" },
];

export const DEFAULT_MODEL = "nvidia/nemotron-3.5-super-vl:free";
