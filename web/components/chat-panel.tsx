"use client";

import { ArrowUpIcon, SquareIcon, XIcon } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { ApiKeyDialog } from "@/components/api-key-dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Bubble, BubbleContent } from "@/components/ui/bubble";
import { Button } from "@/components/ui/button";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupTextarea,
} from "@/components/ui/input-group";
import { Message, MessageContent } from "@/components/ui/message";
import {
  MessageScroller,
  MessageScrollerButton,
  MessageScrollerContent,
  MessageScrollerItem,
  MessageScrollerProvider,
  MessageScrollerViewport,
} from "@/components/ui/message-scroller";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Trace, TraceLine, TraceTitle } from "@/components/ui/trace";
import { runTool, type ToolHost, toolDefinitions } from "@/lib/bot/execute";
import { DEFAULT_MODEL, MODELS } from "@/lib/bot/models";
import {
  ChatError,
  type ChatMessage,
  runAgent,
  type ToolCall,
} from "@/lib/bot/openrouter";
import { systemPrompt } from "@/lib/bot/prompt";
import {
  clearKey,
  readKey,
  readModel,
  saveKey,
  saveModel,
} from "@/lib/bot/storage";
import type { Data } from "@/lib/data";

interface Props {
  host: ToolHost;
  /** What the reader has on screen, in words, for questions like "¿y en este estado?". */
  onScreen: string;
  onClose: () => void;
}

const SUGGESTIONS = [
  "¿En qué entidades generan las unidades con capital extranjero la mayor parte del valor agregado?",
  "Compara la tasa de informalidad laboral de Chiapas y Nuevo León.",
  "¿Cómo se calcula la parte del valor agregado que se paga en remuneraciones?",
];

/** One line per tool call, in the reader's words rather than the tool's. */
function describeCall(data: Data, call: ToolCall): string {
  let args: Record<string, unknown> = {};
  try {
    args = JSON.parse(call.function.arguments || "{}");
  } catch {}
  const indicator =
    data.catalog.indicators.find((i) => i.id === args.indicator)?.name ??
    "un indicador";
  const place = (id: unknown) =>
    id === "00"
      ? "el país"
      : (data.territories.get(String(id))?.name ?? String(id));
  switch (call.function.name) {
    case "find_territory":
      return `Buscó «${String(args.query ?? "")}»`;
    case "describe_indicator":
      return `Leyó cómo se calcula: ${indicator}`;
    case "get_value":
      return `Consultó ${indicator} en ${place(args.territory)}`;
    case "compare":
      return `Comparó ${indicator} entre ${Array.isArray(args.territories) ? args.territories.map(place).join(", ") : "varios lugares"}`;
    case "rank":
      return `Ordenó ${args.level === "municipality" ? "municipios" : "entidades"} por ${indicator}`;
    case "show_on_map":
      return `Puso en el mapa: ${indicator}`;
    default:
      return call.function.name;
  }
}

function failed(messages: ChatMessage[], id: string): boolean {
  const result = messages.find(
    (m) => m.role === "tool" && m.tool_call_id === id,
  );
  return result?.role === "tool" && result.content.includes('"error"');
}

