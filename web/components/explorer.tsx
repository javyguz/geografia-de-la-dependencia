"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ChatPanel } from "@/components/chat-panel";
import { CompareView } from "@/components/compare-view";
import { Controls } from "@/components/controls";
import { CounterargumentPanel } from "@/components/counterargument-panel";
import { DetailPanel } from "@/components/detail-panel";
import { Legend } from "@/components/legend";
import { type FocusRequest, MapView } from "@/components/map-view";
import { SiteHeader } from "@/components/site-header";
import { TableDialog } from "@/components/table-dialog";
import { TerritorySearch } from "@/components/territory-search";
import { Button } from "@/components/ui/button";
import type { ToolHost } from "@/lib/bot/execute";
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
  MAX_COMPARED,
  type Mode,
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
  const [chatOpen, setChatOpen] = useState(false);
  // The assistant's tools run outside React's render, so they read the data from here.
  const dataRef = useRef<Data | null>(null);
  const pending = useRef(new Map<string, Promise<void>>());
  const theme = useTheme();
  const palette = paletteFor(theme);

  // The URL is read once on load, after hydration, so the server HTML never disagrees with it.
  useEffect(() => {
    setState(parseState(window.location.search));
    setUrlRead(true);
    loadData().then(
      (loaded) => {
        dataRef.current = loaded;
        setData(loaded);
      },
      () => setFailed(true),
    );
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
  const compared = data
    ? state.compare.filter((id) => id !== NATIONAL && data.territories.has(id))
    : [];
  const comparing = state.mode === "compare";
  const municipal = resolved !== null && hasMunicipalities(resolved);
  const sector = resolved?.sector ?? "total";
  const wantsMunicipal = municipal && zoomedIn;
  // Municipal values are needed to paint municipalities, and to describe any municipality on screen.
  const visible = [selected, ...(comparing ? compared : [])];
  const needsMunicipal =
    wantsMunicipal ||
    visible.some((id) => id !== null && levelOf(id) === "municipality");
  const level: Level =
    data && wantsMunicipal && valuesOf(data, "municipality", sector)
      ? "municipality"
      : "state";

  // Every change to the data goes through here, so the tools see it at once.
  const commit = useCallback((change: (d: Data) => Data) => {
    if (!dataRef.current) return;
    dataRef.current = change(dataRef.current);
    setData(dataRef.current);
  }, []);

  /** Loads the municipal totals and, for a sector, its file. Each file is requested once. */
  const ensureMunicipal = useCallback(
    async (wanted: string) => {
      const once = (key: string, load: () => Promise<void>) => {
        let promise = pending.current.get(key);
        if (!promise) {
          promise = load();
          pending.current.set(key, promise);
          // A failed download may be retried later.
          promise.catch(() => pending.current.delete(key));
        }
        return promise;
      };
      await once("total", async () => {
        const municipal = await loadMunicipalities();
        commit((d) => ({ ...d, municipal }));
      });
      if (wanted === "total") return;
      await once(wanted, async () => {
        const file = await loadMunicipalSector(wanted);
        commit((d) =>
          d.municipal
            ? {
                ...d,
                municipal: {
                  ...d.municipal,
                  sectors: new Map(d.municipal.sectors).set(wanted, file),
                },
              }
            : d,
        );
      });
    },
    [commit],
  );

  useEffect(() => {
    if (needsMunicipal)
      ensureMunicipal(sector).catch(() => setMunicipalFailed(true));
  }, [needsMunicipal, sector, ensureMunicipal]);

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

  const host = useMemo<ToolHost>(
    () => ({
      data: () => dataRef.current as Data,
      ensureMunicipal,
      show: (view) => {
        update(view);
        // Like a click on the map: a place shown with municipal data is entered.
        const indicator = dataRef.current?.catalog.indicators.find(
          (i) => i.id === (view.indicator ?? view.indicator2),
        );
        const bounds = view.territory
          ? stateBounds?.get(stateOf(view.territory))
          : undefined;
        if (bounds && indicator?.levels.includes("municipality"))
          setFocus({ bounds });
      },
    }),
    [ensureMunicipal, update, stateBounds],
  );

  const switchMode = (mode: Mode) => {
    // Entering the compare view with nothing to compare starts from the selected place.
    const seed = compared.length === 0 && selected ? [selected] : compared;
    update({ mode, compare: mode === "compare" ? seed : compared });
  };

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
  const sectorLabel =
    data.catalog.sectors.find((s) => s.id === sector)?.name ?? sector;
  const screen = `capa «${resolved.layer.question}», indicador «${resolved.indicator.name}» (${resolved.indicator.id}), sector «${sectorLabel}», año ${resolved.year}; ${
    selected
      ? `territorio seleccionado: ${data.territories.get(selected)?.name} (clave ${selected})`
      : "sin territorio seleccionado"
  }.`;
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
      <SiteHeader
        current={state.mode}
        onMode={(mode) => {
          if (mode === "compare") setChatOpen(false);
          switchMode(mode);
        }}
      >
        <Button
          variant={chatOpen ? "secondary" : "outline"}
          aria-pressed={chatOpen}
          onClick={() => {
            // The assistant sits beside the map, so it brings the reader back to it.
            setChatOpen(!chatOpen);
            update({ mode: "explore", counterargument: false });
          }}
        >
          Preguntar
        </Button>
        <TerritorySearch
          collapse
          territories={data.territories}
          onSelect={(id) => {
            update({ territory: id, mode: "explore" });
            enter(id);
          }}
        />
      </SiteHeader>
      {/* The compare view covers the map instead of replacing it, so the map keeps its place. */}
      <div className="relative flex min-h-0 flex-1 flex-col md:flex-row">
        {comparing && (
          <section
            aria-label="Comparación"
            className="absolute inset-0 z-20 bg-background"
          >
            <CompareView
              data={data}
              territories={compared}
              onChange={(ids) => update({ compare: ids })}
            />
          </section>
        )}
        {/* On a phone the assistant needs the whole screen; what it puts on the map is there when it closes. */}
        <main
          className={`relative flex min-h-0 flex-1 flex-col bg-canvas ${chatOpen ? "max-md:hidden" : ""}`}
        >
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
                className="absolute top-2 right-2 z-10 md:top-3 md:right-3"
                onClick={() => setFocus({ bounds: MEXICO })}
              >
                Ver todo el país
              </Button>
            )}
            {/* Always on screen: the data that cuts against the thesis is not tucked away. */}
            <Button
              size="sm"
              aria-pressed={state.counterargument}
              className="absolute right-2 bottom-2 z-10 md:right-3 md:bottom-3"
              onClick={() => {
                setChatOpen(false);
                update({ counterargument: !state.counterargument });
              }}
            >
              El contraargumento
            </Button>
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
          aria-label={
            chatOpen
              ? "Asistente"
              : state.counterargument
                ? "El contraargumento"
                : "Ficha"
          }
          className={`flex shrink-0 flex-col border-t bg-background md:max-h-none md:w-[360px] md:border-t-0 md:border-l ${chatOpen ? "max-md:min-h-0 max-md:flex-1" : "max-h-[36%] overflow-y-auto"}`}
        >
          {/* Kept mounted while closed, so the conversation survives closing the panel. */}
          <div className={chatOpen ? "flex min-h-0 flex-1 flex-col" : "hidden"}>
            <ChatPanel
              host={host}
              onScreen={screen}
              onClose={() => setChatOpen(false)}
            />
          </div>
          {chatOpen ? null : state.counterargument ? (
            <CounterargumentPanel
              data={data}
              territory={selected}
              sector={sector}
              onClose={() => update({ counterargument: false })}
            />
          ) : (
            <DetailPanel
              data={data}
              resolved={resolved}
              territory={selected}
              onClose={() => update({ territory: null })}
              onCompare={
                selected && !compared.includes(selected)
                  ? () =>
                      update({
                        mode: "compare",
                        compare: [...compared, selected].slice(-MAX_COMPARED),
                      })
                  : undefined
              }
            />
          )}
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
