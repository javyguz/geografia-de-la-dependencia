import type { FeatureCollection } from "geojson";
import { describe, expect, it } from "vitest";
import { boundsByTerritory } from "./bounds";

describe("boundsByTerritory", () => {
  it("covers every part of a multipolygon", () => {
    const collection: FeatureCollection = {
      type: "FeatureCollection",
      features: [
        {
          type: "Feature",
          properties: { CVEGEO: "03" },
          geometry: {
            type: "MultiPolygon",
            coordinates: [
              [
                [
                  [-110, 24],
                  [-109, 24],
                  [-109, 25],
                  [-110, 24],
                ],
              ],
              [
                [
                  [-115, 28],
                  [-114, 28],
                  [-114, 29],
                  [-115, 28],
                ],
              ],
            ],
          },
        },
      ],
    };
    expect(boundsByTerritory(collection).get("03")).toEqual([
      -115, 24, -109, 29,
    ]);
  });
});
