"""Discover a supported standard CPython runtime for Tracky.

The setup app and package scripts use this module so Python selection is
consistent across installation, upgrades, and LaunchAgent startup.
"""
from __future__ import annotations

import argparse
import glob
import json
import os
import shutil
import subprocess
from dataclasses import asdict, dataclass
from typing import Optional

MIN_VERSION = (3, 11)


@dataclass(frozen=True)
class PythonRuntime:
    path: str
    major: int
    minor: int
    micro: int
    implementation: str
    architecture: str
    gil_enabled: Optional[bool]

    @property
    def version(self) -> str:
        return f"{self.major}.{self.minor}.{self.micro}"

    @property
    def supported(self) -> bool:
        return (self.major, self.minor) >= MIN_VERSION and self.implementation == "cpython"

    @property
    def experimental(self) -> bool:
        return self.major == 3 and self.minor > 14


def candidate_paths() -> list[str]:
    paths: list[str] = []
    for name in ("python3", "python"):
        found = shutil.which(name)
        if found:
            paths.append(found)
    paths.extend(
        glob.glob("/Library/Frameworks/Python.framework/Versions/*/bin/python3")
        + glob.glob("/opt/homebrew/bin/python3*")
        + glob.glob("/usr/local/bin/python3*")
    )
    return list(dict.fromkeys(paths))


def inspect(path: str) -> PythonRuntime | None:
    probe = (
        "import json, platform, sys; "
        "print(json.dumps({'major':sys.version_info.major,'minor':sys.version_info.minor,"
        "'micro':sys.version_info.micro,'implementation':sys.implementation.name,"
        "'architecture':platform.machine(),"
        "'gil_enabled':(sys._is_gil_enabled() if hasattr(sys, '_is_gil_enabled') else None)}))"
    )
    try:
        result = subprocess.run([path, "-c", probe], capture_output=True, text=True, timeout=3, check=True)
        data = json.loads(result.stdout)
        return PythonRuntime(path=os.path.realpath(path), **data)
    except (OSError, subprocess.SubprocessError, ValueError, TypeError, json.JSONDecodeError):
        return None


def discover() -> list[PythonRuntime]:
    runtimes = [runtime for path in candidate_paths() if (runtime := inspect(path))]
    return sorted(
        {runtime.path: runtime for runtime in runtimes}.values(),
        key=lambda runtime: (runtime.major, runtime.minor, runtime.micro, runtime.path),
        reverse=True,
    )


def select() -> PythonRuntime:
    for runtime in discover():
        if runtime.supported:
            return runtime
    raise RuntimeError("Tracky requires standard CPython 3.11 or newer.")


def main() -> int:
    parser = argparse.ArgumentParser(description="Discover the Python runtime Tracky can use.")
    parser.add_argument("--json", action="store_true", help="Print all detected runtimes as JSON.")
    parser.add_argument("--path", action="store_true", help="Print the selected interpreter path.")
    args = parser.parse_args()
    runtimes = discover()
    if args.json:
        print(json.dumps({"minimum": "3.11", "selected": asdict(select()) if any(r.supported for r in runtimes) else None, "runtimes": [asdict(r) for r in runtimes]}))
        return 0
    runtime = select()
    print(runtime.path if args.path else f"Python {runtime.version} ({runtime.architecture}) at {runtime.path}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
