import polars as pl
import pytest

from pipeline.transform import census

HEADER = [
    "E03", "E04", "SECTOR", "SUBSECTOR", "ID_ESTRATO",
    "UE", "H001A", "H010A", "H020A", "J000A", "A131A",
]  # fmt: skip


def raw(*rows: list[str | None]) -> pl.DataFrame:
    records = [dict(zip(HEADER, row, strict=True)) for row in rows]
    return pl.DataFrame(records, schema=dict.fromkeys(HEADER, pl.String))


def indicators(*rows: list[str | None]) -> dict[tuple[str, str], dict[str, object]]:
    result = census.indicators(census.totals(census.clean_cells(raw(*rows), 2023)))
    return {(row["territory"], row["indicator"]): row for row in result.to_dicts()}


def test_reads_states_municipalities_and_the_national_file() -> None:
    cells = census.clean_cells(
        raw(
            [None, None, None, None, None, "9", "90", "80", "10", "5.0", "20.0"],
            ["01", None, "31-33 ", None, None, "3", "30", "25", "5", "2.0", "8.0"],
            ["01", "005", None, None, "1", "2", "4", "1", "3", "0.1", "0.4"],
            ["01", "005", "31-33", "311", None, "1", "2", "1", "1", "0.1", "0.2"],
        ),
        2023,
    )
    assert cells.select("territory", "sector", "stratum").rows() == [
        ("00", "total", 0),
        ("01", "31-33", 0),
        ("01005", "total", 1),
    ]


def test_ratios_use_thousands_of_pesos() -> None:
    values = indicators(["01", None, None, None, None, "10", "100", "80", "20", "8.0", "40.0"])
    assert values["01", "labor_share"]["value"] == pytest.approx(0.2)
    assert values["01", "value_added_per_worker"]["value"] == pytest.approx(400.0)
    assert values["01", "wage_per_paid_worker"]["value"] == pytest.approx(100.0)


def test_a_missing_stratum_is_zero_only_when_the_published_strata_add_up() -> None:
    values = indicators(
        ["01", None, None, None, None, "10", "100", "80", "20", "8.0", "40.0"],
        ["01", None, None, None, "1", "9", "60", "40", "20", "3.0", "10.0"],
        ["01", None, None, None, "2", "1", "40", "40", "0", "5.0", "30.0"],
    )
    assert values["01", "micro_establishment_employment_share"]["value"] == pytest.approx(0.6)
    assert values["01", "large_establishment_employment_share"]["value"] == 0.0
    assert values["01", "unpaid_worker_share_micro"]["value"] == pytest.approx(20 / 60)


def test_grouped_strata_are_confidential() -> None:
    values = indicators(
        ["01", None, None, None, None, "10", "100", "80", "20", "8.0", "40.0"],
        ["01", None, None, None, "1", "9", "60", "40", "20", "3.0", "10.0"],
        ["01", None, None, None, "99", "1", "40", "40", "0", "5.0", "30.0"],
    )
    large = values["01", "large_establishment_employment_share"]
    assert (large["value"], large["missing"]) == (None, "confidential")


def test_a_territory_without_strata_is_not_published() -> None:
    values = indicators(["01", None, None, None, None, "10", "100", "80", "20", "8.0", "40.0"])
    for indicator in (
        "micro_establishment_employment_share",
        "large_establishment_employment_share",
        "unpaid_worker_share_micro",
    ):
        assert (values["01", indicator]["value"], values["01", indicator]["missing"]) == (
            None,
            "not_published",
        )


def test_suppressed_figures_stay_null() -> None:
    values = indicators(["01", "005", None, None, None, "2", None, None, None, None, None])
    assert values["01005", "labor_share"]["missing"] == "confidential"


def test_establishments_per_1000_needs_a_census_population() -> None:
    totals = census.totals(
        census.clean_cells(
            raw(
                ["01", "001", None, None, None, "50", "9", "9", "0", "1.0", "2.0"],
                ["01", "002", None, None, None, "50", "9", "9", "0", "1.0", "2.0"],
            ),
            2023,
        )
    )
    population = pl.DataFrame({"territory": ["01001"], "population": [10_000.0]})
    result = census.establishments_per_1000(totals, population).sort("territory")
    assert result["value"].to_list() == [5.0, None]
    assert result["missing"].to_list() == [None, "no_population"]
