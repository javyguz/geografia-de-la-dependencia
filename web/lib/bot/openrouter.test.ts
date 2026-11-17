import { describe, expect, it } from "vitest";
import { mergeDelta, readEvents, type ToolCall } from "./openrouter";

function stream(...parts: string[]): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  return new ReadableStream({
    start(controller) {
      for (const part of parts) controller.enqueue(encoder.encode(part));
      controller.close();
    },
  });
}

describe("readEvents", () => {
  it("joins lines split across chunks and skips keep-alive comments", async () => {
    const events = [];
    for await (const event of readEvents(
      stream(
        ": OPENROUTER PROCESSING\n\n",
        'data: {"choices":[{"delta":{"content":"Ho',
        'la"}}]}\n\ndata: [DONE]\n\n',
      ),
    ))
      events.push(event);
    expect(events).toEqual([{ choices: [{ delta: { content: "Hola" } }] }]);
  });
});

describe("mergeDelta", () => {
  it("rebuilds a tool call from its fragments", () => {
    const message = { content: "", tool_calls: [] as ToolCall[] };
    mergeDelta(message, {
      tool_calls: [
        {
          index: 0,
          id: "c1",
          function: { name: "get_value", arguments: '{"ind' },
        },
      ],
    });
    mergeDelta(message, {
      tool_calls: [
        { index: 0, function: { arguments: 'icator":"labor_share"}' } },
      ],
    });
    expect(message.tool_calls[0]).toEqual({
      id: "c1",
      type: "function",
      function: { name: "get_value", arguments: '{"indicator":"labor_share"}' },
    });
  });
});
