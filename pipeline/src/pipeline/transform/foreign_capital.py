"""Censos Económicos 2024, table CAPEXCE24_01: foreign capital in large economic units.

The table only covers the units INEGI classifies as large, by state and
activity. Each activity has a row for all units, one for units without foreign
capital and one for units with it, the last one split by participation level.
"""

from collections.abc import Iterable
from pathlib import Path

import polars as pl
from openpyxl import load_workbook

from pipeline.transform import series
from pipeline.transform.series import CONFIDENTIAL, NOT_COMPUTABLE, TOTAL

YEAR = 2023

# Column positions in the sheet (0-based).
_STATE, _SECTOR, _SUBSECTOR, _CLASS = 0, 1, 2, 5
_PARTICIPATION, _LEVEL = 6, 7
_WORKERS, _PAID_WORKERS, _WAGES, _VALUE_ADDED = 10, 14, 17, 26

_GROUPS = {"": "all", "01)": "domestic", "02)": "foreign"}

type Row = tuple[object, ...]


def _text(cell: object) -> str:
    return str(cell).strip() if cell is not None else ""


def _number(cell: object) -> float | None:
    return float(cell) if isinstance(cell, int | float) else None


def parse_rows(rows: Iterable[Row]) -> pl.DataFrame:
    """Keeps the rows of each state and sector for all, domestic and foreign-capital units."""
    records: list[dict[str, object]] = []
    for row in rows:
        state = _text(row[_STATE])
        if len(row) <= _VALUE_ADDED or not state[:2].isdigit():
            continue
        below_sector = any(_text(cell) for cell in row[_SUBSECTOR : _CLASS + 1])
        group = _GROUPS.get(_text(row[_PARTICIPATION])[:3])
        if below_sector or group is None or _text(row[_LEVEL]):
            continue
        sector = _text(row[_SECTOR]).removeprefix("Sector").strip() or TOTAL
        records.append(
            {
                "territory": state[:2],
                "sector": sector,
                "group": group,
                "workers": _number(row[_WORKERS]),
                "paid_workers": _number(row[_PAID_WORKERS]),
                "wages": _number(row[_WAGES]),
                "value_added": _number(row[_VALUE_ADDED]),
            }
        )
    return pl.DataFrame(
        records,
        schema={
            "territory": pl.String,
            "sector": pl.String,
            "group": pl.String,
            "workers": pl.Float64,
            "paid_workers": pl.Float64,
            "wages": pl.Float64,
            "value_added": pl.Float64,
        },
    )


def read_rows(path: Path) -> pl.DataFrame:
    sheet = load_workbook(path, read_only=True).worksheets[0]
    return parse_rows(sheet.iter_rows(values_only=True))


def by_group(rows: pl.DataFrame) -> pl.DataFrame:
    """One row per state and sector with the three groups side by side."""
    keys = ["territory", "sector"]
    measures = ["workers", "paid_workers", "wages", "value_added"]

    def group(name: str) -> pl.DataFrame:
        return rows.filter(pl.col("group") == name).select(
            *keys,
            pl.lit(True).alias(f"has_{name}"),
            *(pl.col(m).alias(f"{m}_{name}") for m in measures),
        )

    wide = (
        group("all")
        .join(group("domestic"), on=keys, how="left")
        .join(group("foreign"), on=keys, how="left")
        .with_columns(
            pl.col("has_domestic", "has_foreign").fill_null(False),
            pl.lit(YEAR, dtype=pl.Int32).alias("year"),
        )
    )
    # When every unit of a sector is domestic the table has no foreign row: its
    # figures are a true zero. When neither row exists, INEGI grouped them.
    only_domestic = pl.col("has_domestic") & ~pl.col("has_foreign")
    return wide.with_columns(
        pl.when(only_domestic).then(0.0).otherwise(pl.col(f"{m}_foreign")).alias(f"{m}_foreign")
        for m in measures
    )


def _share(frame: pl.DataFrame, indicator: str, measure: str) -> pl.DataFrame:
    return series.share(frame, indicator, f"{measure}_foreign", f"{measure}_all")


def _within_group(
    frame: pl.DataFrame, indicator: str, numerator: str, denominator: str, group: str, scale: float
) -> pl.DataFrame:
    result = series.ratio(
        frame, indicator, f"{numerator}_{group}", f"{denominator}_{group}", scale=scale
    )
    # A sector with no units of this kind has nothing to measure.
    no_units = frame.select(
        (pl.col(f"{denominator}_{group}") == 0) & pl.col(f"{denominator}_{group}").is_not_null()
    ).to_series()
    return result.with_columns(
        pl.when(no_units).then(pl.lit(NOT_COMPUTABLE)).otherwise(pl.col("missing")).alias("missing")
    )


def indicators(frame: pl.DataFrame) -> pl.DataFrame:
    """Computes the foreign-capital indicators from the output of `by_group`."""
    thousands = 1000.0
    parts = [
        _share(frame, "foreign_share_value_added", "value_added"),
        _share(frame, "foreign_share_employment", "workers"),
        _share(frame, "foreign_share_wages", "wages"),
    ]
    for group in ("foreign", "domestic"):
        parts.append(
            _within_group(
                frame, f"wage_per_paid_worker_{group}", "wages", "paid_workers", group, thousands
            )
        )
        parts.append(
            _within_group(frame, f"labor_share_{group}", "wages", "value_added", group, 1.0)
        )
    return pl.concat(parts)


def coverage(frame: pl.DataFrame, census_totals: pl.DataFrame) -> pl.DataFrame:
    """Share of each state's census value added that large units generate."""
    census = census_totals.select(
        "territory", "sector", pl.col("value_added").alias("value_added_census")
    )
    joined = frame.join(census, on=["territory", "sector"], how="left")
    return series.ratio(
        joined,
        "large_units_coverage",
        "value_added_all",
        "value_added_census",
        if_null=CONFIDENTIAL,
    )
