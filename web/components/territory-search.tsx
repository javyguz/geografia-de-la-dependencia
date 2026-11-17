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
  label?: string;
  /** Shows only the icon on phones, where the header has no room for the label. */
  collapse?: boolean;
}

export function TerritorySearch({
  territories,
  onSelect,
  label = "Buscar lugar",
  collapse = false,
}: Props) {
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
          aria-label={label}
          className="justify-start font-normal text-muted-foreground sm:w-48"
        >
          <SearchIcon data-icon="inline-start" />
          <span className={collapse ? "max-sm:sr-only" : undefined}>
            {label}
          </span>
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
