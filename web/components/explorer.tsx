"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ChatPanel } from "@/components/chat-panel";
import { CompareView } from "@/components/compare-view";
import { Controls } from "@/components/controls";
import { CounterargumentPanel } from "@/components/counterargument-panel";
import { DetailPanel } from "@/components/detail-panel";
import { Legend } from "@/components/legend";
import type { FocusRequest } from "@/components/map-view";
import { SiteHeader } from "@/components/site-header";
import { TableDialog } from "@/components/table-dialog";
import { TerritorySearch } from "@/components/territory-search";
import { TourPanel } from "@/components/tour-panel";
import { Button } from "@/components/ui/button";
import type { ToolHost } from "@/lib/bot/execute";
import { boundsByTerritory, MEXICO } from "@/lib/bounds";
import {
  type Data,
  type Initial,
  initialData,
  type Level,
  levelOf,
  loadMunicipalities,
  loadMunicipalSector,
  loadRest,
  NATIONAL,
  stateOf,
  valuesOf,
} from "@/lib/data";
import { paletteFor } from "@/lib/palettes";
import { STEPS, stepView } from "@/lib/tour";
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

// MapLibre is the largest part of the page's code. Loaded apart, it no longer holds
// back the controls, legend and panel, which appear as soon as the data arrives.
const MapView = dynamic(
  () => import("@/components/map-view").then((m) => m.MapView),
  {
    ssr: false,
    loading: () => (
      <p className="absolute inset-0 grid place-items-center text-sm text-muted-foreground">
        Cargando el mapa…
      </p>
    ),
  },
);

export function Explorer({ initial }: { initial: Initial }) {
  // The national view arrives in the HTML; nothing waits for a request to show figures.
  const [data, setData] = useState<Data>(() => initialData(initial));
  const [failed, setFailed] = useState(false);
  const [municipalFailed, setMunicipalFailed] = useState(false);
  const [state, setState] = useState<ViewState>(emptyState);
  const [urlRead, setUrlRead] = useState(false);
  const [tableOpen, setTableOpen] = useState(false);
  const [zoomedIn, setZoomedIn] = useState(false);
  const [focus, setFocus] = useState<FocusRequest | null>(null);
  const [chatOpen, setChatOpen] = useState(false);
  const [mapReady, setMapReady] = useState(false);
  // The assistant's tools run outside React's render, so they read the data from here.
  const dataRef = useRef(data);
  const pending = useRef(new Map<string, Promise<void>>());
  const theme = useTheme();
  const palette = paletteFor(theme);

  // The URL is read once on load, after hydration, so the server HTML never disagrees with it.
  useEffect(() => {
    setState(parseState(window.location.search));
    setUrlRead(true);
    loadRest().then(
      ({ territories, stateGeometry }) => {
        dataRef.current = {
          ...dataRef.current,
          territories: new Map(territories.map((t) => [t.id, t])),
          stateGeometry,
        };
        setData(dataRef.current);
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

  // The map's code is the heaviest on the page. It is asked for once the panel and
  // the legend have been painted, so on a slow phone the figures come first.
  useEffect(() => {
    if (!data.stateGeometry || mapReady) return;
    const frame = requestAnimationFrame(() =>
      setTimeout(() => setMapReady(true)),
    );
    return () => cancelAnimationFrame(frame);
  }, [data.stateGeometry, mapReady]);

  const update = useCallback((patch: Partial<ViewState>) => {
    setState((current) => ({ ...current, ...patch }));
  }, []);

  const resolved = useMemo(() => resolve(data, state), [data, state]);
  const stateBounds = useMemo(
    () => (data.stateGeometry ? boundsByTerritory(data.stateGeometry) : null),
    [data.stateGeometry],
  );

  const selected =
    state.territory &&
    state.territory !== NATIONAL &&
    data.territories.has(state.territory)
      ? state.territory
      : null;
  const compared = state.compare.filter(
    (id) => id !== NATIONAL && data.territories.has(id),
  );
  const comparing = state.mode === "compare";
  const municipal = hasMunicipalities(resolved);
  const sector = resolved.sector;
  const wantsMunicipal = municipal && zoomedIn;
  // Municipal values are needed to paint municipalities, and to describe any municipality on screen.
  const visible = [selected, ...(comparing ? compared : [])];
  const needsMunicipal =
    wantsMunicipal ||
    visible.some((id) => id !== null && levelOf(id) === "municipality");
  const level: Level =
    wantsMunicipal && valuesOf(data, "municipality", sector)
      ? "municipality"
      : "state";

  // Every change to the data goes through here, so the tools see it at once.
  const commit = useCallback((change: (d: Data) => Data) => {
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

  /** Shows a step of the tour: its view, framed on its place or on the whole country. */
  const goToStep = (index: number) => {
    const step = STEPS[index];
    if (!step) return;
    const view = stepView(step, index);
    setChatOpen(false);
    update(view);
    const next = resolve(data, { ...emptyState(), ...view });
    const bounds = view.territory
      ? stateBounds?.get(stateOf(view.territory))
      : undefined;
    setFocus({ bounds: bounds && hasMunicipalities(next) ? bounds : MEXICO });
  };

  const switchMode = (mode: Mode) => {
    if (mode === "tour") {
      goToStep(0);
      return;
    }
    // Entering the compare view with nothing to compare starts from the selected place.
    const seed = compared.length === 0 && selected ? [selected] : compared;
    update({ mode, compare: mode === "compare" ? seed : compared });
  };

  const paint = useMemo(
    () => paintFor(data, resolved, palette, level),
    [data, resolved, palette, level],
  );

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
          <div className="border-b bg-background p-2 md:absolute md:top-3 md:left-3 md:z-10 md:w-[420px] md:rounded-xl md:border md:p-3">
            <Controls data={data} resolved={resolved} onChange={update} />
          </div>
          <div className="relative min-h-40 flex-1 md:absolute md:inset-0 md:min-h-0">
            {failed && (
              <p className="absolute inset-0 grid place-items-center p-8 text-center text-sm text-muted-foreground">
                No se pudo cargar el mapa. Las cifras de la ficha y la tabla
                siguen disponibles; recarga la página para intentarlo de nuevo.
              </p>
            )}
            {mapReady && data.stateGeometry && (
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
            )}
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
          <div className="border-t bg-background md:absolute md:bottom-3 md:left-3 md:z-10 md:w-[300px] md:overflow-hidden md:rounded-xl md:border">
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
              : state.mode === "tour"
                ? "Recorrido"
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
          {chatOpen ? null : state.mode === "tour" ? (
            <TourPanel
              data={data}
              resolved={resolved}
              step={state.step}
              territory={selected}
              onStep={goToStep}
              onExit={() => update({ mode: "explore" })}
              onCounterargument={() =>
                update({ mode: "explore", counterargument: true })
              }
            />
          ) : state.counterargument ? (
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
