/** The committed artifacts read from disk, for tests and the assistant's evaluation. Never imported by the app. */

import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type { Data } from "./data";
import type { Catalog, Territory, ValuesFile } from "./types";

const DATA = join(__dirname, "..", "public", "data");

export function readArtifact<T>(path: string): T {
  return JSON.parse(readFileSync(join(DATA, path), "utf-8")) as T;
}

const empty = () => ({ type: "FeatureCollection" as const, features: [] });

/** State data only, as the page has it before any municipal file loads. */
export function stateData(): Data {
  return {
    catalog: readArtifact<Catalog>("catalog.json"),
    territories: new Map(
      readArtifact<Territory[]>("territories.json").map((t) => [t.id, t]),
    ),
    states: readArtifact<ValuesFile>("values/states.json"),
    stateGeometry: empty(),
    municipal: null,
  };
}

/** Everything loaded, municipal sectors included (without geometry, which no test needs). */
export function fullData(): Data {
  const sectors = readdirSync(join(DATA, "values", "municipalities-sectors"));
  return {
    ...stateData(),
    municipal: {
      geometry: empty(),
      total: readArtifact<ValuesFile>("values/municipalities.json"),
      sectors: new Map(
        sectors.map((file) => [
          file.replace(".json", ""),
          readArtifact<ValuesFile>(`values/municipalities-sectors/${file}`),
        ]),
      ),
    },
  };
}
