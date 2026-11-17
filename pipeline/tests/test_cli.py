import pytest

from pipeline.cli import main


def test_build_command_succeeds(capsys: pytest.CaptureFixture[str]) -> None:
    assert main(["build"]) == 0
    assert "pipeline build" in capsys.readouterr().out


def test_command_is_required() -> None:
    with pytest.raises(SystemExit):
        main([])
