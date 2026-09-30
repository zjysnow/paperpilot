# Paper reproduction project

## Purpose

State the paper identity, the target result, and the success tolerance here.
Link to the corresponding Obsidian reading note and Zotero item without
duplicating the PDF or bibliographic record.

## Quick start

1. Create the environment from the tracked manifest.
2. Place data in the project-relative location documented in
   [`docs/DATA_REQUIREMENTS.md`](docs/DATA_REQUIREMENTS.md).
3. Run the data validator:

   ```text
   <validation command>
   ```

4. Run the bounded smoke test:

   ```text
   <smoke-test command>
   ```

5. Record every meaningful experiment in
   [`docs/EXPERIMENT_RESULTS.md`](docs/EXPERIMENT_RESULTS.md).

## Repository rules

- Do not commit datasets, checkpoints, credentials, or generated outputs.
- Version configurations under `configs/`.
- Record the Git commit, command, configuration, data version, seed,
  environment, hardware, metrics, and artifacts for every result.
- Do not compare metrics with the paper until protocols are comparable.
