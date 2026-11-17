/** The tools as the model sees them, and how a call from the model is run. */

import { type Data, levelOf } from "../data";
import type { Catalog } from "../types";
import type { ViewState } from "../url-state";
import {
  compare,
  describeIndicator,
  findTerritory,
  getValue,
  rank,
  showOnMap,
} from "./tools";

/** What the page lends the tools: its data, a way to load municipal files, and the map. */
export interface ToolHost {
  data: () => Data;
  /** Loads the municipal totals and, for a sector, its file. */
  ensureMunicipal: (sector: string) => Promise<void>;
  show: (view: Partial<ViewState>) => void;
}

export interface ToolDefinition {
  type: "function";
  function: {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
  };
}

function tool(
  name: string,
  description: string,
  properties: Record<string, unknown>,
  required: string[],
): ToolDefinition {
  return {
    type: "function",
    function: {
      name,
      description,
      parameters: {
        type: "object",
        properties,
        required,
        additionalProperties: false,
      },
    },
  };
}

/** The schemas list the catalog's ids, so the model cannot ask for an indicator that does not exist. */
export function toolDefinitions(catalog: Catalog): ToolDefinition[] {
  const indicator = {
    type: "string",
    enum: catalog.indicators.map((i) => i.id),
    description: "Identificador del indicador.",
  };
  const sector = {
    type: "string",
    enum: catalog.sectors.map((s) => s.id),
    description: "Sector SCIAN; por omisión, «total» (todos los sectores).",
  };
  const year = {
    type: "integer",
    description: "Año; por omisión, el más reciente del indicador.",
  };
  const territory = {
    type: "string",
    description:
      "Clave CVEGEO: 2 dígitos para una entidad, 5 para un municipio, «00» para el país. Obtenla con find_territory.",
  };
  return [
    tool(
      "find_territory",
      "Busca entidades y municipios por nombre. Devuelve hasta cinco, con su clave, nivel y entidad. Úsala antes de cualquier otra herramienta que pida un territorio.",
      { query: { type: "string", description: "Nombre o parte del nombre." } },
      ["query"],
    ),
    tool(
      "describe_indicator",
      "Definición, fórmula, unidad, años, niveles, cobertura, limitaciones y fuente de un indicador.",
      { indicator },
      ["indicator"],
    ),
    tool(
      "get_value",
      "El valor de un indicador para un territorio, con unidad, año, sector y fuente; o el motivo por el que falta.",
      { indicator, territory, sector, year },
      ["indicator", "territory"],
    ),
    tool(
      "compare",
      "El valor de un indicador para 2 a 5 territorios, más el nacional.",
      {
        indicator,
        territories: {
          type: "array",
          items: territory,
          minItems: 2,
          maxItems: 5,
        },
        sector,
        year,
      },
      ["indicator", "territories"],
    ),
    tool(
      "rank",
      "Los territorios con el valor más alto («desc») o más bajo («asc») de un indicador, y cuántos no tienen dato.",
      {
        indicator,
        level: { type: "string", enum: ["state", "municipality"] },
        order: { type: "string", enum: ["desc", "asc"] },
        limit: { type: "integer", minimum: 1, maximum: 20 },
        within_state: {
          type: "string",
          description:
            "Clave de 2 dígitos para ordenar solo los municipios de una entidad.",
        },
        sector,
        year,
      },
      ["indicator", "level", "order"],
    ),
    tool(
      "show_on_map",
      "Pone en el mapa un indicador y, si se indica, selecciona un territorio. Devuelve lo que quedó a la vista.",
      { indicator, territory, sector, year },
      ["indicator"],
    ),
  ];
}

/** Whether a call touches municipalities, whose files load only when needed. */
function needsMunicipal(args: Record<string, unknown>): boolean {
  const ids = [
    args.territory,
    ...(Array.isArray(args.territories) ? args.territories : []),
  ];
  return (
    args.level === "municipality" ||
    ids.some((id) => typeof id === "string" && levelOf(id) === "municipality")
  );
}

/** Runs one call from the model. Never throws: a failure goes back to the model as `{ error }`. */
export async function runTool(
  name: string,
  rawArgs: string,
  host: ToolHost,
): Promise<unknown> {
  let args: Record<string, unknown>;
  try {
    args = rawArgs.trim()
      ? (JSON.parse(rawArgs) as Record<string, unknown>)
      : {};
  } catch {
    return { error: "Los argumentos no son JSON válido." };
  }
  try {
    if (needsMunicipal(args))
      await host.ensureMunicipal(String(args.sector ?? "total"));
    const data = host.data();
    switch (name) {
      case "find_territory":
        return findTerritory(data, args);
      case "describe_indicator":
        return describeIndicator(data, args);
      case "get_value":
        return getValue(data, args);
      case "compare":
        return compare(data, args);
      case "rank":
        return rank(data, args);
      case "show_on_map": {
        const { result, view } = showOnMap(data, args);
        if (view) host.show(view);
        return result;
      }
      default:
        return { error: `No existe la herramienta «${name}».` };
    }
  } catch (error) {
    return { error: `La herramienta falló: ${String(error)}` };
  }
}
