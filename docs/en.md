# Commit Copilot Update Info

## What's New in Version 1.18.0

- Added support for querying multiple file diffs in a single tool request while returning the complete exact diff for every requested file.
- Enforced complete diff coverage inspection before finalizing commit message generation to prevent missing file changes.
- Fixed request cancellation to immediately abort active HTTP connections to LLM providers when generation is cancelled.
