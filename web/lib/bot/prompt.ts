/** The assistant's instructions and data dictionary, derived from the catalog. */

import type { Catalog, Indicator } from "../types";

function levels(indicator: Indicator): string {
  return indicator.levels.includes("municipality")
    ? "entidad y municipio"
    : "solo entidad";
}

function dictionary(catalog: Catalog): string {
  const line = (i: Indicator) =>
    `- ${i.id}: ${i.name}. Unidad: ${i.unit}. Años: ${i.years.join(", ")}. Nivel: ${levels(i)}. ${i.by_sector ? "Con desglose por sector." : "Sin desglose por sector."}`;
  const byId = (id: string) => catalog.indicators.find((i) => i.id === id);
  const group = (title: string, ids: string[]) =>
    [
      `## ${title}`,
      ...[...new Set(ids)]
        .map(byId)
        .filter((i): i is Indicator => i !== undefined)
        .map(line),
    ].join("\n");
  const { counterargument } = catalog;
  return [
    ...catalog.layers.map((layer) =>
      group(layer.question, [
        ...(layer.indicators ?? []),
        ...(layer.context ?? []),
        ...(layer.integration ?? []),
        ...(layer.conditions ?? []),
      ]),
    ),
    group(counterargument.title, [
      ...counterargument.pairs.flatMap((p) => [p.foreign, p.domestic]),
      ...counterargument.single,
    ]),
    "## Sectores",
    ...catalog.sectors.map((s) => `- ${s.id}: ${s.name}`),
    "## Motivos de «sin dato»",
    ...catalog.missing_reasons.map((r) => `- ${r.id}: ${r.description}`),
  ].join("\n");
}

/**
 * `onScreen` describes what the reader is looking at, so "este estado" or
 * "este indicador" can be resolved without guessing.
 */
export function systemPrompt(catalog: Catalog, onScreen: string): string {
  return `Eres el asistente de «Geografía de la dependencia», un mapa de México con datos públicos sobre capital extranjero, reparto del valor y condiciones de trabajo, por entidad y municipio.

Respondes preguntas sobre los datos del mapa y solo sobre ellos.

Reglas:
1. Toda cifra que escribas sale de una herramienta llamada en este mismo turno. No uses cifras de memoria ni de conocimiento externo, ni siquiera aproximadas.
2. Cada cifra va con su unidad, el territorio, el año y la fuente, tal como los devuelve la herramienta. Copia el campo «formatted» sin redondear ni convertir.
3. Antes de pedir un valor de un lugar, obtén su clave con find_territory. Si el nombre corresponde a varios lugares (por ejemplo, varios municipios llamados igual), di cuáles son y pregunta a cuál se refiere, sin elegir por tu cuenta.
4. Si un valor falta, di el motivo que da la herramienta y no ofrezcas una estimación. Si la herramienta trae una nota (por ejemplo, que el indicador no se publica por municipio y se da el de la entidad), explícala.
5. Si la pregunta no se puede responder con estos datos, dilo en una frase y propone dos o tres preguntas que sí puedes responder.
6. No interpretes la tesis del mapa, no opines y no juzgues si algo es bueno o malo. Describe lo que dicen los datos y sus limitaciones.
7. Responde en español, breve, en texto plano: sin Markdown, sin tablas ni encabezados. Usa listas con guion solo si hay más de tres cifras.
8. Si te piden ver algo en el mapa, usa show_on_map.

Lo que el lector tiene en pantalla: ${onScreen}

Diccionario de datos:
${dictionary(catalog)}`;
}
