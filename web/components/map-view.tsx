"use client";

import "maplibre-gl/dist/maplibre-gl.css";
import type { FeatureCollection } from "geojson";
import * as maplibregl from "maplibre-gl";
import { useEffect, useRef } from "react";
import type { Palette } from "@/lib/palettes";
import type { MissingReason } from "@/lib/types";

/** Bounds of Mexico, as [west, south, east, north]. */
const MEXICO: [number, number, number, number] = [-118.4, 14.5, -86.7, 32.7];
const SOURCE = "territories";

// MapLibre looks for its worker next to its own file, but the bundler renames
// that file, so the worker is declared here as an asset of the build.
maplibregl.setWorkerUrl(
  new URL("maplibre-gl/dist/maplibre-gl-worker.mjs", import.meta.url).href,
);

interface Props {
  geometry: FeatureCollection;
  palette: Palette;
  fills: Map<string, string>;
  missing: Map<string, MissingReason>;
  selected: string | null;
  onSelect: (id: string | null) => void;
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

export function MapView({
  geometry,
  palette,
  fills,
  missing,
  selected,
  onSelect,
}: Props) {
  const container = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const readyRef = useRef(false);
  const latest = useRef({
    geometry,
    palette,
    fills,
    missing,
    selected,
    onSelect,
  });
  latest.current = { geometry, palette, fills, missing, selected, onSelect };

  // Paints everything that depends on props. Safe to call any number of times.
  const paint = useRef(() => {});
  paint.current = () => {
    const map = mapRef.current;
    if (!map || !readyRef.current) return;
    const { palette, fills, missing, selected } = latest.current;

    for (const direction of [45, 135] as const) {
      const name = `hatch-${direction}`;
      if (map.hasImage(name)) map.removeImage(name);
      map.addImage(name, hatch(palette.noData, palette.noDataHatch, direction));
    }
    map.setPaintProperty("background", "background-color", palette.canvas);
    map.setPaintProperty(
      "fill",
      "fill-color",
      fillExpression(fills, palette.noData),
    );
    map.setPaintProperty("borders", "line-color", palette.border);
    map.setPaintProperty("selection-halo", "line-color", palette.selectionHalo);
    map.setPaintProperty("selection", "line-color", palette.selection);

    const confidential = [...missing]
      .filter(([, r]) => r === "confidential")
      .map(([id]) => id);
    const others = [...missing]
      .filter(([, r]) => r !== "confidential")
      .map(([id]) => id);
    map.setFilter("missing-confidential", idsFilter(confidential));
    map.setFilter("missing-other", idsFilter(others));

    const own: maplibregl.FilterSpecification = [
      "==",
      ["get", "CVEGEO"],
      selected ?? "",
    ];
    map.setFilter("selection-halo", own);
    map.setFilter("selection", own);
  };

  useEffect(() => {
    const element = container.current;
    if (!element) return;
    // Same breakpoint as the layout in explorer.tsx (Tailwind `md`).
    const wide = window.matchMedia("(min-width: 768px)").matches;
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
      // On wide screens the controls and the legend float over the map, so it
      // keeps room above and below; on narrow screens they sit outside it.
      fitBoundsOptions: {
        padding: wide
          ? { top: 150, left: 24, bottom: 24, right: 24 }
          : { top: 8, left: 8, bottom: 8, right: 8 },
      },
      attributionControl: false,
      dragRotate: false,
      pitchWithRotate: false,
      maxBounds: [-135, 5, -70, 40],
    });
    map.touchZoomRotate.disableRotation();
    map.keyboard.disableRotation();
    mapRef.current = map;

    map.on("load", () => {
      map.addSource(SOURCE, { type: "geojson", data: latest.current.geometry });
      map.addLayer({
        id: "fill",
        source: SOURCE,
        type: "fill",
        paint: { "fill-color": "#d5d6d8" },
      });
      map.addLayer({
        id: "missing-other",
        source: SOURCE,
        type: "fill",
        filter: idsFilter([]),
        paint: { "fill-pattern": "hatch-45" },
      });
      map.addLayer({
        id: "missing-confidential",
        source: SOURCE,
        type: "fill",
        filter: idsFilter([]),
        paint: { "fill-pattern": "hatch-135" },
      });
      map.addLayer({
        id: "borders",
        source: SOURCE,
        type: "line",
        paint: { "line-width": 0.75, "line-color": "#ffffff" },
      });
      map.addLayer({
        id: "selection-halo",
        source: SOURCE,
        type: "line",
        filter: ["==", ["get", "CVEGEO"], ""],
        layout: { "line-join": "round" },
        paint: { "line-width": 4, "line-color": "#ffffff" },
      });
      map.addLayer({
        id: "selection",
        source: SOURCE,
        type: "line",
        filter: ["==", ["get", "CVEGEO"], ""],
        layout: { "line-join": "round" },
        paint: { "line-width": 2, "line-color": "#1a1c1f" },
      });
      readyRef.current = true;
      paint.current();
    });

    map.on("click", (event: maplibregl.MapMouseEvent) => {
      const [feature] = map.queryRenderedFeatures(event.point, {
        layers: ["fill"],
      });
      const id = feature?.properties?.CVEGEO;
      latest.current.onSelect(typeof id === "string" ? id : null);
    });
    map.on("mousemove", "fill", () => {
      map.getCanvas().style.cursor = "pointer";
    });
    map.on("mouseleave", "fill", () => {
      map.getCanvas().style.cursor = "";
    });

    return () => {
      readyRef.current = false;
      map.remove();
      mapRef.current = null;
    };
  }, []);

  // biome-ignore lint/correctness/useExhaustiveDependencies: repaint whenever any painted input changes
  useEffect(() => {
    paint.current();
  }, [palette, fills, missing, selected]);

  // MapLibre gives its container `position: relative`, which would undo `absolute`,
  // so the container sits inside a wrapper that carries the positioning.
  return (
    <div className="absolute inset-0">
      <div
        ref={container}
        className="size-full"
        role="img"
        aria-label="Mapa de México por entidad federativa. Los mismos datos están disponibles como tabla."
      />
    </div>
  );
}
