"use client";

import { Button } from "@/components/ui/button";
import { classIndex } from "@/lib/classify";
import type { Data } from "@/lib/data";
import { formatBare, unitLabel } from "@/lib/format";
import type { Palette } from "@/lib/palettes";
import type { Cell } from "@/lib/types";
import {
  bivariateCell,
  isBivariate,
  type MapPaint,
  type Resolved,
  sequentialColor,
  sourceLine,
} from "@/lib/view";

interface Props {
  data: Data;
  resolved: Resolved;
  paint: MapPaint;
  palette: Palette;
  selected: string | null;
  /** Which level the colours describe, or why it is not the one the reader zoomed to. */
  scope: string;
  onOpenTable: () => void;
}

function hatchStyle(palette: Palette, direction: 45 | 135) {
  const angle = direction === 45 ? "-45deg" : "45deg";
  return {
    backgroundColor: palette.noData,
    backgroundImage: `repeating-linear-gradient(${angle}, ${palette.noDataHatch} 0 1.5px, transparent 1.5px 5px)`,
  };
}

function Sequential({
  resolved,
  paint,
  palette,
  selected,
}: Omit<Props, "onOpenTable" | "data" | "scope">) {
  const { indicator } = resolved;
  const values = [...paint.cells.values()].flatMap((c) =>
    c.value === null ? [] : [c.value],
  );
  const lowest = values.length ? Math.min(...values) : 0;
  const highest = values.length ? Math.max(...values) : 0;
  const edges = [lowest, ...paint.breaks, highest];
  // Tied values can merge classes, so the scale has as many steps as there are breaks.
  const steps = paint.breaks.length + 1;
  const own = selected ? paint.cells.get(selected) : undefined;
  const ownClass =
    own?.value != null ? classIndex(own.value, paint.breaks) : null;
  const show = (n: number) => formatBare(n, indicator.unit, indicator.decimals);

  return (
    <div className="flex flex-col gap-1">
      <div
        className="relative h-8"
        role="img"
        aria-label={`Escala de ${steps} clases`}
      >
        <div className="flex h-3">
          {Array.from({ length: steps }, (_, i) => (
            <div
              // biome-ignore lint/suspicious/noArrayIndexKey: the scale is fixed; position is the identity
              key={i}
              className={
                i === ownClass
                  ? "outline-2 -outline-offset-2 outline-foreground"
                  : ""
              }
              style={{
                backgroundColor: sequentialColor(palette, i, paint.breaks),
                width: `${100 / steps}%`,
              }}
            />
          ))}
        </div>
        {edges.map((edge, i) => (
          <span
            // biome-ignore lint/suspicious/noArrayIndexKey: the scale is fixed; position is the identity
            key={i}
            className="absolute top-4 text-xs text-muted-foreground"
            style={{
              left: `${(i * 100) / steps}%`,
              transform:
                i === 0
                  ? "none"
                  : i === steps
                    ? "translateX(-100%)"
                    : "translateX(-50%)",
            }}
          >
            {show(edge)}
          </span>
        ))}
      </div>
    </div>
  );
}

function Bivariate({
  resolved,
  paint,
  palette,
  selected,
}: Omit<Props, "onOpenTable" | "data" | "scope">) {
  const { indicator, indicator2 } = resolved;
  const axisValue = (cells: Map<string, Cell> | null): number | null =>
    (selected ? cells?.get(selected)?.value : null) ?? null;
  const x = axisValue(paint.cells);
  const y = axisValue(paint.cells2);
  const own = bivariateCell(
    x,
    y,
    paint.breaks,
    paint.breaks2,
    indicator2?.higher_is_better !== false,
  );

  return (
    <div className="flex gap-3">
      <div
        className="grid shrink-0 grid-cols-3 gap-0.5 self-start"
        role="img"
        aria-label="Cuadrícula de 3 por 3: integración externa de izquierda a derecha, condiciones de trabajo de abajo hacia arriba"
      >
        {[2, 1, 0].flatMap((r) =>
          [0, 1, 2].map((c) => (
            <div
              key={`${r}-${c}`}
              className={`size-7 ${r === own?.row && c === own?.column ? "outline-2 outline-offset-1 outline-foreground" : ""}`}
              style={{ backgroundColor: palette.bivariate[r]?.[c] }}
            />
          )),
        )}
      </div>
      <dl className="flex min-w-0 flex-col gap-2 text-xs">
        <div>
          <dt className="text-muted-foreground">→ Más integración externa</dt>
          <dd>{indicator.name}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">
            ↑ Mejores condiciones de trabajo
          </dt>
          <dd>
            {indicator2?.name}
            {indicator2?.higher_is_better === false && " (invertida)"}
          </dd>
        </div>
      </dl>
    </div>
  );
}

export function Legend(props: Props) {
  const { data, resolved, paint, palette, scope, onOpenTable } = props;
  const { indicator, indicator2, layer, year } = resolved;
  const bivariate = isBivariate(layer);
  const axes = indicator2 ? [indicator, indicator2] : [indicator];
  const reasons = new Set(paint.missing.values());
  const hasConfidential = reasons.has("confidential");
  const hasOther = [...reasons].some((r) => r !== "confidential");
  const when = [...new Set(axes.map((i) => i.year_note ?? String(year)))].join(
    " ",
  );
  const unit = bivariate ? "" : unitLabel(indicator.unit);

  return (
    <section
      aria-label="Leyenda"
      className="flex flex-col gap-2 p-2 text-sm md:p-3"
    >
      {bivariate ? <Bivariate {...props} /> : <Sequential {...props} />}
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
          <span>{scope}</span>
          {unit && <span>{unit}</span>}
          {hasOther && (
            <span className="flex items-center gap-1.5">
              <span className="size-3 border" style={hatchStyle(palette, 45)} />
              Sin dato
            </span>
          )}
          {hasConfidential && (
            <span className="flex items-center gap-1.5">
              <span
                className="size-3 border"
                style={hatchStyle(palette, 135)}
              />
              Confidencial
            </span>
          )}
        </div>
        <Button variant="outline" size="sm" onClick={onOpenTable}>
          Ver como tabla
        </Button>
      </div>
      {/* On small screens the source sits in the detail panel, right below. */}
      <p className="hidden text-xs text-muted-foreground md:block">
        Fuente: {sourceLine(data, axes, year)}. {when}
      </p>
    </section>
  );
}
