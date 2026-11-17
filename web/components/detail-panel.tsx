"use client";

import { XIcon } from "lucide-react";
import {
  Figure,
  kindOf,
  Line,
  Method,
  nameOf,
  Sources,
} from "@/components/indicator-parts";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { type Data, NATIONAL } from "@/lib/data";
import type { Indicator } from "@/lib/types";
import { indicatorById, isBivariate, type Resolved } from "@/lib/view";

interface Props {
  data: Data;
  resolved: Resolved;
  territory: string | null;
  onClose: () => void;
  /** Adds the territory to the compare view; absent when it is already there. */
  onCompare?: () => void;
}

export function DetailPanel({
  data,
  resolved,
  territory,
  onClose,
  onCompare,
}: Props) {
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
          <div className="flex shrink-0 items-center gap-1">
            {onCompare && (
              <Button variant="outline" size="sm" onClick={onCompare}>
                Comparar
              </Button>
            )}
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={onClose}
              aria-label="Quitar selección"
            >
              <XIcon />
            </Button>
          </div>
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
