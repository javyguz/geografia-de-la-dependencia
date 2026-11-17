/**
 * Chat with OpenRouter straight from the browser, streamed, with tool calls.
 * The visitor's key goes in the request header and nowhere else.
 */

import type { ToolDefinition } from "./execute";

const ENDPOINT = "https://openrouter.ai/api/v1/chat/completions";
/** Enough for a lookup, a ranking and an answer; a loop beyond this is a model going in circles. */
export const MAX_STEPS = 8;
/**
 * Answers are a few sentences. Without a cap OpenRouter reserves credit for the
 * model's maximum (65,536 tokens for some), and a key with a spending limit is refused.
 */
const MAX_TOKENS = 1200;

export interface ToolCall {
  id: string;
  type: "function";
  function: { name: string; arguments: string };
}

export type ChatMessage =
  | { role: "system" | "user"; content: string }
  | { role: "assistant"; content: string | null; tool_calls?: ToolCall[] }
  | { role: "tool"; tool_call_id: string; content: string };

export type AgentEvent =
  | { type: "text"; text: string }
  | { type: "message"; message: ChatMessage };

export class ChatError extends Error {}

interface Delta {
  content?: string | null;
  tool_calls?: {
    index: number;
    id?: string;
    function?: { name?: string; arguments?: string };
  }[];
}

interface Chunk {
  choices?: { delta?: Delta; finish_reason?: string | null }[];
  error?: { message?: string; code?: number };
}

/** Splits a server-sent event stream into the JSON of each `data:` line. */
export async function* readEvents(
  body: ReadableStream<Uint8Array>,
): AsyncGenerator<Chunk> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    // `stream: true` keeps a character split across two chunks whole.
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";
    for (const line of lines) {
      // Lines starting with ":" are keep-alive comments from OpenRouter.
      if (!line.startsWith("data:")) continue;
      const data = line.slice(5).trim();
      if (data === "[DONE]") return;
      if (data) yield JSON.parse(data) as Chunk;
    }
  }
}

/** Merges streamed deltas into one assistant message. */
export function mergeDelta(
  message: { content: string; tool_calls: ToolCall[] },
  delta: Delta,
): void {
  if (delta.content) message.content += delta.content;
  for (const part of delta.tool_calls ?? []) {
    const call = message.tool_calls[part.index] ?? {
      id: "",
      type: "function",
      function: { name: "", arguments: "" },
    };
    message.tool_calls[part.index] = call;
    if (part.id) call.id = part.id;
    if (part.function?.name) call.function.name += part.function.name;
    if (part.function?.arguments)
      call.function.arguments += part.function.arguments;
  }
}

function explain(status: number, detail: string): string {
  if (status === 401)
    return "OpenRouter no reconoce la clave. Revísala o bórrala y escribe otra.";
  if (status === 402)
    return `La cuenta de OpenRouter no tiene saldo suficiente para este modelo${detail ? ` (${detail})` : ""}.`;
  if (status === 429)
    return "OpenRouter limitó las peticiones. Espera un momento y vuelve a preguntar.";
  return `OpenRouter respondió con un error (${status})${detail ? `: ${detail}` : ""}.`;
}

interface Request {
  apiKey: string;
  model: string;
  messages: ChatMessage[];
  tools: ToolDefinition[];
  signal?: AbortSignal;
}

/** One streamed completion. Text arrives through `onText` as it is generated. */
async function complete(
  { apiKey, model, messages, tools, signal }: Request,
  onText: (text: string) => void,
): Promise<{ content: string; tool_calls: ToolCall[] }> {
  const response = await fetch(ENDPOINT, {
    method: "POST",
    signal,
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      // Header values must be ASCII.
      "X-Title": "Geografia de la dependencia",
    },
    body: JSON.stringify({
      model,
      messages,
      tools,
      stream: true,
      max_tokens: MAX_TOKENS,
    }),
  });
  if (!response.ok || !response.body) {
    const detail = await response.text().catch(() => "");
    let message = "";
    try {
      message = (JSON.parse(detail) as Chunk).error?.message ?? "";
    } catch {}
    throw new ChatError(explain(response.status, message));
  }
  const message = { content: "", tool_calls: [] as ToolCall[] };
  for await (const chunk of readEvents(response.body)) {
    if (chunk.error)
      throw new ChatError(
        explain(chunk.error.code ?? 500, chunk.error.message ?? ""),
      );
    const delta = chunk.choices?.[0]?.delta;
    if (!delta) continue;
    mergeDelta(message, delta);
    if (delta.content) onText(delta.content);
  }
  return message;
}

/**
 * Asks, runs the tools the model calls and asks again, until the model answers
 * in text. Every finished message is reported, so the caller can keep the history.
 */
export async function runAgent(
  request: Request,
  runTool: (name: string, args: string) => Promise<unknown>,
  onEvent: (event: AgentEvent) => void,
): Promise<void> {
  const messages = [...request.messages];
  for (let step = 0; step < MAX_STEPS; step += 1) {
    const reply = await complete({ ...request, messages }, (text) =>
      onEvent({ type: "text", text }),
    );
    const calls = reply.tool_calls.filter((c) => c.function.name);
    const assistant: ChatMessage = {
      role: "assistant",
      content: reply.content || null,
      ...(calls.length > 0 && { tool_calls: calls }),
    };
    messages.push(assistant);
    onEvent({ type: "message", message: assistant });
    if (calls.length === 0) return;
    for (const call of calls) {
      const result = await runTool(call.function.name, call.function.arguments);
      const message: ChatMessage = {
        role: "tool",
        tool_call_id: call.id,
        content: JSON.stringify(result),
      };
      messages.push(message);
      onEvent({ type: "message", message });
    }
  }
  throw new ChatError(
    "El modelo pidió demasiadas consultas sin llegar a una respuesta. Prueba con una pregunta más concreta.",
  );
}
