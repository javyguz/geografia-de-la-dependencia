"use client";

import { XIcon } from "lucide-react";
import {
  Figure,
  Method,
  nameOf,
  readingText,
  Sources,
  sectorName,
} from "@/components/indicator-parts";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { pairCount } from "@/lib/compare";
import { type Data, levelOf, NATIONAL, stateOf } from "@/lib/data";
import type { Indicator } from "@/lib/types";
import { indicatorById, readingFor } from "@/lib/view";

interface Props {
  data: Data;
  territory: string | null;
  sector: string;
  onClose: () => void;
}

const YEAR = 2023;

function byId(data: Data, id: string): Indicator {
  const indicator = indicatorById(data, id);
  // The pipeline validates that every counterargument indicator is in the catalog.
  if (!indicator) throw new Error(`${id} is not in the catalog`);
  return indicator;
}

/** One measure with and without foreign capital, side by side, and how the states split. */
function Pair({
  data,
  name,
  foreign,
  domestic,
  territory,
  sector,
}: {
  data: Data;
  name: string;
  foreign: Indicator;
  domestic: Indicator;
  territory: string;
  sector: string;
}) {
  const sides = [
    { label: "Con capital extranjero", indicator: foreign },
    { label: "Sin capital extranjero", indicator: domestic },
  ].map((side) => ({
    ...side,
    reading: readingFor(data, side.indicator, sector, YEAR, territory),
  }));
  const count = pairCount(data, foreign.id, domestic.id, sector, YEAR);

  return (
    <section className="flex flex-col gap-2">
      <h3 className="text-sm font-medium">{name}</h3>
      <div className="grid grid-cols-2 gap-3">
        {sides.map(({ label, indicator, reading }) => (
          <div key={indicator.id} className="flex flex-col gap-0.5">
            <span className="text-xs text-muted-foreground">{label}</span>
            <span className="text-base font-semibold">
              {readingText(data, reading, indicator)}
            </span>
          </div>
        ))}
      </div>
      {count.of > 0 && (
        <p className="text-sm text-muted-foreground">
          La cifra con capital extranjero es mayor en {count.higher} y menor en{" "}
          {count.lower} de las {count.of} entidades con dato en los dos grupos
          {count.equal > 0 ? `; igual en ${count.equal}` : ""}.
        </p>
      )}
      <Method indicator={foreign} labelled />
      <Method indicator={domestic} labelled />
    </section>
  );
}

export function CounterargumentPanel({
  data,
  territory,
  sector,
  onClose,
}: Props) {
  const { counterargument } = data.catalog;
  const shown = territory ?? NATIONAL;
  // The pairs exist only by state; a municipality is read through its state.
  const pairPlace = levelOf(shown) === "municipality" ? stateOf(shown) : shown;
  const pairs = counterargument.pairs.map((pair) => ({
    ...pair,
    foreign: byId(data, pair.foreign),
    domestic: byId(data, pair.domestic),
  }));
  const singles = counterargument.single.map((id) => byId(data, id));
  const all = [...pairs.flatMap((p) => [p.foreign, p.domestic]), ...singles];

  return (
    <div className="flex flex-col gap-4 p-4">
      <div className="flex items-start justify-between gap-2">
        <div>
          <h2 className="text-2xl">{counterargument.title}</h2>
          <p className="text-xs text-muted-foreground">
            {pairPlace === NATIONAL ? "Nacional" : nameOf(data, pairPlace)}.{" "}
            {YEAR}. {sectorName(data, sector)}
          </p>
        </div>
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={onClose}
          aria-label="Cerrar el contraargumento"
        >
          <XIcon />
        </Button>
      </div>
      <p className="text-sm">{counterargument.description}</p>
      {pairPlace !== shown && (
        <p className="text-sm text-muted-foreground">
          Las comparaciones con y sin capital extranjero no se publican por
          municipio; se muestran las de {nameOf(data, pairPlace)}.
        </p>
      )}

      {pairs.map((pair) => (
        <div key={pair.name} className="flex flex-col gap-4">
          <Separator />
          <Pair
            data={data}
            name={pair.name}
            foreign={pair.foreign}
            domestic={pair.domestic}
            territory={pairPlace}
            sector={sector}
          />
        </div>
      ))}

      {singles.map((indicator) => (
        <div key={indicator.id} className="flex flex-col gap-4">
          <Separator />
          <Figure
            data={data}
            indicator={indicator}
            territory={shown}
            year={YEAR}
            sector={sector}
          />
          <Method indicator={indicator} labelled={false} />
        </div>
      ))}

      <Separator />
      <Sources data={data} indicators={all} year={YEAR} />
    </div>
  );
}
