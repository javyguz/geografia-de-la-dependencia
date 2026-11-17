import type { FeatureCollection, Position } from "geojson";

/** [west, south, east, north] */
export type Bounds = [number, number, number, number];

/** Bounds of Mexico. */
export const MEXICO: Bounds = [-118.4, 14.5, -86.7, 32.7];

function positionsOf(
  geometry: FeatureCollection["features"][number]["geometry"],
): Position[] {
  switch (geometry.type) {
    case "Polygon":
      return geometry.coordinates.flat();
    case "MultiPolygon":
      return geometry.coordinates.flat(2);
    default:
      return [];
  }
}

/** The bounding box of every feature, keyed by its CVEGEO. */
export function boundsByTerritory(
  collection: FeatureCollection,
): Map<string, Bounds> {
  const result = new Map<string, Bounds>();
  for (const feature of collection.features) {
    const id = feature.properties?.CVEGEO;
    if (typeof id !== "string") continue;
    const box: Bounds = [
      Number.POSITIVE_INFINITY,
      Number.POSITIVE_INFINITY,
      Number.NEGATIVE_INFINITY,
      Number.NEGATIVE_INFINITY,
    ];
    for (const [x = 0, y = 0] of positionsOf(feature.geometry)) {
      box[0] = Math.min(box[0], x);
      box[1] = Math.min(box[1], y);
      box[2] = Math.max(box[2], x);
      box[3] = Math.max(box[3], y);
    }
    result.set(id, box);
  }
  return result;
}
