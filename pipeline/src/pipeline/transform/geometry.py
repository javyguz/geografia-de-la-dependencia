"""Marco Geoestadístico: state and municipal boundaries, simplified for the web.

States are built by merging municipalities, so both levels share exactly the
same borders.
"""

# geopandas ships incomplete type information. The checks are relaxed here, and
# the module hands the rest of the pipeline plain, fully typed values.
# pyright: reportUnknownMemberType=false, reportUnknownVariableType=false
# pyright: reportUnknownArgumentType=false

from dataclasses import dataclass
from pathlib import Path
from typing import Any

import geopandas as gpd
import shapely

from pipeline.transform.states import STATES

WGS84 = "EPSG:4326"

# The framework is in a metric projection, so these are metres.
STATE_TOLERANCE = 3000
MUNICIPALITY_TOLERANCE = 600
# Neighbouring polygons in the source differ by centimetres along their shared
# border. Snapping to a one-metre grid makes those borders identical, which the
# joint simplification needs in order to treat them as one line.
SNAP_GRID = 1.0

_MUNICIPALITIES_LAYER = "conjunto_de_datos/00mun.shp"


@dataclass(frozen=True)
class Boundaries:
    """Simplified polygons of one level, ordered by key."""

    frame: Any
    ids: list[str]
    names: list[str]

    def write_geojson(self, path: Path) -> None:
        path.parent.mkdir(parents=True, exist_ok=True)
        # Four decimals are about 11 metres, well below what the simplification keeps.
        self.frame.to_file(path, driver="GeoJSON", COORDINATE_PRECISION=4)


def _simplify(boundaries: Any, tolerance: float) -> Boundaries:
    """Simplifies all polygons together so neighbours keep sharing the same border.

    Simplifying each polygon on its own would open gaps and overlaps between them.
    """
    simplified = shapely.coverage_simplify(boundaries.geometry.to_numpy(), tolerance)
    projected = boundaries.set_geometry(simplified, crs=boundaries.crs)
    frame = projected.to_crs(WGS84).sort_values("CVEGEO").reset_index(drop=True)
    return Boundaries(frame, frame["CVEGEO"].tolist(), frame["name"].tolist())


def _snap(boundaries: Any) -> Any:
    snapped = shapely.set_precision(boundaries.geometry.to_numpy(), SNAP_GRID)
    return boundaries.set_geometry(snapped, crs=boundaries.crs)


def _merge_into_states(municipalities: Any) -> Any:
    by_state = municipalities[["geometry"]].assign(CVEGEO=municipalities["CVEGEO"].str.slice(0, 2))
    states = by_state.dissolve(by="CVEGEO", as_index=False)
    states["name"] = states["CVEGEO"].map(STATES)
    return states[["CVEGEO", "name", "geometry"]]


def read_boundaries(archive: Path) -> tuple[Boundaries, Boundaries]:
    """Returns the simplified state and municipal boundaries, in that order."""
    raw = gpd.read_file(f"zip://{archive}!{_MUNICIPALITIES_LAYER}")
    municipalities = _snap(raw.rename(columns={"NOMGEO": "name"})[["CVEGEO", "name", "geometry"]])
    states = _merge_into_states(municipalities)
    return (
        _simplify(states, STATE_TOLERANCE),
        _simplify(municipalities, MUNICIPALITY_TOLERANCE),
    )
