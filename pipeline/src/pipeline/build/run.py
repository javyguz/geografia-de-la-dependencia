"""`pipeline build`: from the raw files to the artifacts in web/public/data."""

import polars as pl

from pipeline import schemas
from pipeline.build import export
from pipeline.build.catalog import build_catalog, load_definition
from pipeline.fetch import sources
from pipeline.fetch.download import fetch_all
from pipeline.paths import OUTPUT_DIR, RAW_DIR
from pipeline.transform import census, foreign_capital, geometry, immex, population, series
from pipeline.transform import state_tables as tables
from pipeline.transform.series import NOT_COLLECTED, NOT_COMPUTABLE, TOTAL
from pipeline.transform.states import NATIONAL, STATES

YEAR = 2023
FDI_YEARS = range(2019, 2024)
MANUFACTURING = "31-33"
MEXICO_CITY = "09"

STATE_IDS = [NATIONAL, *STATES]


def is_state(frame: pl.DataFrame) -> pl.Series:
    return frame["territory"].str.len_chars() == 2


def census_series(
    inhabitants: pl.DataFrame, municipality_ids: list[str]
) -> tuple[pl.DataFrame, pl.DataFrame]:
    """Returns the census indicators for both editions and the 2023 totals they came from."""
    parts: list[pl.DataFrame] = []
    totals_by_year: dict[int, pl.DataFrame] = {}
    for edition, year in sources.CENSUS_EDITIONS.items():
        files = [sources.census_file(t, edition) for t in sources.CENSUS_FILE_CODES]
        cells = pl.concat(census.read_cells(RAW_DIR / file.name, year) for file in files)
        totals = census.totals(cells)
        totals_by_year[year] = totals
        values = census.indicators(totals)
        if year == YEAR:
            per_1000 = census.establishments_per_1000(totals, inhabitants)
            values = pl.concat([values, per_1000])

        not_collected = (
            dict.fromkeys(census.NOT_COLLECTED_2024, NOT_COLLECTED) if year == YEAR else {}
        )
        for in_level, ids in ((is_state(values), STATE_IDS), (~is_state(values), municipality_ids)):
            level_values = values.filter(in_level)
            present = level_values["territory"].unique().to_list()
            # A territory the census covers but with no row for a sector has no
            # establishments in it; a territory with no rows at all was not covered.
            covered = series.complete(level_values, present, default=NOT_COMPUTABLE)
            parts.append(series.complete(covered, ids, reasons=not_collected))
    return pl.concat(parts), totals_by_year[YEAR]


def foreign_capital_series(census_totals: pl.DataFrame) -> pl.DataFrame:
    groups = foreign_capital.by_group(
        foreign_capital.read_rows(RAW_DIR / sources.FOREIGN_CAPITAL.name)
    )
    values = pl.concat(
        [foreign_capital.indicators(groups), foreign_capital.coverage(groups, census_totals)]
    )
    # A state with no row for a sector has no large units in it.
    return series.complete(values, STATE_IDS, default=NOT_COMPUTABLE)


def per_capita(amounts: tables.Values, inhabitants: dict[str, float]) -> tables.Values:
    return {key: amount / inhabitants[key] for key, amount in amounts.items()}


def state_series(
    inhabitants: dict[str, float], census_totals: pl.DataFrame
) -> tuple[pl.DataFrame, dict[str, str]]:
    """Returns the state-only indicators and the figures quoted in the catalog notes."""
    fdi = tables.read_fdi(RAW_DIR / sources.FDI.name, FDI_YEARS)
    exports = tables.read_exports(RAW_DIR / sources.EXPORTS.name, YEAR)
    informality = tables.read_informality(RAW_DIR / sources.INFORMALITY.name, YEAR)
    poverty = tables.read_working_poverty(RAW_DIR / sources.WORKING_POVERTY.name, YEAR)

    manufacturing = census_totals.filter(pl.col("sector") == MANUFACTURING).select(
        "territory", "workers", "year", pl.lit(TOTAL).alias("sector")
    )
    immex_workers = immex.read_workers_by_state(RAW_DIR / sources.IMMEX.name, YEAR)
    immex_share = series.ratio(
        immex_workers.join(manufacturing, on="territory", how="inner"),
        "immex_employment_share",
        "immex_workers",
        "workers",
    )
    values = pl.concat(
        [
            series.from_values(per_capita(exports, inhabitants), "exports_per_capita", YEAR),
            series.from_values(per_capita(fdi, inhabitants), "fdi_per_capita", YEAR),
            series.from_values(informality, "informality_rate", YEAR),
            series.from_values(poverty, "working_poverty_rate", YEAR),
            immex_share,
        ]
    )
    notes = {"cdmx_share": f"{fdi[MEXICO_CITY] / fdi[NATIONAL] * 100:.1f} %"}
    return series.complete(values, STATE_IDS), notes


def build() -> None:
    lock = fetch_all(sources.all_raw_files())

    print("simplifying boundaries")
    states, municipalities = geometry.read_boundaries(RAW_DIR / sources.GEOMETRY.name)
    municipality_ids = municipalities.ids

    print("computing indicators")
    inhabitants = population.read_by_territory(RAW_DIR / sources.POPULATION.name)
    inhabitants_by_id = dict(zip(inhabitants["territory"], inhabitants["population"], strict=True))
    census_values, census_totals = census_series(inhabitants, municipality_ids)
    state_values, notes = state_series(inhabitants_by_id, census_totals)
    values = pl.concat([census_values, foreign_capital_series(census_totals), state_values])

    print("validating")
    catalog = build_catalog(load_definition(), lock, notes)
    schemas.validate_catalog(catalog)
    schemas.validate_series(values, catalog, municipality_ids)
    if states.ids != list(STATES):
        raise schemas.ValidationError("the state boundaries do not match the 32 states")

    print("exporting")
    state_rows = values.filter(is_state(values))
    municipal_rows = values.filter(~is_state(values))
    all_sectors = municipal_rows.filter(pl.col("sector") == TOTAL)
    by_sector = municipal_rows.filter(pl.col("sector") != TOTAL)

    states.write_geojson(OUTPUT_DIR / "geo" / "states.geojson")
    municipalities.write_geojson(OUTPUT_DIR / "geo" / "municipalities.geojson")
    export.write_json(OUTPUT_DIR / "catalog.json", catalog)
    export.write_json(
        OUTPUT_DIR / "territories.json",
        export.territories_file(
            {NATIONAL: "Nacional", **STATES},
            dict(zip(municipality_ids, municipalities.names, strict=True)),
            inhabitants_by_id,
        ),
    )
    export.write_json(
        OUTPUT_DIR / "values" / "states.json",
        export.values_file(state_rows, "state", STATE_IDS, catalog),
    )
    export.write_json(
        OUTPUT_DIR / "values" / "municipalities.json",
        export.values_file(all_sectors, "municipality", municipality_ids, catalog),
    )
    # One file per sector with every municipality: the map classifies over the whole
    # level, so a sector needs all municipalities at once and nothing else.
    sectors_dir = OUTPUT_DIR / "values" / "municipalities-sectors"
    for stale in sectors_dir.glob("*.json"):
        stale.unlink()
    for sector in by_sector["sector"].unique().sort():
        export.write_json(
            sectors_dir / f"{sector}.json",
            export.values_file(
                by_sector.filter(pl.col("sector") == sector),
                "municipality",
                municipality_ids,
                catalog,
            ),
        )
    print(f"done: artifacts written to {OUTPUT_DIR}")
