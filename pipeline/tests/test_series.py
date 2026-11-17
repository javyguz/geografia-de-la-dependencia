import polars as pl

from pipeline.transform import series


def frame(**columns: list[float | None]) -> pl.DataFrame:
    rows = len(next(iter(columns.values())))
    return pl.DataFrame(
        {
            "territory": [f"{i + 1:02d}" for i in range(rows)],
            "sector": "total",
            "year": 2023,
            **columns,
        },
        schema_overrides=dict.fromkeys(columns, pl.Float64),
    )


def test_ratio_divides_and_scales() -> None:
    result = series.ratio(frame(a=[1.0], b=[4.0]), "x", "a", "b", scale=100)
    assert result.row(0, named=True) == {
        "territory": "01",
        "indicator": "x",
        "sector": "total",
        "year": 2023,
        "value": 25.0,
        "missing": None,
    }


def test_ratio_never_fills_a_withheld_figure() -> None:
    result = series.ratio(frame(a=[None, 1.0], b=[4.0, None]), "x", "a", "b")
    assert result["value"].to_list() == [None, None]
    assert result["missing"].to_list() == ["confidential", "confidential"]


def test_ratio_with_a_non_positive_denominator_is_not_computable() -> None:
    result = series.ratio(frame(a=[1.0, 1.0], b=[0.0, -2.0]), "x", "a", "b")
    assert result["value"].to_list() == [None, None]
    assert result["missing"].to_list() == ["not_computable", "not_computable"]


def test_share_outside_its_whole_is_not_computable() -> None:
    result = series.share(frame(part=[-1.0, 5.0, 1.0], whole=[4.0, 4.0, 4.0]), "x", "part", "whole")
    assert result["value"].to_list() == [None, None, 0.25]
    assert result["missing"].to_list() == ["not_computable", "not_computable", None]


def test_complete_adds_a_reason_for_every_absent_territory() -> None:
    values = series.from_values({"01": 1.0}, "x", 2023)
    result = series.complete(values, ["01", "02", "03"], reasons={"03": "not_collected"})
    by_territory = {row["territory"]: row for row in result.to_dicts()}
    assert by_territory["01"]["value"] == 1.0
    assert by_territory["02"]["missing"] == "not_published"
    assert by_territory["03"]["missing"] == "not_collected"
