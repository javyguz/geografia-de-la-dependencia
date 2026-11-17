import pytest

from pipeline.transform import foreign_capital


def row(
    state: str,
    sector: str | None,
    participation: str,
    level: str = " ",
    *,
    workers: float | None = None,
    paid: float | None = None,
    wages: float | None = None,
    value_added: float | None = None,
    subsector: str | None = None,
) -> tuple[object, ...]:
    cells: list[object] = [None] * 37
    cells[0], cells[1], cells[2], cells[6], cells[7] = (
        state,
        sector,
        subsector,
        participation,
        level,
    )
    cells[10], cells[14], cells[17], cells[26] = workers, paid, wages, value_added
    return tuple(cells)


def indicators(*rows: tuple[object, ...]) -> dict[tuple[str, str, str], dict[str, object]]:
    groups = foreign_capital.by_group(foreign_capital.parse_rows(rows))
    result = foreign_capital.indicators(groups)
    return {(r["territory"], r["sector"], r["indicator"]): r for r in result.to_dicts()}


def test_shares_and_group_averages() -> None:
    values = indicators(
        row("08 Chih.", None, "  ", workers=100, paid=90, wages=20.0, value_added=80.0),
        row("08 Chih.", None, "01) Sin", workers=40, paid=30, wages=5.0, value_added=20.0),
        row("08 Chih.", None, "02) Con", workers=60, paid=60, wages=15.0, value_added=60.0),
        # Rows below the sector level and participation levels are ignored.
        row(
            "08 Chih.",
            None,
            "02) Con",
            "07) Más del 90",
            workers=1,
            paid=1,
            wages=1.0,
            value_added=1.0,
        ),
        row(
            "08 Chih.",
            "Sector 11",
            "  ",
            subsector="112",
            workers=1,
            paid=1,
            wages=1.0,
            value_added=1.0,
        ),
    )
    assert values["08", "total", "foreign_share_value_added"]["value"] == pytest.approx(0.75)
    assert values["08", "total", "foreign_share_employment"]["value"] == pytest.approx(0.6)
    assert values["08", "total", "wage_per_paid_worker_foreign"]["value"] == pytest.approx(250.0)
    assert values["08", "total", "labor_share_domestic"]["value"] == pytest.approx(0.25)
    assert len({sector for _, sector, _ in values}) == 1


def test_a_sector_with_only_domestic_units_has_a_true_zero() -> None:
    values = indicators(
        row("20 Oax.", "Sector 61", "  ", workers=10, paid=10, wages=1.0, value_added=4.0),
        row("20 Oax.", "Sector 61", "01) Sin", workers=10, paid=10, wages=1.0, value_added=4.0),
    )
    assert values["20", "61", "foreign_share_value_added"]["value"] == 0.0
    foreign_wage = values["20", "61", "wage_per_paid_worker_foreign"]
    assert (foreign_wage["value"], foreign_wage["missing"]) == (None, "not_computable")


def test_grouped_rows_are_confidential() -> None:
    values = indicators(
        row("20 Oax.", "Sector 21", "  ", workers=10, paid=10, wages=1.0, value_added=4.0)
    )
    share = values["20", "21", "foreign_share_value_added"]
    assert (share["value"], share["missing"]) == (None, "confidential")


def test_negative_value_added_is_not_a_share() -> None:
    values = indicators(
        row("04 Camp.", None, "  ", workers=10, paid=10, wages=1.0, value_added=4.0),
        row("04 Camp.", None, "01) Sin", workers=8, paid=8, wages=0.8, value_added=5.0),
        row("04 Camp.", None, "02) Con", workers=2, paid=2, wages=0.2, value_added=-1.0),
    )
    share = values["04", "total", "foreign_share_value_added"]
    assert (share["value"], share["missing"]) == (None, "not_computable")
