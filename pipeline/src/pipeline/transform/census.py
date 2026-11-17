"""Censos Económicos open data: who keeps the value added and who employs.

Each state file has one row per territory (state or municipality), activity and
size stratum. Only the sector level and the all-sector total are used.
"""

import io
import zipfile
from pathlib import Path

import polars as pl

from pipeline.transform import series
from pipeline.transform.series import NOT_COMPUTABLE, NOT_PUBLISHED, TOTAL
from pipeline.transform.states import NATIONAL

ALL_STRATA = 0
MICRO = 1  # establishments with up to 10 people
LARGE = 4  # establishments with 251 people or more
GROUPED = 99  # INEGI merges strata under this key to protect confidentiality

# Chiapas municipalities where the 2024 census could not collect any information.
NOT_COLLECTED_2024 = ["07006", "07010", "07011", "07036", "07120", "07125"]

_MEASURES = {
    "UE": "units",
    "H001A": "workers",
    "H010A": "paid_workers",
    "H020A": "unpaid_workers",
    "J000A": "wages",
    "A131A": "value_added",
}


def read_cells(zip_path: Path, year: int) -> pl.DataFrame:
    """Reads one state file into one row per territory, sector and stratum."""
    with zipfile.ZipFile(zip_path) as archive:
        member = next(
            name
            for name in archive.namelist()
            if name.startswith("conjunto_de_datos/") and name.endswith(".csv")
        )
        raw = pl.read_csv(io.BytesIO(archive.read(member)), infer_schema=False)
    return clean_cells(raw, year)


def clean_cells(raw: pl.DataFrame, year: int) -> pl.DataFrame:
    text = pl.col(pl.String).str.strip_chars()
    sector_level = raw.with_columns(text).filter(
        pl.col("SUBSECTOR").is_null() | (pl.col("SUBSECTOR") == "")
    )
    return sector_level.select(
        # The national file leaves the state key empty.
        (pl.col("E03").fill_null(NATIONAL) + pl.col("E04").fill_null("")).alias("territory"),
        pl.when(pl.col("SECTOR").is_null() | (pl.col("SECTOR") == ""))
        .then(pl.lit(TOTAL))
        .otherwise(pl.col("SECTOR"))
        .alias("sector"),
        pl.col("ID_ESTRATO").cast(pl.Int32, strict=False).fill_null(ALL_STRATA).alias("stratum"),
        pl.lit(year, dtype=pl.Int32).alias("year"),
        *(
            pl.col(code).cast(pl.Float64, strict=False).alias(name)
            for code, name in _MEASURES.items()
        ),
    )


def _stratum(cells: pl.DataFrame, stratum: int, suffix: str) -> pl.DataFrame:
    return cells.filter(pl.col("stratum") == stratum).select(
        "territory",
        "sector",
        "year",
        pl.lit(True).alias(f"has_{suffix}"),
        pl.col("workers").alias(f"workers_{suffix}"),
        pl.col("unpaid_workers").alias(f"unpaid_{suffix}"),
    )


def totals(cells: pl.DataFrame) -> pl.DataFrame:
    """One row per territory and sector, with the micro and large strata alongside."""
    keys = ["territory", "sector", "year"]
    published = (
        cells.filter(pl.col("stratum") != ALL_STRATA)
        .group_by(keys)
        .agg(
            pl.col("workers").filter(pl.col("stratum") != GROUPED).sum().alias("workers_in_strata"),
            pl.lit(True).alias("has_strata"),
        )
    )
    return (
        cells.filter(pl.col("stratum") == ALL_STRATA)
        .drop("stratum")
        .join(_stratum(cells, MICRO, "micro"), on=keys, how="left")
        .join(_stratum(cells, LARGE, "large"), on=keys, how="left")
        .join(published, on=keys, how="left")
        .with_columns(
            pl.col("has_micro", "has_large", "has_strata").fill_null(False),
            # When the published strata add up to the total, a stratum with no
            # row truly has no establishments. Otherwise INEGI withheld some
            # strata, grouping them under key 99.
            ((pl.col("workers_in_strata") - pl.col("workers")).abs() < 0.5)
            .fill_null(False)
            .alias("strata_complete"),
        )
        .drop("workers_in_strata")
    )


def _stratum_share(frame: pl.DataFrame, indicator: str, suffix: str) -> pl.DataFrame:
    """Share of all workers employed in one size stratum."""
    known_zero = ~pl.col(f"has_{suffix}") & pl.col("strata_complete")
    filled = frame.with_columns(
        pl.when(known_zero)
        .then(0.0)
        .otherwise(pl.col(f"workers_{suffix}"))
        .alias("stratum_workers")
    )
    return _without_strata(frame, series.ratio(filled, indicator, "stratum_workers", "workers"))


def _without_strata(frame: pl.DataFrame, result: pl.DataFrame) -> pl.DataFrame:
    """Marks as not published the territories for which the source has no size strata at all."""
    no_strata = ~frame["has_strata"]
    return result.with_columns(
        pl.when(no_strata & pl.col("value").is_null())
        .then(pl.lit(NOT_PUBLISHED))
        .otherwise(pl.col("missing"))
        .alias("missing")
    )


def _unpaid_share_micro(frame: pl.DataFrame) -> pl.DataFrame:
    result = series.ratio(frame, "unpaid_worker_share_micro", "unpaid_micro", "workers_micro")
    no_micro = ~frame["has_micro"] & frame["strata_complete"]
    # Without micro establishments there is nothing to measure; that is not a withheld figure.
    result = result.with_columns(
        pl.when(no_micro).then(pl.lit(NOT_COMPUTABLE)).otherwise(pl.col("missing")).alias("missing")
    )
    return _without_strata(frame, result)


def indicators(frame: pl.DataFrame) -> pl.DataFrame:
    """Computes every census indicator from the output of `totals`."""
    thousands = 1000.0  # the census reports millions of pesos; indicators use thousands
    return pl.concat(
        [
            series.ratio(frame, "labor_share", "wages", "value_added"),
            series.ratio(
                frame, "value_added_per_worker", "value_added", "workers", scale=thousands
            ),
            series.ratio(frame, "wage_per_paid_worker", "wages", "paid_workers", scale=thousands),
            _stratum_share(frame, "large_establishment_employment_share", "large"),
            _stratum_share(frame, "micro_establishment_employment_share", "micro"),
            _unpaid_share_micro(frame),
        ]
    )


def establishments_per_1000(frame: pl.DataFrame, population: pl.DataFrame) -> pl.DataFrame:
    """Establishments per thousand inhabitants, for the all-sector total."""
    joined = frame.filter(pl.col("sector") == TOTAL).join(population, on="territory", how="left")
    # Units are always published, so a null operand can only be the population.
    return series.ratio(
        joined,
        "establishments_per_1000",
        "units",
        "population",
        scale=1000.0,
        if_null=series.NO_POPULATION,
    )
