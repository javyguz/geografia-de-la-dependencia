"""Downloads raw files once, caches them and pins their checksums.

The lock file records the SHA-256 and download date of every raw file. A build
fails if a cached or freshly downloaded file no longer matches its pinned
checksum, so a silent change at the source can never change a published figure.
"""

import hashlib
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


class SourceChangedError(Exception):
    pass


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


def download(raw: RawFile, target: Path) -> None:
    request = urllib.request.Request(raw.url, headers={"User-Agent": USER_AGENT})
    partial = target.with_suffix(target.suffix + ".part")
    with urllib.request.urlopen(request, timeout=120) as response:
        # INEGI serves a "page not found" HTML with status 200 for missing files.
        if "text/html" in response.headers.get("Content-Type", ""):
            raise SourceChangedError(f"{raw.url} returned a web page instead of a file")
        with partial.open("wb") as file:
            shutil.copyfileobj(response, file)
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
            f"{raw.name} does not match its pinned checksum. The source published a new "
            "version: review the change and run `uv run pipeline fetch --refresh`."
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
