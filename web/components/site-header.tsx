"use client";

import { MenuIcon } from "lucide-react";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { Mode } from "@/lib/url-state";

export type Page = Mode | "methodology";

interface Item {
  page: Page;
  label: string;
  href: string;
}

const ITEMS: Item[] = [
  { page: "explore", label: "Explorar", href: "/" },
  { page: "compare", label: "Comparar", href: "/?modo=comparar" },
  { page: "tour", label: "Recorrido", href: "/?modo=recorrido" },
  { page: "methodology", label: "Metodología", href: "/metodologia" },
];

interface Props {
  current: Page;
  /** Inside the explorer, modes switch in place and keep the rest of the state. */
  onMode?: (mode: Mode) => void;
  children?: ReactNode;
}

export function SiteHeader({ current, onMode, children }: Props) {
  const inPlace = (page: Page): page is Mode =>
    onMode !== undefined && page !== "methodology";

  return (
    <header className="flex h-12 shrink-0 items-center gap-3 border-b bg-background px-4">
      <h1 className="min-w-0 flex-1 truncate text-sm font-semibold md:flex-none">
        <a href="/">Geografía de la dependencia</a>
      </h1>
      <nav aria-label="Secciones" className="hidden flex-1 gap-1 md:flex">
        {ITEMS.map((item) => {
          const active = item.page === current;
          const shared = {
            variant: active ? ("secondary" as const) : ("ghost" as const),
            size: "sm" as const,
            "aria-current": active ? ("page" as const) : undefined,
          };
          return inPlace(item.page) ? (
            <Button
              key={item.page}
              {...shared}
              onClick={() => onMode?.(item.page as Mode)}
            >
              {item.label}
            </Button>
          ) : (
            <Button key={item.page} {...shared} asChild>
              <a href={item.href}>{item.label}</a>
            </Button>
          );
        })}
      </nav>
      {children}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="md:hidden"
            aria-label="Secciones"
          >
            <MenuIcon />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuGroup>
            {ITEMS.map((item) =>
              inPlace(item.page) ? (
                <DropdownMenuItem
                  key={item.page}
                  onSelect={() => onMode?.(item.page as Mode)}
                  aria-current={item.page === current ? "page" : undefined}
                >
                  {item.label}
                </DropdownMenuItem>
              ) : (
                <DropdownMenuItem key={item.page} asChild>
                  <a
                    href={item.href}
                    aria-current={item.page === current ? "page" : undefined}
                  >
                    {item.label}
                  </a>
                </DropdownMenuItem>
              ),
            )}
          </DropdownMenuGroup>
        </DropdownMenuContent>
      </DropdownMenu>
    </header>
  );
}
