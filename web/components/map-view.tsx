"use client";

import "maplibre-gl/dist/maplibre-gl.css";
import type { FeatureCollection } from "geojson";
import * as maplibregl from "maplibre-gl";
import { useEffect, useRef } from "react";
import { type Bounds, MEXICO } from "@/lib/bounds";
import type { Level } from "@/lib/data";
import type { Palette } from "@/lib/palettes";
import type { MissingReason } from "@/lib/types";

const SOURCES: Record<Level, string> = {
  state: "states",
  municipality: "municipalities",
};
const EMPTY: FeatureCollection = { type: "FeatureCollection", features: [] };

// MapLibre looks for its worker next to its own file, but the bundler renames
// that file, so the worker is declared here as an asset of the build.
maplibregl.setWorkerUrl(
  new URL("maplibre-gl/dist/maplibre-gl-worker.mjs", import.meta.url).href,
);

/** A request to frame some bounds; a new object each time, so the same bounds can be asked twice. */
export interface FocusRequest {
  bounds: Bounds;
}

interface Props {
  stateGeometry: FeatureCollection;
  municipalGeometry: FeatureCollection | null;
  level: Level;
  palette: Palette;
  fills: Map<string, string>;
  missing: Map<string, MissingReason>;
  selected: string | null;
  focus: FocusRequest | null;
  onSelect: (id: string | null) => void;
  /** Reports whether the map is close enough to show municipalities. */
  onZoomedInChange: (zoomedIn: boolean) => void;
}

/** A square tile of diagonal lines, used to mark territories without a value. */
function hatch(
  background: string,
  line: string,
  direction: 45 | 135,
): ImageData {
  const size = 8;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const context = canvas.getContext("2d") as CanvasRenderingContext2D;
  context.fillStyle = background;
  context.fillRect(0, 0, size, size);
  context.strokeStyle = line;
  context.lineWidth = 1.5;
  context.beginPath();
  // Three segments per tile so the lines continue across tile edges.
  const [x1, y1, x2, y2] =
    direction === 45 ? [0, size, size, 0] : [0, 0, size, size];
  for (const shift of [-size, 0, size]) {
    context.moveTo(x1 + shift, y1);
    context.lineTo(x2 + shift, y2);
  }
  context.stroke();
  return context.getImageData(0, 0, size, size);
}

function fillExpression(
  fills: Map<string, string>,
  fallback: string,
): string | maplibregl.ExpressionSpecification {
  const byColor = new Map<string, string[]>();
  for (const [id, color] of fills)
    byColor.set(color, [...(byColor.get(color) ?? []), id]);
  if (byColor.size === 0) return fallback;
  const expression: unknown[] = ["match", ["get", "CVEGEO"]];
  for (const [color, ids] of byColor) expression.push(ids, color);
  expression.push(fallback);
  return expression as maplibregl.ExpressionSpecification;
}

function idsFilter(ids: string[]): maplibregl.FilterSpecification {
  return ["in", ["get", "CVEGEO"], ["literal", ids]];
}

/** Room the map keeps around what it frames, so the floating controls do not cover it. */
function padding(): maplibregl.PaddingOptions {
  // Same breakpoint as the layout in explorer.tsx (Tailwind `md`).
  return window.matchMedia("(min-width: 768px)").matches
    ? { top: 150, left: 24, bottom: 24, right: 24 }
    : { top: 8, left: 8, bottom: 8, right: 8 };
}

/**
 * Zoom from which municipalities are drawn: half a step closer than the whole
 * country. Low enough that the largest states, framed whole, already show them.
 */
function municipalZoom(map: maplibregl.Map): number {
  const whole = map.cameraForBounds(MEXICO, { padding: padding() });
  return (whole?.zoom ?? 4) + 0.5;
}

