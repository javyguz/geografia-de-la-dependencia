"use client";

import { XIcon } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { NATIONAL, type StateData } from "@/lib/data";
import { rankOf } from "@/lib/ranking";
import type { Cell, Indicator } from "@/lib/types";
import {
  cellText,
  indicatorById,
  isBivariate,
  type MapPaint,
  type Resolved,
  reasonLabel,
  sourcesOf,
  valueFor,
} from "@/lib/view";

interface Props {
  data: StateData;
  resolved: Resolved;
  paint: MapPaint;
  territory: string | null;
  onClose: () => void;
}

function sectorName(data: StateData, id: string): string {
  return data.catalog.sectors.find((s) => s.id === id)?.name ?? id;
}

/** One indicator, one territory: the value, where it stands and how it compares with the country. */
function Figure({
  data,
  indicator,
  cells,
  territory,
  year,
  sector,
}: {
  data: StateData;
  indicator: Indicator;
  cells: Map<string, Cell>;
  territory: string;
  year: number;
  sector: string;
}) {
  const own = cells.get(territory);
  const national = cells.get(NATIONAL);
  const rank = territory === NATIONAL ? null : rankOf(cells, territory);
  const note = indicator.year_note ?? String(year);
  const scope = indicator.by_sector ? ` · ${sectorName(data, sector)}` : "";

  return (
    <div className="flex flex-col gap-1">
      <h3 className="text-sm text-muted-foreground">{indicator.name}</h3>
      {own ? (
        <p className="text-xl font-semibold">
          {cellText(data, own, indicator)}
        </p>
      ) : (
        <p className="text-xl font-semibold">Sin dato</p>
      )}
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
          Puesto {rank.position} de {rank.of} entidades con dato
        </p>
      )}
      {territory !== NATIONAL && national && national.value !== null && (
        <p className="text-sm text-muted-foreground">
          Nacional: {cellText(data, national, indicator)}
        </p>
      )}
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
  data: StateData;
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

export function DetailPanel({
  data,
  resolved,
  paint,
  territory,
  onClose,
}: Props) {
  const { layer, indicator, indicator2, sector, year } = resolved;
  const shown = territory ?? NATIONAL;
  const name = data.territories.get(shown)?.name ?? "México";
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
            {territory ? name : "Nacional"}
          </h2>
          <p className="text-xs text-muted-foreground">
            {territory ? "Entidad federativa" : "Elige una entidad en el mapa"}
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
        cells={paint.cells}
        territory={shown}
        year={year}
        sector={sector}
      />
      {bivariate && indicator2 && paint.cells2 && (
        <Figure
          data={data}
          indicator={indicator2}
          cells={paint.cells2}
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
            {siblings.map((other) => {
              const result = valueFor(data, other, sector, year, shown);
              return (
                <div key={other.id} className="flex flex-col gap-0.5">
                  <span className="text-sm text-muted-foreground">
                    {other.name}
                  </span>
                  <span className="text-sm font-medium">
                    {result
                      ? cellText(data, result.cell, other)
                      : reasonLabel(data, "not_published")}
                    {result && result.year !== year && (
                      <span className="font-normal text-muted-foreground">
                        {" "}
                        ({result.year})
                      </span>
                    )}
                  </span>
                </div>
              );
            })}
          </div>
        </>
      )}

      {context.map((extra) => {
        const result = valueFor(data, extra, sector, year, shown);
        if (!result) return null;
        return (
          <div key={extra.id} className="flex flex-col gap-0.5 border-l-2 pl-3">
            <span className="text-sm text-muted-foreground">{extra.name}</span>
            <span className="text-sm font-medium">
              {cellText(data, result.cell, extra)}
            </span>
            <span className="text-xs text-muted-foreground">
              Las cifras de esta capa describen solo esa parte de la economía.
            </span>
          </div>
        );
      })}

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
