/**
 * Questions for the assistant, each with what a correct answer must show.
 * The expected figures are computed with the tools themselves, so the cases
 * follow the data when it is rebuilt.
 */

import { getValue, rank, type ToolValue } from "../lib/bot/tools";
import type { Data } from "../lib/data";

export interface Run {
  answer: string;
  /** Tool calls in order, with their parsed arguments. */
  calls: { name: string; args: Record<string, unknown> }[];
}

export interface Case {
  id: string;
  question: string;
  /** Problems with the run; empty when it passes. */
  check: (run: Run) => string[];
}

const plain = (text: string) =>
  text
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase();

function mentions(run: Run, ...texts: string[]): string[] {
  return texts
    .filter((t) => !plain(run.answer).includes(plain(t)))
    .map((t) => `la respuesta no menciona «${t}»`);
}

function called(run: Run, name: string): string[] {
  return run.calls.some((c) => c.name === name) ? [] : [`no llamó a ${name}`];
}

function value(data: Data, args: Record<string, unknown>): ToolValue {
  return getValue(data, args) as ToolValue;
}

export function cases(data: Data): Case[] {
  const nuevoLeon = value(data, { indicator: "labor_share", territory: "19" });
  const guadalajara = value(data, {
    indicator: "labor_share",
    territory: "14039",
  });
  const jalisco2018 = value(data, {
    indicator: "wage_per_paid_worker",
    territory: "14",
    year: 2018,
  });
  const chiapas = value(data, {
    indicator: "informality_rate",
    territory: "07",
  });
  const nl = value(data, { indicator: "informality_rate", territory: "19" });
  const top = rank(data, {
    indicator: "foreign_share_value_added",
    level: "state",
    order: "desc",
    limit: 3,
  }) as { items: ToolValue[] };
  // The first state whose farming and fishing figure is confidential.
  const hidden = [...data.territories.values()].find(
    (t) =>
      t.level === "state" &&
      t.id !== "00" &&
      value(data, {
        indicator: "foreign_share_value_added",
        territory: t.id,
        sector: "11",
      }).missing_reason === "confidential",
  );

  return [
    {
      id: "state value",
      question:
        "¿Qué parte del valor agregado se paga en remuneraciones en Nuevo León?",
      check: (run) => mentions(run, nuevoLeon.formatted, "2023"),
    },
    {
      id: "municipal value",
      question:
        "¿Qué parte del valor agregado se paga en remuneraciones en el municipio de Guadalajara?",
      check: (run) => mentions(run, guadalajara.formatted),
    },
    {
      id: "older year",
      question:
        "¿Cuál era la remuneración media por persona remunerada en Jalisco en 2018?",
      check: (run) => mentions(run, jalisco2018.formatted.split(" ")[0] ?? ""),
    },
    {
      id: "ranking",
      question:
        "¿Cuáles son las tres entidades donde las unidades con capital extranjero generan la mayor parte del valor agregado?",
      check: (run) => mentions(run, ...top.items.map((i) => i.territory_name)),
    },
    {
      id: "comparison",
      question:
        "Compara la tasa de informalidad laboral de Chiapas y Nuevo León.",
      check: (run) => mentions(run, chiapas.formatted, nl.formatted),
    },
    {
      id: "ambiguous place",
      question:
        "¿Cuánto empleo hay en establecimientos de hasta 10 personas en Juárez?",
      // Five municipalities are called Juárez: a good answer names several or asks which one.
      check: (run) => {
        const states = [
          "Chihuahua",
          "Nuevo León",
          "Chiapas",
          "Coahuila",
          "Michoacán",
        ];
        const named = states.filter((s) =>
          plain(run.answer).includes(plain(s)),
        );
        return named.length >= 2 || run.answer.includes("?")
          ? []
          : ["no aclaró a qué Juárez se refiere"];
      },
    },
    {
      id: "confidential",
      question: `¿Qué parte del valor agregado del sector de agricultura, cría de animales, aprovechamiento forestal, pesca y caza generan las unidades con capital extranjero en ${hidden?.name ?? "Tlaxcala"}?`,
      check: (run) =>
        hidden
          ? mentions(run, "confidencial")
          : [
              "no hay ninguna entidad confidencial en ese sector; revisar el caso",
            ],
    },
    {
      id: "state-only indicator for a municipality",
      question:
        "¿Qué parte del valor agregado generan las unidades con capital extranjero en Guadalajara?",
      check: (run) => mentions(run, "municipio", "Jalisco"),
    },
    {
      id: "describe",
      question:
        "¿Cómo se calcula la inversión extranjera directa por habitante?",
      check: (run) => [
        ...called(run, "describe_indicator"),
        ...mentions(run, "población"),
      ],
    },
    {
      id: "show on map",
      question: "Muéstrame en el mapa la tasa de informalidad laboral.",
      check: (run) =>
        run.calls.some(
          (c) =>
            c.name === "show_on_map" && c.args.indicator === "informality_rate",
        )
          ? []
          : ["no puso la informalidad en el mapa"],
    },
    {
      id: "out of scope",
      question: "¿Cuál fue el PIB de México en 2024?",
      // It must not produce a GDP figure, and it should point to what it can answer.
      check: (run) => [
        ...(/\bPIB\b[^.]*\d\s*(%|pesos|dólares|billones|millones)/i.test(
          run.answer,
        )
          ? ["dio una cifra de PIB, que no está en los datos"]
          : []),
        ...(/puedo|puede|\?/i.test(run.answer)
          ? []
          : ["no propuso qué sí puede responder"]),
      ],
    },
    {
      id: "opinion",
      question: "¿El capital extranjero es bueno o malo para México?",
      check: (run) =>
        /\b(es|son) (bueno|malo|positivo|negativo|beneficioso|perjudicial)\b(?! o )/i.test(
          run.answer,
        )
          ? ["emitió un juicio"]
          : [],
    },
  ];
}

/**
 * Figures in the answer with decimals or thousands separators must come from a
 * tool result of the same run. Years and small counts are not checked.
 */
export function unsourcedFigures(answer: string, toolText: string): string[] {
  const figures = answer.match(/\d{1,3}(?:,\d{3})+(?:\.\d+)?|\d+\.\d+/g) ?? [];
  const digits = toolText.replace(/,/g, "");
  return figures
    .filter(
      (f) => !toolText.includes(f) && !digits.includes(f.replace(/,/g, "")),
    )
    .map((f) => `cifra sin fuente en la respuesta: ${f}`);
}
