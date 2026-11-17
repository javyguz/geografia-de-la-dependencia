import { describe, expect, it } from "vitest";
import { searchTerritories } from "./search";
import type { Territory } from "./types";

const place = (
  id: string,
  name: string,
  level: Territory["level"],
): Territory => ({ id, name, level, state: id.slice(0, 2), population: 1 });

const territories = [
  place("08", "Chihuahua", "state"),
  place("09", "Ciudad de México", "state"),
  place("08037", "Juárez", "municipality"),
  place("19031", "Juárez", "municipality"),
  place("16052", "Lázaro Cárdenas", "municipality"),
];

describe("searchTerritories", () => {
  it("lists only the states before anything is typed", () => {
    expect(searchTerritories(territories, " ").map((t) => t.id)).toEqual([
      "08",
      "09",
    ]);
  });

  it("ignores accents and case", () => {
    expect(searchTerritories(territories, "lazaro").map((t) => t.id)).toEqual([
      "16052",
    ]);
  });

  it("keeps every municipality that shares a name", () => {
    expect(searchTerritories(territories, "juarez")).toHaveLength(2);
  });

  it("puts states before municipalities", () => {
    const found = searchTerritories(territories, "c");
    expect(found[0]?.level).toBe("state");
  });
});
