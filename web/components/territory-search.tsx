"use client";

import { SearchIcon } from "lucide-react";
import { useMemo, useState } from "react";
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
import { searchTerritories } from "@/lib/search";
import type { Territory } from "@/lib/types";

interface Props {
  territories: Map<string, Territory>;
  onSelect: (id: string) => void;
}

export function TerritorySearch({ territories, onSelect }: Props) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const list = useMemo(
    () => [...territories.values()].filter((t) => t.id !== NATIONAL),
    [territories],
  );
  const found = searchTerritories(list, query);
  const pick = (id: string) => {
    onSelect(id);
    setOpen(false);
    setQuery("");
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          className="w-48 justify-start font-normal text-muted-foreground"
        >
          <SearchIcon data-icon="inline-start" />
          Buscar lugar
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-72 p-0">
        {/* The list is filtered here, not by cmdk, so it never renders 2,500 options. */}
        <Command shouldFilter={false}>
          <CommandInput
            placeholder="Entidad o municipio"
            value={query}
            onValueChange={setQuery}
          />
          <CommandList>
            <CommandEmpty>
              No hay una entidad ni un municipio con ese nombre.
            </CommandEmpty>
            <CommandGroup>
              {found.map((territory) => (
                <CommandItem
                  key={territory.id}
                  value={territory.id}
                  onSelect={() => pick(territory.id)}
                >
                  <span>{territory.name}</span>
                  {territory.level === "municipality" && (
                    <span className="text-muted-foreground">
                      {territories.get(territory.state)?.name}
                    </span>
                  )}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
