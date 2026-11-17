import polars as pl
import pytest

from pipeline.transform import immex, population
from pipeline.transform import state_tables as tables


def test_exports_are_converted_from_thousands_of_dollars() -> None:
    rows: list[tables.Row] = [
        ("Miles de dólares", None, None),
        ("Entidad Federativa", 2022, "2023 P/"),
        ("Exportaciones totales*", 900, 1000),
        ("Coahuila de Zaragoza", 90, 100),
        ("Notas:", None, None),
    ]
    assert tables.exports(rows, 2023) == {"00": 1_000_000.0, "05": 100_000.0}


def test_fdi_adds_the_fourth_quarter_of_each_year() -> None:
    rows: list[tables.Row] = [
        ("Entidad Federativa", "2022", None, None, None, "2023", None, None, None),
        (None, 1, 2, 3, 4, 1, 2, 3, 4),
        ("Total general", 1.0, 2.0, 3.0, 10.0, 2.0, 4.0, 6.0, 20.0),
        ("Ciudad de México", 0.5, 1.0, 1.5, 4.0, 1.0, 2.0, 3.0, 8.0),
        ("Nuevas inversiones", 9.0, 9.0, 9.0, 9.0, 9.0, 9.0, 9.0, 9.0),
    ]  # fmt: skip
    assert tables.fdi(rows, range(2022, 2024)) == {"00": 30_000_000.0, "09": 12_000_000.0}


def test_fdi_fails_when_a_year_is_incomplete() -> None:
    rows: list[tables.Row] = [("Entidad Federativa", "2023", None), (None, 1, 2)]
    with pytest.raises(ValueError, match="fourth quarter"):
        tables.fdi(rows, range(2023, 2024))


def test_informality_reads_only_the_point_estimates() -> None:
    sheet: list[tables.Row] = [
        ("Nacional", None, 55.0),
        ("Oaxaca", None, 80.0),
        ("Coeficientes de variación", None, None),
        ("Oaxaca", None, 1.5),
    ]
    assert tables.informality([sheet] * 4) == {"00": pytest.approx(0.55), "20": pytest.approx(0.8)}


def test_a_year_with_an_unpublished_quarter_has_no_annual_figure() -> None:
    rows: list[tables.Row] = [
        ("Año", "Trimestre", "Estados Unidos Mexicanos", "Guerrero"),
        ("2023", "I", 40.0, 60.0),
        (None, "II", 38.0, 61.0),
        (None, "III", 36.0, 62.0),
        (None, "IV", 34.0, "ND"),
    ]
    assert tables.working_poverty(rows, 2023) == {"00": pytest.approx(0.37)}


def test_immex_averages_months_and_keeps_grouped_states_only_in_the_national_total() -> None:
    def month(key: str, state: str, id_month: str, workers: str) -> dict[str, str]:
        return {
            "ID_MES": id_month,
            "CVEGEO": key,
            "CVE_ENT": state,
            "H114A": workers,
            "H200A": "0",
            "I400A": "0",
            "I500A": "0",
        }

    monthly = pl.DataFrame(
        [
            month("\t08037", "\t08", "\t01", "100"),
            month("\t08999", "\t08", "\t01", "50"),
            month("\t08037", "\t08", "\t02", "110"),
            month("\t08999", "\t08", "\t02", "60"),
            month("\t99", "\t99", "\t01", "30"),
            month("\t99", "\t99", "\t02", "30"),
        ]
    )
    result = dict(immex.workers_by_state(monthly).rows())
    assert result == {"00": 190.0, "08": 160.0}


def test_population_keeps_national_state_and_municipal_totals() -> None:
    raw = pl.DataFrame(
        {
            "ENTIDAD": ["00", "01", "01", "01"],
            "MUN": ["000", "000", "001", "001"],
            "LOC": ["0000", "0000", "0000", "0001"],
            "POBTOT": ["1000", "300", "200", "150"],
        }
    )
    assert dict(population.by_territory(raw).rows()) == {"00": 1000.0, "01": 300.0, "01001": 200.0}
