# Commit Copilot Update Info

## What's New in Version 1.18.0

- Added support for querying multiple file diffs in a single tool request while returning the complete exact diff for every requested file.
- Added an optional complete diff coverage setting, disabled by default, that requires every changed file to be inspected before finalizing the commit message.
- Fixed request cancellation to immediately abort active HTTP connections to LLM providers when generation is cancelled.
