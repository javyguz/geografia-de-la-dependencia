"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Controls } from "@/components/controls";
import { DetailPanel } from "@/components/detail-panel";
import { Legend } from "@/components/legend";
import { type FocusRequest, MapView } from "@/components/map-view";
import { TableDialog } from "@/components/table-dialog";
import { TerritorySearch } from "@/components/territory-search";
import { Button } from "@/components/ui/button";
import { boundsByTerritory, MEXICO } from "@/lib/bounds";
import {
  type Data,
  type Level,
  levelOf,
  loadData,
  loadMunicipalities,
  loadMunicipalSector,
  NATIONAL,
  stateOf,
  valuesOf,
} from "@/lib/data";
import { paletteFor } from "@/lib/palettes";
import {
  emptyState,
  parseState,
  serializeState,
  type ViewState,
} from "@/lib/url-state";
import { useTheme } from "@/lib/use-theme";
import { hasMunicipalities, paintFor, resolve } from "@/lib/view";

export function Explorer() {
  const [data, setData] = useState<Data | null>(null);
  const [failed, setFailed] = useState(false);
  const [municipalFailed, setMunicipalFailed] = useState(false);
  const [state, setState] = useState<ViewState>(emptyState);
  const [urlRead, setUrlRead] = useState(false);
  const [tableOpen, setTableOpen] = useState(false);
  const [zoomedIn, setZoomedIn] = useState(false);
  const [focus, setFocus] = useState<FocusRequest | null>(null);
  const requested = useRef(new Set<string>());
  const theme = useTheme();
  const palette = paletteFor(theme);

  // The URL is read once on load, after hydration, so the server HTML never disagrees with it.
  useEffect(() => {
    setState(parseState(window.location.search));
    setUrlRead(true);
    loadData().then(setData, () => setFailed(true));
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
  const stateBounds = useMemo(
    () => (data ? boundsByTerritory(data.stateGeometry) : null),
    [data],
  );

  const selected =
    data &&
    state.territory &&
    state.territory !== NATIONAL &&
    data.territories.has(state.territory)
      ? state.territory
      : null;
  const municipal = resolved !== null && hasMunicipalities(resolved);
  const sector = resolved?.sector ?? "total";
  const wantsMunicipal = municipal && zoomedIn;
  const needsMunicipal =
    municipal &&
    (zoomedIn || (selected !== null && levelOf(selected) === "municipality"));
  const level: Level =
    data && wantsMunicipal && valuesOf(data, "municipality", sector)
      ? "municipality"
      : "state";

  // Municipal files load the first time they are needed: geometry and totals together, then each sector once.
  const hasMunicipalData = data?.municipal != null;
  useEffect(() => {
    if (!needsMunicipal) return;
    const fail = () => setMunicipalFailed(true);
    if (!hasMunicipalData) {
      if (requested.current.has("total")) return;
      requested.current.add("total");
      loadMunicipalities().then(
        (municipal) => setData((d) => d && { ...d, municipal }),
        fail,
      );
    } else if (sector !== "total" && !requested.current.has(sector)) {
      requested.current.add(sector);
      loadMunicipalSector(sector).then(
        (file) =>
          setData((d) =>
            d?.municipal
              ? {
                  ...d,
                  municipal: {
                    ...d.municipal,
                    sectors: new Map(d.municipal.sectors).set(sector, file),
                  },
                }
              : d,
          ),
        fail,
      );
    }
  }, [needsMunicipal, hasMunicipalData, sector]);

  /** Frames the state of a territory, when there are municipalities to show in it. */
  const enter = useCallback(
    (territory: string) => {
      const bounds = stateBounds?.get(stateOf(territory));
      if (bounds && municipal) setFocus({ bounds });
    },
    [stateBounds, municipal],
  );

  // A shared link that names a territory opens inside its state.
  const entered = useRef(false);
  useEffect(() => {
    if (entered.current || !stateBounds) return;
    entered.current = true;
    if (selected) enter(selected);
  }, [stateBounds, selected, enter]);

  const paint = useMemo(
    () => (data && resolved ? paintFor(data, resolved, palette, level) : null),
    [data, resolved, palette, level],
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

  // At the state level a selected municipality is outlined through its state.
  const onMap =
    selected && level === "state" && levelOf(selected) === "municipality"
      ? stateOf(selected)
      : selected;
  const scope =
    level === "municipality"
      ? "Por municipio"
      : zoomedIn && !municipal
        ? "Este indicador solo se publica por entidad"
        : wantsMunicipal
          ? municipalFailed
            ? "No se pudieron cargar los municipios"
            : "Cargando municipios…"
          : "Por entidad";

  return (
    <div className="flex h-dvh flex-col">
      <header className="flex h-12 shrink-0 items-center justify-between gap-3 border-b bg-background px-4">
        <h1 className="truncate text-sm font-semibold">
          Geografía de la dependencia
        </h1>
        <TerritorySearch
          territories={data.territories}
          onSelect={(id) => {
            update({ territory: id });
            enter(id);
          }}
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
              stateGeometry={data.stateGeometry}
              municipalGeometry={data.municipal?.geometry ?? null}
              level={level}
              palette={palette}
              fills={paint.fills}
              missing={paint.missing}
              selected={onMap}
              focus={focus}
              onSelect={(id) => {
                update({ territory: id });
                // Clicking a state enters it; inside, clicks pick municipalities.
                if (id && level === "state") enter(id);
              }}
              onZoomedInChange={setZoomedIn}
            />
            {zoomedIn && (
              <Button
                variant="secondary"
                size="sm"
                className="absolute right-2 bottom-2 z-10 md:right-3 md:bottom-3"
                onClick={() => setFocus({ bounds: MEXICO })}
              >
                Ver todo el país
              </Button>
            )}
          </div>
          <div className="border-t bg-background md:absolute md:bottom-3 md:left-3 md:z-10 md:w-[300px] md:border">
            <Legend
              data={data}
              resolved={resolved}
              paint={paint}
              palette={palette}
              selected={onMap}
              scope={scope}
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
            territory={selected}
            onClose={() => update({ territory: null })}
          />
        </aside>
      </div>
      <TableDialog
        data={data}
        resolved={resolved}
        paint={paint}
        level={level}
        selected={selected}
        open={tableOpen}
        onOpenChange={setTableOpen}
      />
    </div>
  );
}
