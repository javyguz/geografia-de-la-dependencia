"""Censo de Población y Vivienda 2020: inhabitants per state and municipality."""

import io
import zipfile
from pathlib import Path

import polars as pl

YEAR = 2020
_MEMBER = "iter_00_cpv2020/conjunto_de_datos/conjunto_de_datos_iter_00CSV20.csv"
_TOTAL = 0  # locality and municipality key of the rows that hold totals


def by_territory(raw: pl.DataFrame) -> pl.DataFrame:
    """Keeps the national, state and municipal totals, keyed like every other table."""
    municipality = pl.col("MUN").cast(pl.Int32)
    return raw.filter(pl.col("LOC").cast(pl.Int32) == _TOTAL).select(
        pl.when(municipality == _TOTAL)
        .then(pl.col("ENTIDAD"))
        .otherwise(pl.col("ENTIDAD") + pl.col("MUN"))
        .alias("territory"),
        pl.col("POBTOT").cast(pl.Float64).alias("population"),
    )


def read_by_territory(path: Path) -> pl.DataFrame:
    with zipfile.ZipFile(path) as archive:
        content = archive.read(_MEMBER)
    columns = ["ENTIDAD", "MUN", "LOC", "POBTOT"]
    return by_territory(pl.read_csv(io.BytesIO(content), columns=columns, infer_schema=False))
