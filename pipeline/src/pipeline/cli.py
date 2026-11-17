"""Command-line entry point: `uv run pipeline build`."""

import argparse
from collections.abc import Sequence

from pipeline.fetch.download import fetch_all
from pipeline.fetch.sources import all_raw_files


def main(argv: Sequence[str] | None = None) -> int:
    parser = argparse.ArgumentParser(
        prog="pipeline",
        description="Builds the data artifacts for Geografía de la dependencia.",
    )
    subcommands = parser.add_subparsers(dest="command", required=True)
    subcommands.add_parser("build", help="regenerate every artifact from the public sources")
    fetch = subcommands.add_parser("fetch", help="download the raw files without building")
    fetch.add_argument(
        "--refresh",
        action="store_true",
        help="download again and pin the new checksums",
    )

    args = parser.parse_args(argv)
    if args.command == "fetch":
        fetch_all(all_raw_files(), refresh=args.refresh)
    else:
        # Imported here so `pipeline fetch` does not load the geospatial stack.
        from pipeline.build.run import build

        build()
    return 0
