"""The 32 states: official keys and names, and how to recognise them in each source."""

import unicodedata

NATIONAL = "00"

STATES = {
    "01": "Aguascalientes",
    "02": "Baja California",
    "03": "Baja California Sur",
    "04": "Campeche",
    "05": "Coahuila de Zaragoza",
    "06": "Colima",
    "07": "Chiapas",
    "08": "Chihuahua",
    "09": "Ciudad de México",
    "10": "Durango",
    "11": "Guanajuato",
    "12": "Guerrero",
    "13": "Hidalgo",
    "14": "Jalisco",
    "15": "México",
    "16": "Michoacán de Ocampo",
    "17": "Morelos",
    "18": "Nayarit",
    "19": "Nuevo León",
    "20": "Oaxaca",
    "21": "Puebla",
    "22": "Querétaro",
    "23": "Quintana Roo",
    "24": "San Luis Potosí",
    "25": "Sinaloa",
    "26": "Sonora",
    "27": "Tabasco",
    "28": "Tamaulipas",
    "29": "Tlaxcala",
    "30": "Veracruz de Ignacio de la Llave",
    "31": "Yucatán",
    "32": "Zacatecas",
}

# Short or older names that some sources use instead of the official one.
_ALIASES = {
    "coahuila": "05",
    "distrito federal": "09",
    "estado de mexico": "15",
    "michoacan": "16",
    "queretaro de arteaga": "22",
    "veracruz": "30",
}


def _normalize(name: str) -> str:
    without_accents = unicodedata.normalize("NFKD", name).encode("ascii", "ignore").decode()
    return " ".join(without_accents.lower().split())


_NATIONAL_NAMES = {"nacional": NATIONAL, "estados unidos mexicanos": NATIONAL}

_BY_NAME = {_normalize(name): code for code, name in STATES.items()} | _ALIASES | _NATIONAL_NAMES


def territory_code(name: object) -> str | None:
    """Returns the key for a state or national label, or None for any other text."""
    return _BY_NAME.get(_normalize(name)) if isinstance(name, str) else None
