"""Every raw file the pipeline reads and the direct URL it comes from.

URLs were verified one by one; see docs/fuentes.md.
"""

from dataclasses import dataclass

INEGI = "https://www.inegi.org.mx/contenidos"

# INEGI names its national and per-state census files with these abbreviations.
CENSUS_FILE_CODES = {
    "00": "nac", "01": "ags", "02": "bc", "03": "bcs", "04": "camp", "05": "coah", "06": "col",
    "07": "chis", "08": "chih", "09": "cdmx", "10": "dgo", "11": "gto", "12": "gro",
    "13": "hgo", "14": "jal", "15": "mex", "16": "mich", "17": "mor", "18": "nay",
    "19": "nl", "20": "oax", "21": "pue", "22": "qro", "23": "qroo", "24": "slp",
    "25": "sin", "26": "son", "27": "tab", "28": "tamps", "29": "tlax", "30": "ver",
    "31": "yuc", "32": "zac",
}  # fmt: skip

# Census edition -> year the figures refer to.
CENSUS_EDITIONS = {2024: 2023, 2019: 2018}


@dataclass(frozen=True)
class RawFile:
    name: str
    url: str


def census_file(territory: str, edition: int) -> RawFile:
    """Open data of the country or one state.

    The 2019 edition is INEGI's recalculation of that census under SCIAN 2023.
    """
    name = f"conjunto_de_datos_ce_{CENSUS_FILE_CODES[territory]}_{edition}_csv.zip"
    return RawFile(name, f"{INEGI}/programas/ce/2024/datosabiertos/{name}")


FOREIGN_CAPITAL = RawFile(
    "capexce24_01.xlsx", f"{INEGI}/programas/ce/2024/tabulados/capexce24_01.xlsx"
)
EXPORTS = RawFile("EAEF_Entidad.xlsx", f"{INEGI}/programas/exporta_ef/tabulados/EAEF_Entidad.xlsx")
INFORMALITY = RawFile(
    "enoe_informalidad_tasas_xls.zip",
    f"{INEGI}/programas/enoe/15ymas/tabulados/enoe_informalidad_tasas_xls.zip",
)
WORKING_POVERTY = RawFile(
    "pl_2005t_2026t.xlsx", f"{INEGI}/desarrollosocial/pl/tabulados/pl_2005t_2026t.xlsx"
)
IMMEX = RawFile(
    "conjunto_de_datos_immex_manu_ent_csv.zip",
    f"{INEGI}/programas/immex/datosabiertos/conjunto_de_datos_immex_manu_ent_csv.zip",
)
POPULATION = RawFile(
    "iter_00_cpv2020_csv.zip",
    f"{INEGI}/programas/ccpv/2020/datosabiertos/iter/iter_00_cpv2020_csv.zip",
)
GEOMETRY = RawFile(
    "mg_2024_integrado.zip",
    f"{INEGI}/productos/prod_serv/contenidos/espanol/bvinegi/productos/geografia/marcogeo/"
    "794551132173/mg_2024_integrado.zip",
)
# The Secretaría de Economía publishes each quarter under a new URL; this pins 2026 Q2.
FDI = RawFile(
    "2026_2T_Flujos_EF_AC_5.xlsx",
    "https://www.gob.mx/cms/uploads/attachment/file/1100602/2026_2T_Flujos_EF_AC_5.xlsx",
)


def all_raw_files() -> list[RawFile]:
    census = [
        census_file(territory, edition)
        for edition in CENSUS_EDITIONS
        for territory in CENSUS_FILE_CODES
    ]
    return [
        *census,
        FOREIGN_CAPITAL,
        EXPORTS,
        INFORMALITY,
        WORKING_POVERTY,
        IMMEX,
        POPULATION,
        GEOMETRY,
        FDI,
    ]