export function MapView(props: Props) {
  const container = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const readyRef = useRef(false);
  const latest = useRef(props);
  latest.current = props;

  // Paints everything that depends on props. Safe to call any number of times.
  const paint = useRef(() => {});
  paint.current = () => {
    const map = mapRef.current;
    if (!map || !readyRef.current) return;
    const { palette, fills, missing, selected, level } = latest.current;

    for (const direction of [45, 135] as const) {
      const name = `hatch-${direction}`;
      if (map.hasImage(name)) map.removeImage(name);
      map.addImage(name, hatch(palette.noData, palette.noDataHatch, direction));
    }
    map.setPaintProperty("background", "background-color", palette.canvas);

    const confidential = [...missing]
      .filter(([, r]) => r === "confidential")
      .map(([id]) => id);
    const others = [...missing]
      .filter(([, r]) => r !== "confidential")
      .map(([id]) => id);
    for (const each of ["state", "municipality"] as const) {
      const visibility = each === level ? "visible" : "none";
      for (const layer of ["fill", "missing-other", "missing-confidential"])
        map.setLayoutProperty(`${each}-${layer}`, "visibility", visibility);
    }
    map.setPaintProperty(
      `${level}-fill`,
      "fill-color",
      fillExpression(fills, palette.noData),
    );
    map.setFilter(`${level}-missing-confidential`, idsFilter(confidential));
    map.setFilter(`${level}-missing-other`, idsFilter(others));

    // Among municipalities, state lines are drawn darker so each state stays readable.
    const municipal = level === "municipality";
    map.setLayoutProperty(
      "municipality-borders",
      "visibility",
      municipal ? "visible" : "none",
    );
    map.setPaintProperty("municipality-borders", "line-color", palette.border);
    map.setPaintProperty(
      "state-borders",
      "line-color",
      municipal ? palette.outline : palette.border,
    );
    map.setPaintProperty(
      "state-borders",
      "line-width",
      municipal ? 1.25 : 0.75,
    );

    const own: maplibregl.FilterSpecification = [
      "==",
      ["get", "CVEGEO"],
      selected ?? "",
    ];
    for (const each of ["state", "municipality"] as const) {
      map.setFilter(`${each}-selection-halo`, own);
      map.setFilter(`${each}-selection`, own);
      map.setPaintProperty(
        `${each}-selection-halo`,
        "line-color",
        palette.selectionHalo,
      );
      map.setPaintProperty(
        `${each}-selection`,
        "line-color",
        palette.selection,
      );
    }
  };

  const frame = useRef((_: FocusRequest) => {});
  frame.current = ({ bounds }) => {
    const map = mapRef.current;
    if (!map || !readyRef.current) return;
    const camera = map.cameraForBounds(bounds, { padding: padding() });
    if (!camera) return;
    const reduced = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    // A large state can fit at a zoom below the municipal one; entering it should still show its municipalities.
    const zoom =
      bounds === MEXICO
        ? (camera.zoom ?? 4)
        : Math.max(camera.zoom ?? 0, municipalZoom(map) + 0.01);
    map.easeTo({ center: camera.center, zoom, duration: reduced ? 0 : 150 });
  };

  useEffect(() => {
    const element = container.current;
    if (!element) return;
    const map = new maplibregl.Map({
      container: element,
      // No tile basemap: the only thing on screen is the data (brief §1).
      style: {
        version: 8,
        sources: {},
        // Colours are set per theme in `paint`; nothing should fade between them.
        transition: { duration: 0, delay: 0 },
        layers: [
          {
            id: "background",
            type: "background",
            paint: { "background-color": latest.current.palette.canvas },
          },
        ],
      },
      bounds: MEXICO,
      fitBoundsOptions: { padding: padding() },
      attributionControl: false,
      dragRotate: false,
      pitchWithRotate: false,
      maxBounds: [-135, 5, -70, 40],
      maxZoom: 11,
    });
    map.touchZoomRotate.disableRotation();
    map.keyboard.disableRotation();
    mapRef.current = map;

    map.on("load", () => {
      const { stateGeometry, municipalGeometry } = latest.current;
      map.addSource(SOURCES.state, { type: "geojson", data: stateGeometry });
      map.addSource(SOURCES.municipality, {
        type: "geojson",
        data: municipalGeometry ?? EMPTY,
      });
      for (const level of ["state", "municipality"] as const) {
        const source = SOURCES[level];
        map.addLayer({
          id: `${level}-fill`,
          source,
          type: "fill",
          paint: { "fill-color": "#d6d6d6" },
        });
        map.addLayer({
          id: `${level}-missing-other`,
          source,
          type: "fill",
          filter: idsFilter([]),
          paint: { "fill-pattern": "hatch-45" },
        });
        map.addLayer({
          id: `${level}-missing-confidential`,
          source,
          type: "fill",
          filter: idsFilter([]),
          paint: { "fill-pattern": "hatch-135" },
        });
      }
      map.addLayer({
        id: "municipality-borders",
        source: SOURCES.municipality,
        type: "line",
        paint: { "line-width": 0.4 },
      });
      map.addLayer({
        id: "state-borders",
        source: SOURCES.state,
        type: "line",
        paint: { "line-width": 0.75 },
      });
      for (const level of ["state", "municipality"] as const) {
        map.addLayer({
          id: `${level}-selection-halo`,
          source: SOURCES[level],
          type: "line",
          filter: ["==", ["get", "CVEGEO"], ""],
          layout: { "line-join": "round" },
          paint: { "line-width": 4 },
        });
        map.addLayer({
          id: `${level}-selection`,
          source: SOURCES[level],
          type: "line",
          filter: ["==", ["get", "CVEGEO"], ""],
          layout: { "line-join": "round" },
          paint: { "line-width": 2 },
        });
      }
      readyRef.current = true;
      paint.current();
      if (latest.current.focus) frame.current(latest.current.focus);
    });

    let zoomedIn = false;
    map.on("zoomend", () => {
      const now = map.getZoom() >= municipalZoom(map);
      if (now !== zoomedIn) {
        zoomedIn = now;
        latest.current.onZoomedInChange(now);
      }
    });

    map.on("click", (event: maplibregl.MapMouseEvent) => {
      const [feature] = map.queryRenderedFeatures(event.point, {
        layers: [`${latest.current.level}-fill`],
      });
      const id = feature?.properties?.CVEGEO;
      latest.current.onSelect(typeof id === "string" ? id : null);
    });
    for (const level of ["state", "municipality"] as const) {
      map.on("mousemove", `${level}-fill`, () => {
        map.getCanvas().style.cursor = "pointer";
      });
      map.on("mouseleave", `${level}-fill`, () => {
        map.getCanvas().style.cursor = "";
      });
    }

    return () => {
      readyRef.current = false;
      map.remove();
      mapRef.current = null;
    };
  }, []);

  const { municipalGeometry, palette, fills, missing, selected, level, focus } =
    props;

  useEffect(() => {
    const source = mapRef.current?.getSource(SOURCES.municipality);
    if (municipalGeometry && readyRef.current && source?.type === "geojson")
      (source as maplibregl.GeoJSONSource).setData(municipalGeometry);
  }, [municipalGeometry]);

  // biome-ignore lint/correctness/useExhaustiveDependencies: repaint whenever any painted input changes
  useEffect(() => {
    paint.current();
  }, [palette, fills, missing, selected, level]);

  useEffect(() => {
    if (focus) frame.current(focus);
  }, [focus]);

  // MapLibre gives its container `position: relative`, which would undo `absolute`,
  // so the container sits inside a wrapper that carries the positioning.
  return (
    <div className="absolute inset-0">
      <div
        ref={container}
        className="size-full"
        role="img"
        aria-label={`Mapa de México por ${level === "state" ? "entidad federativa" : "municipio"}. Los mismos datos están disponibles como tabla.`}
      />
    </div>
  );
}
