import io
from pathlib import Path
from typing import Any

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


class FakeResponse(io.BytesIO):
    """What urlopen returns: a stream with headers, usable as a context manager."""

    def __init__(self, body: bytes, length: int) -> None:
        super().__init__(body)
        self.headers = {"Content-Type": "application/zip", "Content-Length": str(length)}


def serve(monkeypatch: pytest.MonkeyPatch, *responses: FakeResponse) -> list[Any]:
    calls: list[Any] = []
    queue = list(responses)

    def urlopen(request: Any, timeout: int) -> FakeResponse:
        calls.append(request)
        return queue.pop(0)

    monkeypatch.setattr(download.urllib.request, "urlopen", urlopen)
    return calls


def test_a_download_cut_short_is_retried(raw_dir: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    calls = serve(monkeypatch, FakeResponse(b"PK", 4), FakeResponse(b"PK..", 4))
    download.download(RAW, raw_dir / RAW.name)
    assert len(calls) == 2
    assert (raw_dir / RAW.name).read_bytes() == b"PK.."


def test_a_download_that_never_arrives_whole_is_not_called_a_new_version(
    raw_dir: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    serve(monkeypatch, *(FakeResponse(b"PK", 4) for _ in range(download.ATTEMPTS)))
    with pytest.raises(download.DownloadError):
        download.download(RAW, raw_dir / RAW.name)
    assert not (raw_dir / RAW.name).exists()
