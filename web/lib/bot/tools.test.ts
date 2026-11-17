import { describe, expect, it } from "vitest";
import { fullData, stateData } from "../test-data";
import { runTool, type ToolHost, toolDefinitions } from "./execute";
import {
  compare,
  describeIndicator,
  findTerritory,
  getValue,
  rank,
  showOnMap,
  type ToolValue,
} from "./tools";

const data = fullData();

describe("findTerritory", () => {
  it("returns every municipality that shares a name, with its state", () => {
    const result = findTerritory(data, { query: "juarez" });
    expect(result.matches).toHaveLength(5);
    expect(JSON.stringify(result)).toContain("Chihuahua");
  });

  it("says so when nothing matches", () => {
    expect(findTerritory(data, { query: "Atlantis" })).toHaveProperty("error");
  });
});

describe("getValue", () => {
  it("returns the value with unit, year, sector and source", () => {
    const value = getValue(data, {
      indicator: "labor_share",
      territory: "00",
    }) as ToolValue;
    expect(value).toMatchObject({
      territory_name: "Nacional",
      year: 2023,
      sector: "total",
      value: 0.222,
      formatted: "22.2 %",
      missing_reason: null,
    });
    expect(value.source).toContain("Censos Económicos 2024");
  });

  it("answers a state-only indicator for a municipality with its state, and says so", () => {
    const value = getValue(data, {
      indicator: "foreign_share_value_added",
      territory: "14039",
    }) as ToolValue;
    expect(value.territory).toBe("14");
    expect(value.note).toContain("no se publica por municipio");
  });

  it("keeps a confidential value as missing, with its reason", () => {
    const confidential = rank(data, {
      indicator: "foreign_share_value_added",
      level: "state",
      order: "desc",
      sector: "11",
    });
    expect(confidential).toHaveProperty(
      "territories_without_value.confidential",
    );
  });

  it("rejects a year the indicator does not have", () => {
    expect(
      getValue(data, {
        indicator: "foreign_share_value_added",
        territory: "14",
        year: 2018,
      }),
    ).toHaveProperty("error");
  });

  it("rejects an unknown territory instead of guessing", () => {
    expect(
      getValue(data, { indicator: "labor_share", territory: "99" }),
    ).toHaveProperty("error");
  });
});

describe("compare and rank", () => {
  it("compares with the national value", () => {
    const result = compare(data, {
      indicator: "informality_rate",
      territories: ["07", "19"],
    });
    expect(result).toHaveProperty("national.territory", "00");
    expect(result).toHaveProperty("values.length", 2);
  });

  it("ranks highest first and counts the missing", () => {
    const result = rank(data, {
      indicator: "labor_share",
      level: "municipality",
      order: "desc",
      limit: 3,
      within_state: "14",
    }) as { items: ToolValue[]; territories_with_value: number };
    expect(result.items).toHaveLength(3);
    expect(result.items.every((i) => i.territory.startsWith("14"))).toBe(true);
    const values = result.items.map((i) => i.value ?? 0);
    expect([...values].sort((a, b) => b - a)).toEqual(values);
  });

  it("refuses to rank municipalities by a state-only indicator", () => {
    expect(
      rank(data, {
        indicator: "fdi_per_capita",
        level: "municipality",
        order: "desc",
      }),
    ).toHaveProperty("error");
  });
});

describe("describeIndicator and showOnMap", () => {
  it("includes the standing warning of FDI", () => {
    expect(
      describeIndicator(data, { indicator: "fdi_per_capita" }),
    ).toHaveProperty("warning");
  });

  it("puts a conditions indicator on the second axis of the bivariate layer", () => {
    const { view } = showOnMap(data, { indicator: "informality_rate" });
    expect(view).toMatchObject({
      layer: "spillover",
      indicator2: "informality_rate",
    });
  });

  it("opens the counterargument panel for its indicators", () => {
    const { view } = showOnMap(data, {
      indicator: "labor_share_foreign",
      territory: "19",
    });
    expect(view).toMatchObject({ counterargument: true, territory: "19" });
  });
});

describe("runTool", () => {
  it("loads municipal files before a municipal question", async () => {
    let current = stateData();
    const loaded: string[] = [];
    const host: ToolHost = {
      data: () => current,
      ensureMunicipal: async (sector) => {
        loaded.push(sector);
        current = fullData();
      },
      show: () => {},
    };
    const result = await runTool(
      "get_value",
      JSON.stringify({
        indicator: "labor_share",
        territory: "14039",
        sector: "31-33",
      }),
      host,
    );
    expect(loaded).toEqual(["31-33"]);
    expect(result).toHaveProperty("territory", "14039");
  });

  it("returns malformed arguments to the model as an error", async () => {
    const host: ToolHost = {
      data: stateData,
      ensureMunicipal: async () => {},
      show: () => {},
    };
    expect(await runTool("get_value", "{oops", host)).toHaveProperty("error");
  });

  it("offers the model only indicators of the catalog", () => {
    const definitions = toolDefinitions(data.catalog);
    expect(JSON.stringify(definitions)).toContain('"labor_share"');
    expect(definitions.map((d) => d.function.name)).toEqual([
      "find_territory",
      "describe_indicator",
      "get_value",
      "compare",
      "rank",
      "show_on_map",
    ]);
  });
});
