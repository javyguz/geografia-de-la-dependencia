"""Checks every table must pass before it is exported.

A failed check stops the build: a wrong artifact is worse than no artifact.
"""

from typing import Any

import polars as pl

from pipeline.transform.states import NATIONAL, STATES

UNITS = {"percent", "mxn_thousands", "usd", "count"}
LEVELS = {"state", "municipality"}
SCALES = {"sequential", "diverging"}

# Shares of a whole: they can never leave the 0-1 range. Ratios such as the
# labour share are percentages too, but may legitimately exceed 1.
BOUNDED_SHARES = {
    "foreign_share_value_added",
    "foreign_share_employment",
    "foreign_share_wages",
    "large_establishment_employment_share",
    "micro_establishment_employment_share",
    "unpaid_worker_share_micro",
    "informality_rate",
    "working_poverty_rate",
}

KEYS = ["territory", "indicator", "sector", "year"]

type Catalog = dict[str, Any]


class ValidationError(Exception):
    pass


def _require(condition: bool, message: str) -> None:
    if not condition:
        raise ValidationError(message)


def _unique(items: list[Catalog], kind: str) -> set[str]:
    ids = [item["id"] for item in items]
    _require(len(ids) == len(set(ids)), f"duplicated {kind} id in the catalog")
    return set(ids)


def validate_catalog(catalog: Catalog) -> None:
    sources = _unique(catalog["sources"], "source")
    indicators = _unique(catalog["indicators"], "indicator")
    _unique(catalog["sectors"], "sector")
    _unique(catalog["missing_reasons"], "missing reason")
    _unique(catalog["layers"], "layer")

    for indicator in catalog["indicators"]:
        name = indicator["id"]
        _require(indicator["unit"] in UNITS, f"{name}: unknown unit")
        _require(indicator["scale"] in SCALES, f"{name}: unknown scale")
        _require(set(indicator["levels"]) <= LEVELS, f"{name}: unknown level")
        _require(set(indicator["sources"]) <= sources, f"{name}: unknown source")
        _require(bool(indicator["years"]), f"{name}: no years")
        _require(bool(indicator["limitations"]), f"{name}: an indicator without limitations")

    referenced: list[str] = []
    for layer in catalog["layers"]:
        for group in ("indicators", "context", "integration", "conditions"):
            referenced += layer.get(group, [])
    counterargument = catalog["counterargument"]
    referenced += [p[side] for p in counterargument["pairs"] for side in ("foreign", "domestic")]
    referenced += counterargument["single"]
    _require(set(referenced) <= indicators, "a layer references an unknown indicator")
    _require(indicators <= set(referenced), "an indicator is not used by any layer")


def level_of(territory: pl.Expr) -> pl.Expr:
    return (
        pl.when(territory.str.len_chars() == 2)
        .then(pl.lit("state"))
        .otherwise(pl.lit("municipality"))
    )


def validate_series(series: pl.DataFrame, catalog: Catalog, municipalities: list[str]) -> None:
    """Checks the long table of values against the catalog and the geometry keys."""
    states = [NATIONAL, *STATES]
    _require(len(STATES) == 32, "there must be 32 states")
    _require(series.select(KEYS).is_duplicated().sum() == 0, "duplicated value")

    has_value = series["value"].is_not_null()
    has_reason = series["missing"].is_not_null()
    _require(bool((has_value != has_reason).all()), "a value must be present or have a reason")
    reasons = {reason["id"] for reason in catalog["missing_reasons"]}
    used = set(series["missing"].drop_nulls().unique().to_list())
    _require(used <= reasons, f"unknown missing reasons: {used - reasons}")
    _require(bool(series["value"].drop_nulls().is_finite().all()), "non-finite value")

    sectors = {sector["id"] for sector in catalog["sectors"]}
    found = set(series["sector"].unique().to_list())
    _require(found <= sectors, f"sectors missing from the catalog: {found - sectors}")

    shares = series.filter(pl.col("indicator").is_in(BOUNDED_SHARES) & has_value)
    out_of_range = shares.filter((pl.col("value") < 0) | (pl.col("value") > 1))
    _require(out_of_range.is_empty(), f"share outside 0-1:\n{out_of_range.head()}")

    with_level = series.with_columns(level_of(pl.col("territory")).alias("level"))
    expected_territories = {"state": set(states), "municipality": set(municipalities)}
    seen: set[tuple[str, str, int]] = set()
    for (indicator, level, sector, year), group in with_level.group_by(
        "indicator", "level", "sector", "year"
    ):
        territories = set(group["territory"].to_list())
        label = f"{indicator} / {level} / {sector} / {year}"
        _require(territories == expected_territories[str(level)], f"{label}: wrong territories")
        if group["value"].is_not_null().any():
            seen.add((str(indicator), str(level), int(str(year))))

    by_id = {indicator["id"]: indicator for indicator in catalog["indicators"]}
    found_indicators = set(series["indicator"].unique().to_list())
    _require(found_indicators <= set(by_id), "series for an indicator outside the catalog")
    for indicator in catalog["indicators"]:
        for level in indicator["levels"]:
            for year in indicator["years"]:
                _require(
                    (indicator["id"], level, year) in seen,
                    f"{indicator['id']}: no values at {level} level for {year}",
                )
    declared = {(i, lv, y) for i, d in by_id.items() for lv in d["levels"] for y in d["years"]}
    _require(seen <= declared, f"series the catalog does not declare: {seen - declared}")
    for indicator in by_id.values():
        if not indicator["by_sector"]:
            only = series.filter(pl.col("indicator") == indicator["id"])["sector"].unique()
            _require(only.to_list() == ["total"], f"{indicator['id']}: unexpected sectors")
