"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Controls } from "@/components/controls";
import { DetailPanel } from "@/components/detail-panel";
import { Legend } from "@/components/legend";
import { MapView } from "@/components/map-view";
import { TableDialog } from "@/components/table-dialog";
import { TerritorySearch } from "@/components/territory-search";
import { loadStateData, type StateData } from "@/lib/data";
import { paletteFor } from "@/lib/palettes";
import {
  emptyState,
  parseState,
  serializeState,
  type ViewState,
} from "@/lib/url-state";
import { useTheme } from "@/lib/use-theme";
import { paintFor, resolve } from "@/lib/view";

export function Explorer() {
  const [data, setData] = useState<StateData | null>(null);
  const [failed, setFailed] = useState(false);
  const [state, setState] = useState<ViewState>(emptyState);
  const [urlRead, setUrlRead] = useState(false);
  const [tableOpen, setTableOpen] = useState(false);
  const theme = useTheme();
  const palette = paletteFor(theme);

  // The URL is read once on load, after hydration, so the server HTML never disagrees with it.
  useEffect(() => {
    setState(parseState(window.location.search));
    setUrlRead(true);
    loadStateData().then(setData, () => setFailed(true));
  }, []);

  useEffect(() => {
    if (!urlRead) return;
    window.history.replaceState(
      null,
      "",
      `${window.location.pathname}${serializeState(state)}`,
    );
  }, [state, urlRead]);

  const update = useCallback((patch: Partial<ViewState>) => {
    setState((current) => ({ ...current, ...patch }));
  }, []);

  const resolved = useMemo(
    () => (data ? resolve(data, state) : null),
    [data, state],
  );
  const paint = useMemo(
    () => (data && resolved ? paintFor(data, resolved, palette) : null),
    [data, resolved, palette],
  );

  if (failed) {
    return (
      <main className="grid h-dvh place-items-center p-8 text-center">
        <p>
          No se pudieron cargar los datos. Recarga la página para intentarlo de
          nuevo.
        </p>
      </main>
    );
  }
  if (!data || !resolved || !paint) {
    return (
      <main className="grid h-dvh place-items-center text-muted-foreground">
        <p>Cargando datos…</p>
      </main>
    );
  }

  const selected =
    state.territory && data.territories.has(state.territory)
      ? state.territory
      : null;

  return (
    <div className="flex h-dvh flex-col">
      <header className="flex h-12 shrink-0 items-center justify-between gap-3 border-b bg-background px-4">
        <h1 className="truncate text-sm font-semibold">
          Geografía de la dependencia
        </h1>
        <TerritorySearch
          territories={data.territories}
          onSelect={(id) => update({ territory: id })}
        />
      </header>
      <div className="flex min-h-0 flex-1 flex-col md:flex-row">
        <main className="relative flex min-h-0 flex-1 flex-col bg-canvas">
          {/* On small screens the controls, map and legend stack; from md up the
              controls and legend float over a full-bleed map. */}
          <div className="border-b bg-background p-2 md:absolute md:top-3 md:left-3 md:z-10 md:w-[420px] md:border md:p-3">
            <Controls data={data} resolved={resolved} onChange={update} />
          </div>
          <div className="relative min-h-40 flex-1 md:absolute md:inset-0 md:min-h-0">
            <MapView
              geometry={data.geometry}
              palette={palette}
              fills={paint.fills}
              missing={paint.missing}
              selected={selected}
              onSelect={(id) => update({ territory: id })}
            />
          </div>
          <div className="border-t bg-background md:absolute md:bottom-3 md:left-3 md:z-10 md:w-[300px] md:border">
            <Legend
              data={data}
              resolved={resolved}
              paint={paint}
              palette={palette}
              selected={selected}
              onOpenTable={() => setTableOpen(true)}
            />
          </div>
        </main>
        <aside
          aria-label="Ficha"
          className="max-h-[36%] shrink-0 overflow-y-auto border-t bg-background md:max-h-none md:w-[360px] md:border-t-0 md:border-l"
        >
          <DetailPanel
            data={data}
            resolved={resolved}
            paint={paint}
            territory={selected}
            onClose={() => update({ territory: null })}
          />
        </aside>
      </div>
      <TableDialog
        data={data}
        resolved={resolved}
        paint={paint}
        open={tableOpen}
        onOpenChange={setTableOpen}
      />
    </div>
  );
}
