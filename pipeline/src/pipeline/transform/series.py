"""The long table every transform produces: one row per indicator value.

A null value always carries the reason it is missing. Nothing is imputed.
"""

import polars as pl

COLUMNS = {
    "territory": pl.String,
    "indicator": pl.String,
    "sector": pl.String,
    "year": pl.Int32,
    "value": pl.Float64,
    "missing": pl.String,
}

TOTAL = "total"

# Reasons a value can be missing; labels live in the catalog.
CONFIDENTIAL = "confidential"
NOT_PUBLISHED = "not_published"
NOT_COLLECTED = "not_collected"
NOT_COMPUTABLE = "not_computable"
NO_POPULATION = "no_population"


def empty() -> pl.DataFrame:
    return pl.DataFrame(schema=COLUMNS)


def ratio(
    frame: pl.DataFrame,
    indicator: str,
    numerator: str,
    denominator: str,
    *,
    scale: float = 1.0,
    if_null: str = CONFIDENTIAL,
) -> pl.DataFrame:
    """Builds one indicator as numerator ÷ denominator.

    A null operand means the source withheld the figure; a denominator that is
    zero or negative makes the ratio meaningless. Both become a null with its reason.
    """
    num, den = pl.col(numerator), pl.col(denominator)
    missing = (
        pl.when(num.is_null() | den.is_null())
        .then(pl.lit(if_null))
        .when(den <= 0)
        .then(pl.lit(NOT_COMPUTABLE))
        .otherwise(None)
    )
    return frame.select(
        "territory",
        pl.lit(indicator).alias("indicator"),
        "sector",
        pl.col("year").cast(pl.Int32),
        pl.when(missing.is_null()).then(num / den * scale).otherwise(None).alias("value"),
        missing.alias("missing"),
    )


def share(frame: pl.DataFrame, indicator: str, part: str, whole: str) -> pl.DataFrame:
    """Builds one indicator as the share a part takes of its whole.

    Value added can be negative. When that puts the part below zero or above
    the whole, the result is not a share of anything and is left out.
    """
    result = ratio(frame, indicator, part, whole)
    outside = (pl.col("value") < 0) | (pl.col("value") > 1)
    return result.with_columns(
        pl.when(outside).then(None).otherwise(pl.col("value")).alias("value"),
        pl.when(outside).then(pl.lit(NOT_COMPUTABLE)).otherwise(pl.col("missing")).alias("missing"),
    )


def from_values(
    values: dict[str, float], indicator: str, year: int, *, sector: str = TOTAL
) -> pl.DataFrame:
    """Builds one indicator from a territory -> value mapping."""
    return pl.DataFrame(
        {
            "territory": list(values),
            "indicator": indicator,
            "sector": sector,
            "year": year,
            "value": list(values.values()),
            "missing": None,
        },
        schema=COLUMNS,
    )


def complete(
    series: pl.DataFrame,
    territories: list[str],
    *,
    default: str = NOT_PUBLISHED,
    reasons: dict[str, str] | None = None,
) -> pl.DataFrame:
    """Adds a null row for every territory a series does not cover.

    `reasons` gives the motive for specific territories; the rest get `default`.
    """
    keys = series.select("indicator", "sector", "year").unique()
    grid = keys.join(pl.DataFrame({"territory": territories}), how="cross")
    absent = grid.join(series, on=["territory", "indicator", "sector", "year"], how="anti")
    known = reasons or {}
    absent = absent.with_columns(
        pl.lit(None, dtype=pl.Float64).alias("value"),
        pl.col("territory").replace_strict(known, default=default).alias("missing"),
    )
    return pl.concat([series, absent.select(series.columns)])
