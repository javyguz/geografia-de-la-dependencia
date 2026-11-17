"use client";

import { XIcon } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { type Data, levelOf, NATIONAL, stateOf } from "@/lib/data";
import { rankOf } from "@/lib/ranking";
import type { Indicator } from "@/lib/types";
import {
  cellsFor,
  cellText,
  indicatorById,
  isBivariate,
  type Reading,
  type Resolved,
  readingFor,
  sourcesOf,
} from "@/lib/view";

interface Props {
  data: Data;
  resolved: Resolved;
  territory: string | null;
  onClose: () => void;
}

function sectorName(data: Data, id: string): string {
  return data.catalog.sectors.find((s) => s.id === id)?.name ?? id;
}

function nameOf(data: Data, id: string): string {
  return data.territories.get(id)?.name ?? id;
}

/** "Jalisco" for a state; "Municipio, Jalisco" or "Alcaldía, Ciudad de México" below it. */
function kindOf(data: Data, id: string): string {
  if (levelOf(id) === "state") return "Entidad federativa";
  const state = stateOf(id);
  return `${state === "09" ? "Alcaldía" : "Municipio"}, ${nameOf(data, state)}`;
}

/** The value, or why there is none; "Cargando…" while its file is on the way. */
function readingText(data: Data, reading: Reading, indicator: Indicator) {
  if (!reading.cells) return "Cargando…";
  const cell = reading.cells.get(reading.territory);
  return cell ? cellText(data, cell, indicator) : "Sin dato";
}

/** One indicator, one territory: the value, where it stands and how it compares. */
function Figure({
  data,
  indicator,
  territory,
  year,
  sector,
}: {
  data: Data;
  indicator: Indicator;
  territory: string;
  year: number;
  sector: string;
}) {
  const reading = readingFor(data, indicator, sector, year, territory);
  const own = reading.cells?.get(reading.territory);
  const municipal = levelOf(reading.territory) === "municipality";
  const rank =
    reading.territory !== NATIONAL && reading.cells
      ? rankOf(reading.cells, reading.territory)
      : null;
  // The rows the territory is compared with: its state, then the country.
  const states = cellsFor(
    data,
    "state",
    indicator.id,
    reading.sector,
    reading.year,
  );
  const references = [
    ...(municipal ? [stateOf(reading.territory)] : []),
    ...(reading.territory !== NATIONAL ? [NATIONAL] : []),
  ];
  const note = indicator.year_note ?? String(reading.year);
  const scope = indicator.by_sector
    ? ` · ${sectorName(data, reading.sector)}`
    : "";

  return (
    <div className="flex flex-col gap-1">
      <h3 className="text-sm text-muted-foreground">{indicator.name}</h3>
      {reading.fromState && (
        <p className="text-sm">
          No se publica por municipio. Valor de{" "}
          {nameOf(data, reading.territory)}:
        </p>
      )}
      <p className="text-xl font-semibold">
        {readingText(data, reading, indicator)}
      </p>
      {own?.value === null && (
        <p className="text-sm text-muted-foreground">
          {
            data.catalog.missing_reasons.find((r) => r.id === own.reason)
              ?.description
          }
        </p>
      )}
      <p className="text-xs text-muted-foreground">
        {note}
        {scope}
      </p>
      {rank && (
        <p className="text-sm">
          Puesto {rank.position.toLocaleString("es-MX")} de{" "}
          {rank.of.toLocaleString("es-MX")}{" "}
          {municipal ? "municipios" : "entidades"} con dato
        </p>
      )}
      {references.map((id) => {
        const cell = states?.get(id);
        if (!cell || cell.value === null) return null;
        return (
          <p key={id} className="text-sm text-muted-foreground">
            {id === NATIONAL ? "Nacional" : nameOf(data, id)}:{" "}
            {cellText(data, cell, indicator)}
          </p>
        );
      })}
    </div>
  );
}

function Method({
  indicator,
  labelled,
}: {
  indicator: Indicator;
  labelled: boolean;
}) {
  return (
    <details className="text-sm">
      <summary className="cursor-pointer font-medium">
        Cómo se calcula{labelled ? `: ${indicator.name}` : ""}
      </summary>
      <div className="mt-2 flex flex-col gap-2 text-muted-foreground">
        <p>{indicator.definition}</p>
        <p>
          <span className="text-foreground">Fórmula.</span> {indicator.formula}
        </p>
        <p>
          <span className="text-foreground">Cobertura.</span>{" "}
          {indicator.coverage}
        </p>
        <ul className="flex list-disc flex-col gap-1 pl-4">
          {indicator.limitations.map((text) => (
            <li key={text}>{text}</li>
          ))}
        </ul>
      </div>
    </details>
  );
}

