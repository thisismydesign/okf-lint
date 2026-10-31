---
type: Attested Computation
title: Gross profit for fiscal year
description: Gross profit by segment for a fiscal year, per the cost-allocation standard.
tags: [finance, profit]
status: stable
runtime: dbt
computation: /references/computations/profit.sql
parameters:
  - { name: year, type: integer, required: true }
  - { name: segment, type: string, required: true }
executor:
  resource: /references/skills/run-on-bq.md
  receipt: [run_id, compiled_sql, result]
attester:
  resource: /references/attesters/sql-equality.py
generated: { by: reference_agent/gemini-2.5-pro, at: 2026-06-14T14:00:00Z }
verified:
  - { by: human:ahormati, at: 2026-06-12T08:00:00Z }
  - { by: process:finance-nightly, at: 2026-06-27T02:00:00Z }
stale_after: 2099-01-01T00:00:00Z
sources:
  - id: cost-alloc
    resource: https://wiki.example.com/finance/cost-allocation
    title: Cost allocation standard
---

# Definition

Gross profit by segment per the cost-allocation standard.[^cost-alloc] The
model lives in `/references/computations/profit.sql`; see the
[revenue computation](/computations/revenue.md) for the inline form.

[^cost-alloc]: Cost allocation standard
