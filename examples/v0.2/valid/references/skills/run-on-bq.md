---
type: Skill
title: Run an Attested Computation on BigQuery
description: "Executor instructions for `runtime: bigquery` computations; binds parameters, submits the job, and returns a receipt."
tags: [skill, executor, bigquery]
status: stable
generated: { by: human:kliu, at: 2026-06-20T10:00:00Z }
---

# Steps

1. Load the computation from the `# Computation` fence or the `computation` file.
2. Bind the declared `parameters` as named query parameters; never interpolate.
3. Submit the job and wait for completion.
4. Return exactly the fields named in `executor.receipt`.
