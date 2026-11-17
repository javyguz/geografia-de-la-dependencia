"""Turns catalog.toml into the catalog the web app reads."""

import tomllib
from pathlib import Path
from typing import Any

from pipeline.fetch.download import Lock

CATALOG_FILE = Path(__file__).resolve().parents[1] / "catalog.toml"

type Catalog = dict[str, Any]


def load_definition() -> Catalog:
    with CATALOG_FILE.open("rb") as file:
        return tomllib.load(file)


def build_catalog(definition: Catalog, lock: Lock, notes: dict[str, str]) -> Catalog:
    """Adds what only the build knows: download dates and figures quoted in the notes.

    `notes` fills the `{placeholders}` that some limitations carry, so a figure
    quoted in a text always comes from the data of the same build.
    """
    sources = [
        {**{k: v for k, v in source.items() if k != "file"}, **_retrieved(source, lock)}
        for source in definition["sources"]
    ]
    indicators = [_fill(indicator, notes) for indicator in definition["indicators"]]
    return {**definition, "sources": sources, "indicators": indicators}


def _retrieved(source: Catalog, lock: Lock) -> dict[str, str]:
    return {"retrieved_at": lock[source["file"]]["retrieved_at"]}


def _fill(indicator: Catalog, notes: dict[str, str]) -> Catalog:
    filled = {
        **indicator,
        "limitations": [text.format(**notes) for text in indicator["limitations"]],
    }
    if "warning" in indicator:
        filled["warning"] = indicator["warning"].format(**notes)
    return filled
