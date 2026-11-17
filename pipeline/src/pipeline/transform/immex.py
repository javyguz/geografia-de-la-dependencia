"""IMMEX: people working in manufacturing establishments with an export programme.

The monthly file has one row per month and area. An area is a state, a selected
municipality or the rest of a state; INEGI identifies 17 states and groups the others.
"""

import io
import zipfile
from pathlib import Path

import polars as pl

from pipeline.transform.states import NATIONAL

# Own staff (production and office) plus staff supplied by another company.
_WORKER_COLUMNS = ["H114A", "H200A", "I400A", "I500A"]
_GROUPED_STATES = "99"


def _monthly_mean(rows: pl.DataFrame, territory: pl.Expr) -> pl.DataFrame:
    workers = pl.sum_horizontal(pl.col(c).cast(pl.Float64) for c in _WORKER_COLUMNS)
    return (
        rows.group_by(territory.alias("territory"), "ID_MES")
        .agg(workers.sum().alias("workers"))
        .group_by("territory")
        .agg(pl.col("workers").mean().alias("immex_workers"))
    )


def workers_by_state(monthly: pl.DataFrame) -> pl.DataFrame:
    """Average number of people employed over the months in `monthly`.

    One row per identified state, plus the national total, which also counts
    the states INEGI groups.
    """
    rows = monthly.with_columns(pl.col("ID_MES", "CVEGEO", "CVE_ENT").str.strip_chars())
    identified = rows.filter(pl.col("CVE_ENT") != _GROUPED_STATES)
    states = _monthly_mean(identified, pl.col("CVEGEO").str.slice(0, 2))
    national = _monthly_mean(rows, pl.lit(NATIONAL))
    return pl.concat([national, states]).sort("territory")


def read_workers_by_state(path: Path, year: int) -> pl.DataFrame:
    with zipfile.ZipFile(path) as archive:
        content = archive.read(f"conjunto_de_datos/immex_manu_ent_{year}.csv")
    return workers_by_state(pl.read_csv(io.BytesIO(content), infer_schema=False))
