"""Command-line entry point: `uv run pipeline build`."""

import argparse
from collections.abc import Sequence


def build() -> None:
    print("pipeline build: no artifacts defined yet")


def main(argv: Sequence[str] | None = None) -> int:
    parser = argparse.ArgumentParser(
        prog="pipeline",
        description="Builds the data artifacts for Geografía de la dependencia.",
    )
    subcommands = parser.add_subparsers(dest="command", required=True)
    subcommands.add_parser("build", help="regenerate every artifact from the public sources")

    parser.parse_args(argv)
    build()
    return 0
