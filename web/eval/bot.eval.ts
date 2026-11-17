/**
 * Runs the questions against real models through OpenRouter.
 * `pnpm eval:bot` reads OPENROUTER_API_KEY from ../.env; BOT_MODELS picks the
 * models (comma-separated), by default the app's default one; BOT_CASES picks
 * questions by id; BOT_CONCURRENCY sets how many run at once.
 */

import { afterAll, describe, expect, it } from "vitest";
import { runTool, type ToolHost, toolDefinitions } from "../lib/bot/execute";
import { DEFAULT_MODEL } from "../lib/bot/models";
import { type ChatMessage, runAgent } from "../lib/bot/openrouter";
import { systemPrompt } from "../lib/bot/prompt";
import { fullData } from "../lib/test-data";
import { cases, type Run, unsourcedFigures } from "./questions";

const apiKey = process.env.OPENROUTER_API_KEY ?? "";
const models = (process.env.BOT_MODELS ?? DEFAULT_MODEL).split(",");
// BOT_CASES limits the run to some questions, by id; free models have a small daily quota.
const only = process.env.BOT_CASES?.split(",");
const data = fullData();
const host: ToolHost = {
  data: () => data,
  ensureMunicipal: async () => {},
  show: () => {},
};
const results: { model: string; id: string; problems: string[] }[] = [];

async function ask(
  model: string,
  question: string,
): Promise<Run & { toolText: string }> {
  const messages: ChatMessage[] = [
    {
      role: "system",
      content: systemPrompt(
        data.catalog,
        "el mapa nacional, sin territorio seleccionado",
      ),
    },
    { role: "user", content: question },
  ];
  const run: Run & { toolText: string } = {
    answer: "",
    calls: [],
    toolText: "",
  };
  await runAgent(
    { apiKey, model, messages, tools: toolDefinitions(data.catalog) },
    async (name, args) => {
      run.calls.push({
        name,
        args: args ? (JSON.parse(args) as Record<string, unknown>) : {},
      });
      const result = await runTool(name, args, host);
      run.toolText += JSON.stringify(result);
      return result;
    },
    (event) => {
      if (
        event.type === "message" &&
        event.message.role === "assistant" &&
        event.message.content
      )
        run.answer = event.message.content;
    },
  );
  return run;
}

describe.skipIf(!apiKey).each(models)("%s", (model) => {
  it.concurrent.each(
    cases(data)
      .filter((c) => !only || only.includes(c.id))
      .map((c) => [c.id, c] as const),
  )("%s", async (_, test) => {
    let problems: string[];
    try {
      const run = await ask(model, test.question);
      problems = [
        ...test.check(run),
        ...unsourcedFigures(run.answer, run.toolText),
      ];
      if (problems.length) problems.push(`respuesta: ${run.answer}`);
    } catch (error) {
      problems = [`falló la llamada: ${String(error)}`];
    }
    results.push({ model, id: test.id, problems });
    expect(problems).toEqual([]);
  });
});

afterAll(() => {
  for (const model of models) {
    const own = results.filter((r) => r.model === model);
    const passed = own.filter((r) => r.problems.length === 0).length;
    console.log(`${model}: ${passed}/${own.length}`);
  }
});
