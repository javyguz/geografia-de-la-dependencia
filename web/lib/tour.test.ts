import { describe, expect, it } from "vitest";
import { stateData } from "./test-data";
import { paragraphs, STEPS, stepView } from "./tour";
import { emptyState } from "./url-state";
import { indicatorById, layerById } from "./view";

const data = stateData();

describe("tour content", () => {
  it("has between five and six steps, as the brief asks", () => {
    expect(STEPS.length).toBeGreaterThanOrEqual(5);
    expect(STEPS.length).toBeLessThanOrEqual(6);
  });

  it.each(STEPS.map((step, i) => [i + 1, step] as const))(
    "step %i points to things that exist",
    (index, step) => {
      const view = { ...emptyState(), ...stepView(step, index - 1) };
      const layer = layerById(data, view.layer);
      expect(layer.id, "capa").toBe(view.layer);
      for (const id of [view.indicator, view.indicator2]) {
        if (id === null) continue;
        expect(indicatorById(data, id), `indicador ${id}`).toBeDefined();
        const inLayer = [
          layer.indicators,
          layer.integration,
          layer.conditions,
        ].some((ids) => ids?.includes(id));
        expect(inLayer, `${id} no está en la capa ${layer.id}`).toBe(true);
      }
      expect(
        data.catalog.sectors.some((s) => s.id === view.sector),
        `sector ${view.sector}`,
      ).toBe(true);
      if (view.territory)
        expect(
          data.territories.has(view.territory),
          `territorio ${view.territory}`,
        ).toBe(true);
      expect(paragraphs(step.text).length).toBeGreaterThan(0);
    },
  );
});

describe("stepView", () => {
  it("resets what the step does not set, so steps do not leak into each other", () => {
    const view = stepView({ title: "", text: "", view: "", draft: false }, 0);
    expect(view).toMatchObject({
      sector: "total",
      territory: null,
      indicator: null,
      mode: "tour",
      step: 0,
    });
  });
});
