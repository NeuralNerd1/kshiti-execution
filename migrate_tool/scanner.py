from pathlib import Path
from typing import Dict, Any

from filters import (
    is_excluded_dir,
    is_allowed_file,
    is_file_too_large,
)
from utils.tree import insert_into_tree


class ProjectScanner:
    def __init__(self, root_path: Path):
        self.root_path = root_path.resolve()
        self.tree: Dict[str, Any] = {}

    def scan(self) -> Dict[str, Any]:
        """
        Entry point: scans folders in the execution platform.
        """
        for folder in ["frontend", "core", "services", "configs", "infra", "docs"]:
            folder_path = self.root_path / folder
            if folder_path.exists() and folder_path.is_dir():
                self.tree[folder] = {}
                self._scan_directory(folder_path, self.tree[folder])

        return self.tree

    def _scan_directory(self, directory: Path, subtree: dict):
        """
        Recursively scan directories and files.
        """
        for item in sorted(directory.iterdir(), key=lambda x: x.name):
            if item.is_dir():
                if is_excluded_dir(item):
                    continue

                subtree[item.name] = {}
                self._scan_directory(item, subtree[item.name])

                # Remove empty directories
                if not subtree[item.name]:
                    subtree.pop(item.name)

            elif item.is_file():
                if not is_allowed_file(item):
                    continue

                if is_file_too_large(item):
                    subtree[item.name] = {
                        "path": str(item),
                        "skipped": True,
                        "reason": "file_too_large",
                    }
                    continue

                try:
                    content = item.read_text(encoding="utf-8", errors="ignore")
                except Exception:
                    subtree[item.name] = {
                        "path": str(item),
                        "skipped": True,
                        "reason": "unreadable",
                    }
                    continue

                subtree[item.name] = {
                    "path": str(item),
                    "skipped": False,
                    "content": content,
                }
