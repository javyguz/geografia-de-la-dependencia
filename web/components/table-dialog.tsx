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
import { NATIONAL, type StateData } from "@/lib/data";
import type { Cell, Indicator } from "@/lib/types";
import { cellText, type MapPaint, type Resolved } from "@/lib/view";

interface Props {
  data: StateData;
  resolved: Resolved;
  paint: MapPaint;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/** The same numbers as the map, for readers who cannot use colour or a pointer. */
export function TableDialog({
  data,
  resolved,
  paint,
  open,
  onOpenChange,
}: Props) {
  const { indicator, indicator2, year } = resolved;
  const columns: { indicator: Indicator; cells: Map<string, Cell> }[] = [
    { indicator, cells: paint.cells },
  ];
  if (indicator2 && paint.cells2)
    columns.push({ indicator: indicator2, cells: paint.cells2 });

  const rows = [...data.territories.values()]
    .filter((t) => t.id !== NATIONAL)
    .sort((a, b) => a.name.localeCompare(b.name, "es"));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85dvh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{indicator.name}</DialogTitle>
          <DialogDescription>
            {indicator.year_note ?? year}. Entidades en orden alfabético.
          </DialogDescription>
        </DialogHeader>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Entidad</TableHead>
              {columns.map((column) => (
                <TableHead key={column.indicator.id} className="text-right">
                  {columns.length > 1 ? column.indicator.name : "Valor"}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((territory) => (
              <TableRow key={territory.id}>
                <TableCell>{territory.name}</TableCell>
                {columns.map((column) => {
                  const cell = column.cells.get(territory.id);
                  return (
                    <TableCell key={column.indicator.id} className="text-right">
                      {cell
                        ? cellText(data, cell, column.indicator)
                        : "Sin dato"}
                    </TableCell>
                  );
                })}
              </TableRow>
            ))}
            <TableRow>
              <TableCell className="font-medium">Nacional</TableCell>
              {columns.map((column) => {
                const cell = column.cells.get(NATIONAL);
                return (
                  <TableCell
                    key={column.indicator.id}
                    className="text-right font-medium"
                  >
                    {cell ? cellText(data, cell, column.indicator) : "Sin dato"}
                  </TableCell>
                );
              })}
            </TableRow>
          </TableBody>
        </Table>
      </DialogContent>
    </Dialog>
  );
}