export function ChatPanel({ host, onScreen, onClose }: Props) {
  const data = host.data();
  const [key, setKey] = useState<string | null>(null);
  const [model, setModel] = useState(DEFAULT_MODEL);
  // Read after mount: the page is rendered at build time, where there is no storage.
  useEffect(() => {
    setKey(readKey());
    const saved = readModel();
    if (MODELS.some((m) => m.id === saved)) setModel(saved as string);
  }, []);
  const [askingKey, setAskingKey] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [input, setInput] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const abort = useRef<AbortController | null>(null);

  async function send(question: string) {
    const text = question.trim();
    if (!text || busy) return;
    if (!key) {
      setAskingKey(true);
      return;
    }
    const history: ChatMessage[] = [
      ...messages,
      { role: "user", content: text },
    ];
    setMessages(history);
    setInput("");
    setError(null);
    setBusy(true);
    abort.current = new AbortController();
    try {
      await runAgent(
        {
          apiKey: key,
          model,
          messages: [
            { role: "system", content: systemPrompt(data.catalog, onScreen) },
            ...history,
          ],
          tools: toolDefinitions(data.catalog),
          signal: abort.current.signal,
        },
        (name, args) => runTool(name, args, host),
        (event) => {
          if (event.type === "text") setDraft((d) => d + event.text);
          else {
            setDraft("");
            setMessages((m) => [...m, event.message]);
          }
        },
      );
    } catch (caught) {
      if (!abort.current?.signal.aborted)
        setError(
          caught instanceof ChatError
            ? caught.message
            : "No se pudo contactar con OpenRouter. Revisa la conexión y vuelve a preguntar.",
        );
    } finally {
      setDraft("");
      setBusy(false);
    }
  }

  // The history is only ever appended to, so a message's position is a stable key.
  const shown = messages.flatMap((message, position) =>
    message.role === "user" ||
    (message.role === "assistant" && (message.content || message.tool_calls))
      ? [{ message, position }]
      : [],
  );

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex flex-col gap-3 border-b p-4">
        <div className="flex items-start justify-between gap-2">
          <div>
            <h2 className="text-2xl">Preguntar a los datos</h2>
            <p className="text-xs text-muted-foreground">
              Responde solo con las cifras del mapa y cita su fuente.
            </p>
          </div>
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={onClose}
            aria-label="Cerrar el asistente"
          >
            <XIcon />
          </Button>
        </div>
        {key && (
          <div className="flex items-center justify-between gap-2">
            <Select
              value={model}
              onValueChange={(id) => {
                setModel(id);
                saveModel(id);
              }}
            >
              <SelectTrigger size="sm" aria-label="Modelo">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  {MODELS.map((m) => (
                    <SelectItem key={m.id} value={m.id}>
                      {m.label}
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                clearKey();
                setKey(null);
              }}
            >
              Borrar mi clave
            </Button>
          </div>
        )}
      </div>

      <MessageScrollerProvider>
        <MessageScroller className="min-h-0 flex-1">
          <MessageScrollerViewport>
            <MessageScrollerContent className="p-4">
              {shown.length === 0 && (
                <MessageScrollerItem>
                  <div className="flex flex-col gap-3 text-sm">
                    {!key && (
                      <p className="text-muted-foreground">
                        Para preguntar hace falta una clave de OpenRouter. El
                        resto de la app funciona sin ella.
                      </p>
                    )}
                    <p className="text-muted-foreground">Por ejemplo:</p>
                    {SUGGESTIONS.map((s) => (
                      <Button
                        key={s}
                        variant="outline"
                        className="h-auto justify-start py-2 text-left whitespace-normal"
                        onClick={() => send(s)}
                      >
                        {s}
                      </Button>
                    ))}
                  </div>
                </MessageScrollerItem>
              )}
              {shown.map(({ message, position }) => (
                <MessageScrollerItem
                  key={position}
                  scrollAnchor={message.role === "user"}
                >
                  {message.role === "user" ? (
                    <Message align="end">
                      <MessageContent>
                        <Bubble variant="secondary">
                          <BubbleContent>{message.content}</BubbleContent>
                        </Bubble>
                      </MessageContent>
                    </Message>
                  ) : (
                    message.role === "assistant" && (
                      <Message>
                        <MessageContent>
                          {message.tool_calls && (
                            <Trace>
                              {message.tool_calls.map((call) => (
                                <div key={call.id}>
                                  <TraceLine
                                    status={
                                      failed(messages, call.id)
                                        ? "error"
                                        : undefined
                                    }
                                  >
                                    <TraceTitle>
                                      {describeCall(data, call)}
                                    </TraceTitle>
                                  </TraceLine>
                                </div>
                              ))}
                            </Trace>
                          )}
                          {message.content && (
                            <Bubble variant="ghost">
                              <BubbleContent className="whitespace-pre-wrap">
                                {message.content}
                              </BubbleContent>
                            </Bubble>
                          )}
                        </MessageContent>
                      </Message>
                    )
                  )}
                </MessageScrollerItem>
              ))}
              {busy && (
                <MessageScrollerItem>
                  <Message>
                    <MessageContent>
                      {draft ? (
                        <Bubble variant="ghost">
                          <BubbleContent className="whitespace-pre-wrap">
                            {draft}
                          </BubbleContent>
                        </Bubble>
                      ) : (
                        <Trace>
                          <div>
                            <TraceLine status="running">
                              <TraceTitle>Consultando los datos…</TraceTitle>
                            </TraceLine>
                          </div>
                        </Trace>
                      )}
                    </MessageContent>
                  </Message>
                </MessageScrollerItem>
              )}
              {error && (
                <MessageScrollerItem>
                  <Alert variant="destructive">
                    <AlertDescription>{error}</AlertDescription>
                  </Alert>
                </MessageScrollerItem>
              )}
            </MessageScrollerContent>
          </MessageScrollerViewport>
          <MessageScrollerButton />
        </MessageScroller>
      </MessageScrollerProvider>

      <form
        className="border-t p-3"
        onSubmit={(event) => {
          event.preventDefault();
          send(input);
        }}
      >
        <InputGroup>
          <InputGroupTextarea
            aria-label="Pregunta"
            placeholder={
              key
                ? "Pregunta sobre los datos del mapa"
                : "Añade tu clave para preguntar"
            }
            value={input}
            rows={2}
            onChange={(event) => setInput(event.target.value)}
            onKeyDown={(event) => {
              // Enter sends; Shift+Enter starts a new line.
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                send(input);
              }
            }}
          />
          <InputGroupAddon align="block-end" className="justify-between">
            {key ? (
              <span className="text-xs text-muted-foreground">
                Modelos gratuitos, con un cupo diario de peticiones.
              </span>
            ) : (
              <InputGroupButton
                variant="secondary"
                onClick={() => setAskingKey(true)}
              >
                Añadir mi clave
              </InputGroupButton>
            )}
            {busy ? (
              <InputGroupButton
                variant="outline"
                size="icon-xs"
                aria-label="Detener"
                onClick={() => abort.current?.abort()}
              >
                <SquareIcon />
              </InputGroupButton>
            ) : (
              <InputGroupButton
                type="submit"
                variant="default"
                size="icon-xs"
                aria-label="Enviar"
                disabled={!input.trim()}
              >
                <ArrowUpIcon />
              </InputGroupButton>
            )}
          </InputGroupAddon>
        </InputGroup>
      </form>

      <ApiKeyDialog
        open={askingKey}
        onOpenChange={setAskingKey}
        onSave={(value) => {
          if (!saveKey(value))
            setError(
              "Este navegador no deja guardar la clave: se usará solo mientras esta página siga abierta.",
            );
          setKey(value);
          setAskingKey(false);
        }}
      />
    </div>
  );
}
