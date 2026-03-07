from pathlib import Path

# Directories to completely ignore
EXCLUDE_DIRS = {
    "node_modules",
    "venv",
    ".venv",
    "__pycache__",
    ".git",
    ".next",
    "dist",
    "build",
    ".idea",
    ".vscode",
    "media",
    "staticfiles",
}

# File extensions worth exporting
ALLOWED_EXTENSIONS = {
    ".py",
    ".ts",
    ".tsx",
    ".js",
    ".html",
    ".css",
    ".json",
    ".md",
    ".yml",
    ".yaml",
    ".go",
    ".mod",
    ".sum"
}

# Max file size to read (in bytes) — safety guard
MAX_FILE_SIZE = 300_000  # ~300 KB


def is_excluded_dir(path: Path) -> bool:
    return path.name in EXCLUDE_DIRS


def is_allowed_file(path: Path) -> bool:
    return path.suffix.lower() in ALLOWED_EXTENSIONS


def is_file_too_large(path: Path) -> bool:
    try:
        return path.stat().st_size > MAX_FILE_SIZE
    except OSError:
        return True
