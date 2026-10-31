---
type: Attested Computation
title: Broken computation
description: Exercises the computation, trust, and provenance rules.
computation: /references/computations/missing.sql
parameters:
  - { name: year }
  - { type: integer, required: yes }
executor:
  receipt: job_id
attester: references/attesters/none.py
generated: { by: team:data }
verified:
  - { by: jane, at: yesterday }
stale_after: 2020-01-01T00:00:00Z
sources:
  - id: policy
    title: A source without a resource
  - id: policy
    resource: https://wiki.example.com/policy
  - resource: dashboards/exec
    usage_count: many
    last_modified: 2026-06
  - resource: dashboards/ops
    usage_count: 12
    usage_window: { from: 2026-07-01T00:00:00Z, to: 2026-06-01T00:00:00Z }
---

# Computation

```sql
SELECT 1
```
