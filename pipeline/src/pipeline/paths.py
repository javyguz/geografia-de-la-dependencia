"""Where the pipeline reads from and writes to."""

from pathlib import Path

PIPELINE_DIR = Path(__file__).resolve().parents[2]
REPO_DIR = PIPELINE_DIR.parent

RAW_DIR = PIPELINE_DIR / "data" / "raw"
LOCK_FILE = PIPELINE_DIR / "sources.lock.json"
OUTPUT_DIR = REPO_DIR / "web" / "public" / "data"
