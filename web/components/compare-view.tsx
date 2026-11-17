"use client";

import { XIcon } from "lucide-react";
import { kindOf, nameOf, readingText } from "@/components/indicator-parts";
import { TerritorySearch } from "@/components/territory-search";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { compareSections } from "@/lib/compare";
import { type Data, NATIONAL } from "@/lib/data";
import type { Indicator } from "@/lib/types";
import { MAX_COMPARED } from "@/lib/url-state";
import { readingFor } from "@/lib/view";

// On a phone the table scrolls sideways; the indicator column stays put so each value keeps its name.
const STICKY = "sticky left-0 z-10 w-2/5 min-w-40 bg-background";

interface Props {
  data: Data;
  territories: string[];
  onChange: (territories: string[]) => void;
}

/** Each indicator in its latest year and for all sectors, so every column reads the same series. */
function Value({
  data,
  indicator,
  territory,
}: {
  data: Data;
  indicator: Indicator;
  territory: string;
}) {
  const reading = readingFor(
    data,
    indicator,
    "total",
    Math.max(...indicator.years),
    territory,
  );
  return (
    <>
      {readingText(data, reading, indicator)}
      {reading.fromState && (
        <span className="block text-xs text-muted-foreground">
          {nameOf(data, reading.territory)}
        </span>
      )}
    </>
  );
}

export function CompareView({ data, territories, onChange }: Props) {
  const columns = [...territories, NATIONAL];
  const sections = compareSections(data);

  return (
    <div className="flex h-full flex-col gap-4 overflow-y-auto p-4 md:p-6">
      <div className="flex flex-col gap-3">
        <div>
          <h2 className="text-xl font-semibold">Comparar</h2>
          <p className="text-sm text-muted-foreground">
            Hasta {MAX_COMPARED} lugares en todos los indicadores, en su año más
            reciente y para todos los sectores. Un indicador que no se publica
            por municipio muestra el valor de su entidad, con su nombre debajo.
          </p>
        </div>
        <ul className="flex flex-wrap items-center gap-2">
          {territories.map((id) => (
            <li
              key={id}
              className="flex items-center gap-1 rounded-sm border py-1 pr-1 pl-3 text-sm"
            >
              {nameOf(data, id)}
              <Button
                variant="ghost"
                size="icon-xs"
                aria-label={`Quitar ${nameOf(data, id)}`}
                onClick={() => onChange(territories.filter((t) => t !== id))}
              >
                <XIcon />
              </Button>
            </li>
          ))}
          {territories.length < MAX_COMPARED && (
            <li>
              <TerritorySearch
                label="Añadir lugar"
                territories={data.territories}
                onSelect={(id) =>
                  !territories.includes(id) && onChange([...territories, id])
                }
              />
            </li>
          )}
        </ul>
      </div>

      {territories.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Añade una entidad o un municipio para empezar. La columna nacional
          sirve de referencia.
        </p>
      ) : (
        <Table className="min-w-[640px]">
          <TableHeader>
            <TableRow>
              <TableHead className={STICKY}>Indicador</TableHead>
              {columns.map((id) => (
                <TableHead key={id} className="text-right align-bottom">
                  <span className="block">
                    {id === NATIONAL ? "Nacional" : nameOf(data, id)}
                  </span>
                  {id !== NATIONAL && (
                    <span className="block text-xs font-normal text-muted-foreground">
                      {kindOf(data, id)}
                    </span>
                  )}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          {sections.map((section) => (
            <TableBody key={section.title}>
              <TableRow className="hover:bg-transparent">
                <TableCell
                  colSpan={columns.length + 1}
                  className="pt-6 font-medium"
                >
                  {/* The row spans the whole table; the title sticks so it stays in view when scrolled. */}
                  <span className="sticky left-2">{section.title}</span>
                </TableCell>
              </TableRow>
              {section.indicators.map((indicator) => (
                <TableRow key={indicator.id}>
                  <TableCell className={`${STICKY} whitespace-normal`}>
                    <a
                      href={`/metodologia#${indicator.id}`}
                      className="underline-offset-2 hover:underline"
                    >
                      {indicator.name}
                    </a>
                    <span className="block text-xs text-muted-foreground">
                      {indicator.year_note ?? Math.max(...indicator.years)}
                    </span>
                  </TableCell>
                  {columns.map((id) => (
                    <TableCell key={id} className="text-right align-top">
                      <Value data={data} indicator={indicator} territory={id} />
                    </TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          ))}
        </Table>
      )}
    </div>
  );
}
