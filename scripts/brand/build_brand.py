"""Compatibility entry point for raster exports. Requires Bash and ImageMagick 7.

The old vector generator is preserved under branding/archive/retired/vector-v0.2/.
This entry point never redraws artwork or overwrites either approved master.
"""
from pathlib import Path
import subprocess

if __name__ == "__main__":
    subprocess.run(["bash", str(Path(__file__).with_suffix(".sh"))], check=True)
