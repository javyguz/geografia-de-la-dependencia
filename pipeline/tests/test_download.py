from pathlib import Path

import pytest

from pipeline.fetch import download
from pipeline.fetch.sources import RawFile

RAW = RawFile("table.csv", "https://example.invalid/table.csv")


@pytest.fixture
def raw_dir(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> Path:
    monkeypatch.setattr(download, "RAW_DIR", tmp_path)
    return tmp_path


def test_a_cached_file_is_pinned_the_first_time(raw_dir: Path) -> None:
    (raw_dir / RAW.name).write_text("a,b\n1,2\n", encoding="utf-8")
    lock: download.Lock = {}
    path = download.ensure(RAW, lock)
    assert path == raw_dir / RAW.name
    assert lock[RAW.name]["sha256"] == download.sha256_of(path)
    assert lock[RAW.name]["url"] == RAW.url


def test_a_file_that_changed_at_the_source_stops_the_build(raw_dir: Path) -> None:
    (raw_dir / RAW.name).write_text("a,b\n1,3\n", encoding="utf-8")
    lock: download.Lock = {RAW.name: {"sha256": "0" * 64, "retrieved_at": "2026-01-01"}}
    with pytest.raises(download.SourceChangedError):
        download.ensure(RAW, lock)
