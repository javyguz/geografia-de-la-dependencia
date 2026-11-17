"""Writes the artifacts the web app reads."""

import json
from pathlib import Path
from typing import Any

import polars as pl

type Catalog = dict[str, Any]


def write_json(path: Path, content: object) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    text = json.dumps(content, ensure_ascii=False, separators=(",", ":"), allow_nan=False)
    path.write_text(text + "\n", encoding="utf-8", newline="\n")


def stored_decimals(catalog: Catalog) -> dict[str, int]:
    """Decimals kept in the files: exactly what the interface displays.

    Percentages are stored as proportions, so they need two more decimals.
    """
    return {
        indicator["id"]: indicator["decimals"] + (2 if indicator["unit"] == "percent" else 0)
        for indicator in catalog["indicators"]
    }


def values_file(
    series: pl.DataFrame, level: str, territories: list[str], catalog: Catalog
) -> dict[str, object]:
    """Lays a long table out by columns: one array of values per series, in territory order."""
    decimals = stored_decimals(catalog)
    indicator_order = {indicator["id"]: i for i, indicator in enumerate(catalog["indicators"])}
    sector_order = {sector["id"]: i for i, sector in enumerate(catalog["sectors"])}
    position = {territory: i for i, territory in enumerate(territories)}

    groups = series.partition_by("indicator", "sector", "year", as_dict=True)
    ordered = sorted(
        groups,
        key=lambda key: (
            indicator_order[str(key[0])],
            sector_order[str(key[1])],
            -int(str(key[2])),
        ),
    )
    output: list[dict[str, object]] = []
    for key in ordered:
        indicator, sector, year = str(key[0]), str(key[1]), int(str(key[2]))
        values: list[float | None] = [None] * len(territories)
        missing: dict[str, list[int]] = {}
        for territory, value, reason in groups[key].select("territory", "value", "missing").rows():
            index = position[territory]
            if value is None:
                missing.setdefault(reason, []).append(index)
            else:
                values[index] = round(value, decimals[indicator])
        output.append(
            {
                "indicator": indicator,
                "sector": sector,
                "year": year,
                "values": values,
                "missing": {reason: sorted(indexes) for reason, indexes in sorted(missing.items())},
            }
        )
    return {"level": level, "territories": territories, "series": output}


def territories_file(
    states: dict[str, str], municipalities: dict[str, str], population: dict[str, float]
) -> list[dict[str, object]]:
    """The index the search box and the bot use to resolve names."""

    def entry(key: str, name: str, level: str) -> dict[str, object]:
        inhabitants = population.get(key)
        return {
            "id": key,
            "name": name,
            "level": level,
            "state": key[:2],
            "population": None if inhabitants is None else int(inhabitants),
        }

    return [
        *(entry(key, name, "state") for key, name in states.items()),
        *(entry(key, name, "municipality") for key, name in municipalities.items()),
    ]
