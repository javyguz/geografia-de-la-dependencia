"use client";

import { SearchIcon } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { NATIONAL } from "@/lib/data";
import type { Territory } from "@/lib/types";

/** Lower case without accents, so "Mexico" finds "México". */
function plain(text: string): string {
  return text
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase();
}

interface Props {
  territories: Map<string, Territory>;
  onSelect: (id: string) => void;
}

export function TerritorySearch({ territories, onSelect }: Props) {
  const [open, setOpen] = useState(false);
  const list = [...territories.values()].filter((t) => t.id !== NATIONAL);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          className="w-48 justify-start font-normal text-muted-foreground"
        >
          <SearchIcon data-icon="inline-start" />
          Buscar entidad
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-64 p-0">
        <Command
          filter={(value, search) =>
            plain(value).includes(plain(search)) ? 1 : 0
          }
        >
          <CommandInput placeholder="Nombre de la entidad" />
          <CommandList>
            <CommandEmpty>No hay una entidad con ese nombre.</CommandEmpty>
            <CommandGroup>
              {list.map((territory) => (
                <CommandItem
                  key={territory.id}
                  value={territory.name}
                  onSelect={() => {
                    onSelect(territory.id);
                    setOpen(false);
                  }}
                >
                  {territory.name}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
