"""Downloads raw files once, caches them and pins their checksums.

The lock file records the SHA-256 and download date of every raw file. A build
fails if a cached or freshly downloaded file no longer matches its pinned
checksum, so a silent change at the source can never change a published figure.
"""

import hashlib
import http.client
import json
import shutil
import urllib.request
from datetime import date
from pathlib import Path

from pipeline.fetch.sources import RawFile
from pipeline.paths import LOCK_FILE, RAW_DIR

type Lock = dict[str, dict[str, str]]

# INEGI answers with a CAPTCHA page to long browser-like user agents.
USER_AGENT = "Mozilla/5.0"


# Large files (the geostatistical framework is 284 MB) sometimes arrive cut short.
ATTEMPTS = 3


class SourceChangedError(Exception):
    pass


class DownloadError(Exception):
    """The file could not be downloaded whole. Nothing is known about the source."""


def read_lock() -> Lock:
    if not LOCK_FILE.exists():
        return {}
    return json.loads(LOCK_FILE.read_text(encoding="utf-8"))


def write_lock(lock: Lock) -> None:
    text = json.dumps(lock, indent=2, sort_keys=True) + "\n"
    LOCK_FILE.write_text(text, encoding="utf-8", newline="\n")


def sha256_of(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as file:
        for chunk in iter(lambda: file.read(1 << 20), b""):
            digest.update(chunk)
    return digest.hexdigest()


def download_once(raw: RawFile, partial: Path) -> None:
    request = urllib.request.Request(raw.url, headers={"User-Agent": USER_AGENT})
    with urllib.request.urlopen(request, timeout=120) as response:
        # INEGI serves a "page not found" HTML with status 200 for missing files.
        if "text/html" in response.headers.get("Content-Type", ""):
            raise SourceChangedError(f"{raw.url} returned a web page instead of a file")
        expected = response.headers.get("Content-Length")
        with partial.open("wb") as file:
            shutil.copyfileobj(response, file)
    # A connection closed early leaves a short file without raising; the size tells.
    received = partial.stat().st_size
    if expected is not None and received != int(expected):
        raise DownloadError(f"received {received} of {expected} bytes")


def download(raw: RawFile, target: Path) -> None:
    partial = target.with_suffix(target.suffix + ".part")
    for attempt in range(1, ATTEMPTS + 1):
        try:
            download_once(raw, partial)
            break
        except (DownloadError, OSError, http.client.HTTPException) as error:
            partial.unlink(missing_ok=True)
            if attempt == ATTEMPTS:
                raise DownloadError(
                    f"{raw.name} could not be downloaded whole after {ATTEMPTS} attempts "
                    f"({error}). The source has not been shown to change; try again later."
                ) from error
            print(f"retrying {raw.name}: {error}")
    partial.replace(target)


def ensure(raw: RawFile, lock: Lock, *, refresh: bool = False) -> Path:
    """Returns the local path of a raw file, downloading it if it is not cached."""
    RAW_DIR.mkdir(parents=True, exist_ok=True)
    path = RAW_DIR / raw.name
    if refresh or not path.exists():
        print(f"downloading {raw.name}")
        download(raw, path)

    checksum = sha256_of(path)
    pinned = lock.get(raw.name)
    if pinned is None or refresh:
        lock[raw.name] = {
            "sha256": checksum,
            "retrieved_at": date.today().isoformat(),
            "url": raw.url,
        }
    elif pinned["sha256"] != checksum:
        raise SourceChangedError(
            f"{raw.name} ({path.stat().st_size} bytes) does not match its pinned checksum. The "
            "source published a new version: review the change and run "
            "`uv run pipeline fetch --refresh`."
        )
    return path


def fetch_all(raw_files: list[RawFile], *, refresh: bool = False) -> Lock:
    lock = read_lock()
    try:
        for raw in raw_files:
            ensure(raw, lock, refresh=refresh)
    finally:
        write_lock(lock)
    return lock