function Sources({
  data,
  indicators,
  year,
}: {
  data: Data;
  indicators: Indicator[];
  year: number;
}) {
  return (
    <p className="text-xs text-muted-foreground">
      Fuente:{" "}
      {sourcesOf(data, indicators, year).map((source, i) => (
        <span key={source.id}>
          {i > 0 && "; "}
          <a
            href={source.url}
            target="_blank"
            rel="noreferrer"
            className="text-primary underline underline-offset-2"
          >
            {source.institution}, {source.name}
          </a>
        </span>
      ))}
      .
    </p>
  );
}

/** A secondary indicator in one line, with what differs from the map: another year, or the state's value. */
function Line({
  data,
  indicator,
  sector,
  year,
  territory,
}: {
  data: Data;
  indicator: Indicator;
  sector: string;
  year: number;
  territory: string;
}) {
  const reading = readingFor(data, indicator, sector, year, territory);
  const notes = [
    ...(reading.year !== year ? [String(reading.year)] : []),
    ...(reading.fromState ? [nameOf(data, reading.territory)] : []),
  ];
  return (
    <span className="text-sm font-medium">
      {readingText(data, reading, indicator)}
      {notes.length > 0 && (
        <span className="font-normal text-muted-foreground">
          {" "}
          ({notes.join(", ")})
        </span>
      )}
    </span>
  );
}

export function DetailPanel({ data, resolved, territory, onClose }: Props) {
  const { layer, indicator, indicator2, sector, year } = resolved;
  const shown = territory ?? NATIONAL;
  const bivariate = isBivariate(layer);

  const siblings = (layer.indicators ?? [])
    .filter((id) => id !== indicator.id)
    .map((id) => indicatorById(data, id))
    .filter((i): i is Indicator => i !== undefined);
  const context = (layer.context ?? [])
    .map((id) => indicatorById(data, id))
    .filter((i): i is Indicator => i !== undefined);
  const warnings = [indicator, indicator2].filter(
    (i): i is Indicator => i != null && i.warning !== undefined,
  );

  return (
    <div className="flex flex-col gap-4 p-4">
      <div className="flex items-start justify-between gap-2">
        <div>
          <h2 className="text-base font-semibold">
            {territory ? nameOf(data, territory) : "Nacional"}
          </h2>
          <p className="text-xs text-muted-foreground">
            {territory
              ? kindOf(data, territory)
              : "Elige una entidad o un municipio en el mapa"}
          </p>
        </div>
        {territory && (
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={onClose}
            aria-label="Quitar selección"
          >
            <XIcon />
          </Button>
        )}
      </div>

      <Figure
        data={data}
        indicator={indicator}
        territory={shown}
        year={year}
        sector={sector}
      />
      {bivariate && indicator2 && (
        <Figure
          data={data}
          indicator={indicator2}
          territory={shown}
          year={year}
          sector="total"
        />
      )}

      {warnings.map((w) => (
        <Alert key={w.id}>
          <AlertDescription>{w.warning}</AlertDescription>
        </Alert>
      ))}

      {siblings.length > 0 && (
        <>
          <Separator />
          <div className="flex flex-col gap-3">
            <h3 className="text-sm font-medium">
              Otros indicadores de esta capa
            </h3>
            {siblings.map((other) => (
              <div key={other.id} className="flex flex-col gap-0.5">
                <span className="text-sm text-muted-foreground">
                  {other.name}
                </span>
                <Line
                  data={data}
                  indicator={other}
                  sector={sector}
                  year={year}
                  territory={shown}
                />
              </div>
            ))}
          </div>
        </>
      )}

      {context.map((extra) => (
        <div key={extra.id} className="flex flex-col gap-0.5 border-l-2 pl-3">
          <span className="text-sm text-muted-foreground">{extra.name}</span>
          <Line
            data={data}
            indicator={extra}
            sector={sector}
            year={year}
            territory={shown}
          />
          <span className="text-xs text-muted-foreground">
            Las cifras de esta capa describen solo esa parte de la economía.
          </span>
        </div>
      ))}

      <Separator />
      <Method indicator={indicator} labelled={indicator2 !== null} />
      {indicator2 && <Method indicator={indicator2} labelled />}
      <Sources
        data={data}
        indicators={indicator2 ? [indicator, indicator2] : [indicator]}
        year={year}
      />
    </div>
  );
}
