/**
 * The short list of models offered to the visitor. Chosen on 2026-11-17 from
 * OpenRouter's model list (https://openrouter.ai/api/v1/models): cheap, with
 * tool calling, from different providers. The default is the one that did best
 * in the evaluation (`pnpm eval:bot`); see docs/decisiones.md.
 */

export interface Model {
  id: string;
  label: string;
}

export const MODELS: Model[] = [
  { id: "anthropic/claude-haiku-5.5", label: "Claude Haiku 5.5" },
  { id: "openai/gpt-6-luna", label: "GPT-6 Luna" },
  { id: "deepseek/deepseek-v4-flash", label: "DeepSeek V4 Flash" },
  { id: "qwen/qwen3.7-flash", label: "Qwen 3.7 Flash" },
  { id: "google/gemini-3.1-flash-lite", label: "Gemini 3.1 Flash Lite" },
];

export const DEFAULT_MODEL = "anthropic/claude-haiku-5.5";
