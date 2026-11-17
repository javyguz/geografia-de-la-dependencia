"""State-level spreadsheets: exports, foreign direct investment, informality and working poverty.

Each reader returns a mapping from territory key to value in the unit of the indicator.
"""

import io
import zipfile
from pathlib import Path

from openpyxl import load_workbook

from pipeline.transform.states import NATIONAL, territory_code

type Row = tuple[object, ...]
type Values = dict[str, float]

_INFORMALITY_WORKBOOK = "Tasas de informalidad por trimestre/Tasas_Infor_enti-1.xlsx"
_QUARTERS = (1, 2, 3, 4)


def _rows(source: Path | io.BytesIO, sheet: str | None = None) -> list[Row]:
    workbook = load_workbook(source, read_only=True)
    worksheet = workbook[sheet] if sheet else workbook.worksheets[0]
    return list(worksheet.iter_rows(values_only=True))


def _mean(values: list[float]) -> float:
    return sum(values) / len(values)


def exports(rows: list[Row], year: int) -> Values:
    """Merchandise exports by state, in US dollars. The sheet reports thousands."""
    header = next(row for row in rows if row[0] == "Entidad Federativa")
    column = next(i for i, cell in enumerate(header) if str(cell).startswith(str(year)))
    result: Values = {}
    for row in rows:
        label = str(row[0] or "")
        code = NATIONAL if label.startswith("Exportaciones totales") else territory_code(label)
        amount = row[column]
        if code is not None and isinstance(amount, int | float):
            result[code] = float(amount) * 1000
    return result


def fdi(rows: list[Row], years: range) -> Values:
    """Foreign direct investment received by each state over `years`, in US dollars.

    The sheet reports millions, accumulated within each year, so the fourth
    quarter column is the annual flow.
    """
    year_row = next(row for row in rows if str(row[0] or "").startswith("Entidad Federativa"))
    quarter_row = rows[rows.index(year_row) + 1]
    annual_columns: list[int] = []
    current_year = None
    for index, cell in enumerate(year_row):
        if index > 0 and cell is not None:
            current_year = int(str(cell)[:4])
        if current_year in years and str(quarter_row[index]) == "4":
            annual_columns.append(index)
    if len(annual_columns) != len(years):
        raise ValueError("the FDI sheet does not have a fourth quarter for every requested year")

    result: Values = {}
    for row in rows:
        label = str(row[0] or "")
        code = NATIONAL if label.strip() == "Total general" else territory_code(label)
        if code is not None:
            result[code] = sum(float(row[c] or 0) for c in annual_columns) * 1_000_000  # type: ignore[arg-type]
    return result


def _annual_mean(quarterly: dict[str, list[object]]) -> Values:
    """Averages the quarters of a year, only for territories with a figure in all four.

    INEGI leaves a quarter unpublished when the survey could not be fielded;
    averaging the remaining quarters would pass off a partial year as a full one.
    """
    return {
        code: _mean([float(v) / 100 for v in values if isinstance(v, int | float)])
        for code, values in quarterly.items()
        if len(values) == len(_QUARTERS) and all(isinstance(v, int | float) for v in values)
    }


def informality(sheets: list[list[Row]]) -> Values:
    """Labour informality rate (TIL1), averaged over the four quarterly sheets of a year."""
    quarterly: dict[str, list[object]] = {}
    for rows in sheets:
        seen: set[str] = set()
        for row in rows:
            code = territory_code(row[0])
            # Each sheet repeats the states in later blocks with precision statistics;
            # the point estimates are the first block.
            if code is not None and code not in seen:
                seen.add(code)
                quarterly.setdefault(code, []).append(row[2])
    return _annual_mean(quarterly)


def working_poverty(rows: list[Row], year: int) -> Values:
    """Share of people whose labour income is below the food basket, averaged over the year."""
    header = next(row for row in rows if row[0] == "Año")
    start = next(i for i, row in enumerate(rows) if str(row[0]) == str(year))
    quarters = rows[start : start + len(_QUARTERS)]
    quarterly = {
        code: [row[i] for row in quarters]
        for i, cell in enumerate(header)
        if (code := territory_code(cell)) is not None
    }
    return _annual_mean(quarterly)


def read_exports(path: Path, year: int) -> Values:
    return exports(_rows(path), year)


def read_fdi(path: Path, years: range) -> Values:
    return fdi(_rows(path, "EF por Tipo de Inversión"), years)


def read_informality(path: Path, year: int) -> Values:
    with zipfile.ZipFile(path) as archive:
        workbook = io.BytesIO(archive.read(_INFORMALITY_WORKBOOK))
    sheets = [_rows(workbook, f"Per-{quarter}{year % 100:02d}") for quarter in _QUARTERS]
    return informality(sheets)


def read_working_poverty(path: Path, year: int) -> Values:
    return working_poverty(_rows(path, "Cuadro 9"), year)
