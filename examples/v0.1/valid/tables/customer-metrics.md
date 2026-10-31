---
type: Table
title: Customer Metrics
description: Aggregated daily customer KPIs for the analytics platform.
resource: bigquery://project.analytics.customer_metrics
tags: [analytics, customer, metrics]
timestamp: 2026-05-22T10:00:00Z
---

# Schema

| column      | type   | description                  |
| ----------- | ------ | ---------------------------- |
| customer_id | STRING | Unique customer identifier.  |
| active_days | INT64  | Active days in the period.   |

# Examples

Part of the [Analytics Dataset](/datasets/analytics.md).
