"use client";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { type Data, type Level, NATIONAL, stateOf } from "@/lib/data";
import type { Cell, Indicator, Territory } from "@/lib/types";
import { cellsFor, cellText, type MapPaint, type Resolved } from "@/lib/view";

interface Props {
  data: Data;
  resolved: Resolved;
  paint: MapPaint;
  level: Level;
  selected: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface Column {
  indicator: Indicator;
  /** Values of the level on the map. */
  cells: Map<string, Cell>;
  /** State and national values, for the summary rows. */
  states: Map<string, Cell>;
}

function Row({
  data,
  territory,
  columns,
  source,
  showState,
  strong,
}: {
  data: Data;
  territory: Territory;
  columns: Column[];
  source: "cells" | "states";
  showState: boolean;
  strong?: boolean;
}) {
  const weight = strong ? "font-medium" : "";
  return (
    <TableRow>
      <TableCell className={weight}>{territory.name}</TableCell>
      {showState && (
        <TableCell className="text-muted-foreground">
          {territory.level === "municipality" &&
            data.territories.get(territory.state)?.name}
        </TableCell>
      )}
      {columns.map((column) => {
        const cell = column[source].get(territory.id);
        return (
          <TableCell
            key={column.indicator.id}
            className={`text-right ${weight}`}
          >
            {cell ? cellText(data, cell, column.indicator) : "Sin dato"}
          </TableCell>
        );
      })}
    </TableRow>
  );
}

/** The same numbers as the map, for readers who cannot use colour or a pointer. */
export function TableDialog({
  data,
  resolved,
  paint,
  level,
  selected,
  open,
  onOpenChange,
}: Props) {
  const { indicator, indicator2, sector, year } = resolved;
  const column = (i: Indicator, cells: Map<string, Cell>, s: string) => ({
    indicator: i,
    cells,
    states: cellsFor(data, "state", i.id, s, year) ?? new Map(),
  });
  const columns: Column[] = [column(indicator, paint.cells, sector)];
  if (indicator2 && paint.cells2)
    columns.push(column(indicator2, paint.cells2, "total"));

  // Among municipalities, the table keeps to the selected state when there is one.
  const state = level === "municipality" && selected ? stateOf(selected) : null;
  const stateName = (t: Territory) =>
    t.level === "municipality"
      ? (data.territories.get(t.state)?.name ?? "")
      : "";
  const rows = [...data.territories.values()]
    .filter(
      (t) =>
        t.id !== NATIONAL &&
        t.level === level &&
        (state === null || t.state === state),
    )
    .sort(
      (a, b) =>
        stateName(a).localeCompare(stateName(b), "es") ||
        a.name.localeCompare(b.name, "es"),
    );
  const showState = level === "municipality" && state === null;
  const summary = [state, NATIONAL]
    .map((id) => (id ? data.territories.get(id) : undefined))
    .filter((t): t is Territory => t !== undefined);
  const description =
    level === "state"
      ? "Entidades en orden alfabético."
      : state
        ? `Municipios de ${data.territories.get(state)?.name} en orden alfabético.`
        : `Los ${rows.length.toLocaleString("es-MX")} municipios, por entidad y en orden alfabético.`;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85dvh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{indicator.name}</DialogTitle>
          <DialogDescription>
            {indicator.year_note ?? year}. {description}
          </DialogDescription>
        </DialogHeader>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>
                {level === "state" ? "Entidad" : "Municipio"}
              </TableHead>
              {showState && <TableHead>Entidad</TableHead>}
              {columns.map((c) => (
                <TableHead key={c.indicator.id} className="text-right">
                  {columns.length > 1 ? c.indicator.name : "Valor"}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((territory) => (
              <Row
                key={territory.id}
                data={data}
                territory={territory}
                columns={columns}
                source="cells"
                showState={showState}
              />
            ))}
            {summary.map((territory) => (
              <Row
                key={territory.id}
                data={data}
                territory={territory}
                columns={columns}
                source="states"
                showState={showState}
                strong
              />
            ))}
          </TableBody>
        </Table>
      </DialogContent>
    </Dialog>
  );
}
