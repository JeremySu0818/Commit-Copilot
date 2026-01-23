import sys
import os

# Add the current directory to the path so that auto_commit package can be found
# when running main.py directly from the root.
sys.path.insert(0, os.path.abspath(os.path.dirname(__file__)))

from auto_commit.cli import app

if __name__ == "__main__":
    app()
