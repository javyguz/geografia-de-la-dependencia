"""Checks the artifacts committed in web/public/data, the ones the web app serves."""

import json
from typing import Any

import pytest

from pipeline import schemas
from pipeline.paths import OUTPUT_DIR
from pipeline.transform.states import NATIONAL, STATES


def load(name: str) -> Any:
    return json.loads((OUTPUT_DIR / name).read_text(encoding="utf-8"))


def series(values: Any, indicator: str, year: int = 2023, sector: str = "total") -> dict[str, Any]:
    return next(
        s
        for s in values["series"]
        if (s["indicator"], s["year"], s["sector"]) == (indicator, year, sector)
    )


def test_the_catalog_is_valid() -> None:
    schemas.validate_catalog(load("catalog.json"))


def test_every_source_has_a_license_and_a_download_date() -> None:
    for source in load("catalog.json")["sources"]:
        assert source["license_url"].startswith("https://")
        assert len(source["retrieved_at"]) == len("2026-01-01")


def test_geometry_and_values_share_the_same_keys() -> None:
    states = [f["properties"]["CVEGEO"] for f in load("geo/states.geojson")["features"]]
    municipalities = [
        f["properties"]["CVEGEO"] for f in load("geo/municipalities.geojson")["features"]
    ]
    assert states == list(STATES)
    assert load("values/states.json")["territories"] == [NATIONAL, *STATES]
    assert load("values/municipalities.json")["territories"] == municipalities
    assert [t["id"] for t in load("territories.json")] == [NATIONAL, *STATES, *municipalities]
    for path in (OUTPUT_DIR / "values" / "municipalities-sectors").glob("*.json"):
        assert json.loads(path.read_text(encoding="utf-8"))["territories"] == municipalities


@pytest.mark.parametrize(
    "name",
    [
        "values/states.json",
        "values/municipalities.json",
        "values/municipalities-sectors/31-33.json",
    ],
)
def test_every_missing_value_has_exactly_one_reason(name: str) -> None:
    for item in load(name)["series"]:
        nulls = {i for i, value in enumerate(item["values"]) if value is None}
        with_reason = [i for indexes in item["missing"].values() for i in indexes]
        assert len(with_reason) == len(set(with_reason))
        assert set(with_reason) == nulls


def test_national_figures_match_the_source() -> None:
    """Figures that can be read directly in INEGI's published tables."""
    values = load("values/states.json")
    # Censos Económicos 2024: 3,474,422.828 ÷ 15,667,989.992 million pesos.
    assert series(values, "labor_share")["values"][0] == 0.222
    # CAPEXCE24_01: 4,846,067.301 ÷ 13,383,674.460 million pesos.
    assert series(values, "foreign_share_value_added")["values"][0] == 0.362
    # CAPEXCE24_01 reports 239,922 pesos per paid worker in units with foreign capital.
    assert series(values, "wage_per_paid_worker_foreign")["values"][0] == 239.9
