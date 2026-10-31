# okf-lint

A linter for the [Open Knowledge Format (OKF)][okf] — Google's open, human- and
agent-friendly format for knowledge catalogs.

Think of it as ESLint or RuboCop, but for OKF bundles. `okf-lint`:

- Reports **errors** when a bundle violates a **mandatory** OKF conformance
  requirement (e.g. a concept document is missing its `type` field).
- Reports **warnings** when a bundle skips an **optional-but-useful** convention
  (e.g. no `index.md`, no `log.md`, or a concept document without a
  `description`).

The OKF version is selected per bundle. Supported versions: **`0.1`** and
**`0.2`** (latest). If a bundle does not specify a version, or specifies one the
linter does not support, the highest supported version is used.

> Specification: <https://github.com/GoogleCloudPlatform/knowledge-catalog/blob/main/okf/SPEC.md>

---

## Installation

```bash
# one-off, no install
pnpm dlx @thisismydesign/okf-lint ./my-bundle

# or add it to a project
pnpm add -D @thisismydesign/okf-lint
```

> This package is published as [`@thisismydesign/okf-lint`](https://www.npmjs.com/package/@thisismydesign/okf-lint).
> It targets Node.js ≥ 18 and ships as ESM.

## Usage (CLI)

Point it at a bundle directory (the folder that contains your OKF markdown files):

```bash
okf-lint ./path/to/bundle
```

```
./path/to/bundle/tables/customer-metrics.md
  7:1      warning  Missing recommended `description` field (a one-line summary).  recommended-description

✖ 1 problem (0 errors, 1 warning)
```

### Options

| Option               | Description                                            |
| -------------------- | ------------------------------------------------------ |
| `path`               | Path to the OKF bundle directory (default: `.`).       |
| `-f, --format <fmt>` | Output format: `stylish` (default) or `json`.          |
| `-q, --quiet`        | Report errors only (suppress warnings).                |
| `--max-warnings <n>` | Exit non-zero if the number of warnings exceeds `<n>`. |
| `--list-rules`       | Print every rule for the latest version and exit.      |
| `-v, --version`      | Print the `okf-lint` version and exit.                 |
| `-h, --help`         | Show help and exit.                                    |

### Exit codes

| Code | Meaning                                                   |
| ---- | --------------------------------------------------------- |
| `0`  | No errors (and warnings within `--max-warnings`, if set). |
| `1`  | Errors found, or warnings exceeded `--max-warnings`.      |
| `2`  | Usage or runtime error (bad option, unreadable path, …).  |

This makes it CI-friendly:

```bash
# fail the build on any error, but tolerate warnings
okf-lint ./bundle

# treat the bundle as a strict, zero-warning catalog
okf-lint ./bundle --max-warnings 0
```

## Usage (programmatic)

```ts
import { lint, formatStylish } from '@thisismydesign/okf-lint';

const result = lint('./path/to/bundle');

console.log(result.errorCount, result.warningCount);
for (const d of result.diagnostics) {
  console.log(`${d.severity} ${d.ruleId} ${d.filePath}:${d.line} — ${d.message}`);
}

// or render the same human-readable report the CLI prints
console.log(formatStylish(result));
```

`lint(target, options)` returns:

```ts
interface LintResult {
  diagnostics: Diagnostic[]; // sorted by file, then line/column
  errorCount: number;
  warningCount: number;
  version: ResolvedVersion; // which OKF version was used, and why
}
```

You can pass inline configuration to override rule severities:

```ts
lint('./bundle', { config: { rules: { 'recommended-log': 'off' } } });
```

---

## What it checks

OKF models a **bundle**: a hierarchical directory of markdown files. Each
non-reserved `.md` file is a **concept document** (YAML frontmatter + markdown
body). Two filenames are **reserved**: `index.md` (a navigable listing) and
`log.md` (an update history).

`okf-lint` is **opinionated**: the spec says a bundle is conformant with very few
requirements, and that consumers should tolerate almost everything else. We
honor that split exactly — only true conformance failures are **errors**;
everything we merely _recommend_ is a **warning** you can turn off.

### Errors — mandatory OKF conformance

These map directly to the spec's conformance requirements. A bundle that
produces any of these is **not** a conformant OKF bundle. The **OKF** column
says which spec versions a rule applies to.

| Rule                    | OKF  | What it enforces                                                                          |
| ----------------------- | ---- | ----------------------------------------------------------------------------------------- |
| `frontmatter-present`   | 0.1+ | Every non-reserved `.md` file begins with a YAML frontmatter block.                       |
| `frontmatter-parseable` | 0.1+ | That frontmatter block is parseable YAML (a mapping).                                     |
| `type-required`         | 0.1+ | Every frontmatter block has a non-empty `type` field.                                     |
| `index-frontmatter`     | 0.1+ | Only the bundle-root `index.md` may contain frontmatter; other `index.md` files must not. |
| `index-version-key`     | 0.1+ | The bundle-root `index.md` frontmatter contains **only** `okf_version`.                   |
| `log-date-format`       | 0.1+ | `log.md` entry headings use ISO 8601 `YYYY-MM-DD` dates.                                  |

### Warnings — optional but useful (the opinionated part)

The spec marks these as optional, and forbids consumers from _rejecting_ a
bundle over them. But they make a catalog dramatically more useful to humans and
agents, so `okf-lint` nudges you toward them. Disable any you disagree with.

| Rule                      | OKF      | Why we recommend it                                                                                 |
| ------------------------- | -------- | --------------------------------------------------------------------------------------------------- |
| `recommended-title`       | 0.1+     | A human-readable display name makes listings and search legible.                                    |
| `recommended-description` | 0.1+     | A one-line summary is what most consumers show first.                                               |
| `recommended-timestamp`   | 0.1 only | A last-modified time lets consumers reason about freshness. (0.2: `recommended-generated`.)         |
| `tags-type`               | 0.1+     | When present, `tags` should be a list of strings (not a bare scalar).                               |
| `timestamp-format`        | 0.1+     | When present, `timestamp` should be a valid ISO 8601 datetime.                                      |
| `recommended-index`       | 0.1+     | A bundle-root `index.md` gives readers a navigable, grouped entry point.                            |
| `recommended-log`         | 0.1+     | A `log.md` records how the catalog evolved — invaluable for consumers tracking changes.             |
| `log-date-order`          | 0.1+     | Log entries read best newest-first.                                                                 |
| `valid-links`             | 0.1+     | Internal `.md` cross-links should resolve. (The spec permits broken links; we flag them.)           |
| `prefer-absolute-links`   | 0.1+     | Bundle-absolute links (`/path/to/doc.md`) are more robust than relative ones.                       |
| `okf-version-declared`    | 0.1+     | Declaring `okf_version` lets tools pick the right rules. (See [Versioning](#versioning).)           |
| `okf-version-supported`   | 0.1+     | Warns when the declared version is newer/unknown to this linter.                                    |
| `okf-version-format`      | 0.1+     | `okf_version` should be a quoted string so e.g. `"0.10"` isn't parsed as the number `0.1`.          |
| `sources-type`            | 0.2+     | `sources` should be a list of mappings, with string `id`/`title`.                                   |
| `sources-resource`        | 0.2+     | Every `sources` entry should have a `resource`.                                                     |
| `sources-id-unique`       | 0.2+     | `sources[].id` values should be unique, since footnotes join on them.                               |
| `sources-signals`         | 0.2+     | `author` a string, `usage_count` a non-negative integer, `last_modified` a datetime.                |
| `usage-window-shape`      | 0.2+     | `usage_window` should be `{ from, to }` with `from` not later than `to`.                            |
| `usage-count-window`      | 0.2+     | A `usage_count` without any `usage_window` cannot be interpreted.                                   |
| `footnote-source-id`      | 0.2+     | Every `[^label]` footnote should match a `sources[].id`.                                            |
| `recommended-generated`   | 0.2+     | `generated: { by, at }` records how and when the content was produced.                              |
| `generated-shape`         | 0.2+     | `generated` should be a mapping with a `by` and an ISO 8601 `at`.                                   |
| `verified-shape`          | 0.2+     | `verified` should be a `{ by, at }` mapping or a list of them.                                      |
| `actor-format`            | 0.2+     | `generated.by` / `verified[].by` should be `<producer>/<version>`, `human:<id>`, or `process:<id>`. |
| `status-value`            | 0.2+     | `status` should be `draft`, `stable`, or `deprecated`.                                              |
| `stale-after-format`      | 0.2+     | `stale_after` should be an ISO 8601 datetime with an explicit UTC offset.                           |
| `stale-after-passed`      | 0.2+     | A `stale_after` in the past means the concept is stale (deprecated concepts exempt).                |
| `computation-runtime`     | 0.2+     | `Attested Computation` concepts must declare a `runtime`.                                           |
| `computation-parameters`  | 0.2+     | `parameters` should be a list of `{ name, type, required }` with unique names.                      |
| `computation-body`        | 0.2+     | Exactly one of a `# Computation` code block or a `computation` path.                                |
| `computation-executor`    | 0.2+     | `executor` should be a mapping with a `resource` and an optional `receipt` list.                    |
| `computation-attester`    | 0.2+     | `attester` should be a mapping with a `resource`.                                                   |
| `computation-paths`       | 0.2+     | `computation`, `executor.resource`, and `attester.resource` paths should resolve in the bundle.     |
| `legacy-timestamp`        | 0.2+     | `timestamp` is superseded by `generated.at`.                                                        |
| `legacy-citations`        | 0.2+     | A `# Citations` body section is superseded by `sources`.                                            |

`resource` and `tags` are intentionally **not** required or recommended: many
concepts have no underlying asset, and tags don't always make sense. When you do
provide `tags`, `tags-type` checks that it's well-formed.

Run `okf-lint --list-rules` to print the full, current list.

---

## Versioning

OKF uses `<major>.<minor>` versions. A bundle **may** declare the version it
targets via `okf_version` in its **bundle-root `index.md`** frontmatter:

```markdown
---
okf_version: '0.1'
---

# Tables

- [Customer Metrics](/tables/customer-metrics.md) - Aggregated daily KPIs.
```

`okf-lint` resolves which rule set to use as follows:

1. **Declared and supported** → validate against that version.
2. **Declared but unsupported** (e.g. a future `0.3`) → emit an
   `okf-version-supported` **warning** and validate against the most recent
   supported version anyway (best-effort, as the spec recommends).
3. **Not declared** → emit an `okf-version-declared` **warning** and validate
   against the most recent supported version.

The currently supported versions are listed by `okf-lint --help`. Today they are
**`0.1`** and **`0.2`**.

## Configuration

Drop a `.okflintrc.json` in your bundle root (or the directory you run
`okf-lint` from) to tune rule severities. Each rule can be set to `"error"`,
`"warning"`, or `"off"`:

```json
{
  "rules": {
    "recommended-timestamp": "off",
    "valid-links": "error",
    "okf-version-declared": "off"
  }
}
```

This is how you make the linter _less_ or _more_ opinionated for your catalog —
turn off conventions you don't follow, or promote a warning to a hard error in
CI.

## Examples

The [`examples/`](./examples) directory contains two runnable bundles per OKF
version:

- `examples/v<version>/valid` — a clean bundle that lints with zero problems.
- `examples/v<version>/invalid` — a bundle that intentionally triggers a
  representative spread of errors and warnings.

```bash
okf-lint examples/v0.2/valid     # ✓ No problems found.
okf-lint examples/v0.2/invalid   # ✖ 27 problems (1 error, 26 warnings)
```

## Development

This repo uses **pnpm**, **TypeScript**, **ESLint**, and **Prettier**.

```bash
pnpm install        # install dependencies
pnpm build          # compile TypeScript to dist/
pnpm test           # run the vitest suite
pnpm typecheck      # type-check without emitting
pnpm lint           # eslint
pnpm format         # prettier --write
```

### Adding a new OKF version

1. Create `src/versions/v<major>_<minor>/rules.ts` exporting a `rules: Rule[]`
   array (compose the previous version's exported rules and add new ones).
2. Register it in `src/versions/index.ts` (`RULE_SETS` and, when appropriate,
   `LATEST_VERSION`).
3. Add fixtures under `examples/v<major>.<minor>/` and assertions in `test/`.

Rules are small, self-contained objects (`meta` + `run(context)`), so most
changes touch only one file.

## License

[MIT](./LICENSE)

[okf]: https://cloud.google.com/blog/products/data-analytics/how-the-open-knowledge-format-can-improve-data-sharing/
