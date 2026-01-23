import sys
import os

# Ensure the src directory is in the python path if needed,
# but usually running from root works with 'from src...'
# However, explicit is checking is good practice if run from elsewhere,
# but simply:

from src.cli import app

if __name__ == "__main__":
    app()
