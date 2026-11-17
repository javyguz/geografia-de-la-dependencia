import pytest

from pipeline.cli import main


def test_a_command_is_required() -> None:
    with pytest.raises(SystemExit):
        main([])


def test_unknown_commands_are_rejected() -> None:
    with pytest.raises(SystemExit):
        main(["publish"])
