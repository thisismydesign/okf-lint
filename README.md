# okf-lint

An **opinionated linter for the [Open Knowledge Format (OKF)][okf]** — Google's
open, human- and agent-friendly format for knowledge catalogs.

Think of it as ESLint or RuboCop, but for OKF bundles. `okf-lint`:

- Reports **errors** when a bundle violates a **mandatory** OKF conformance
  requirement (e.g. a concept document is missing its `type` field).
- Reports **warnings** when a bundle skips an **optional-but-useful** convention
  that this linter has an opinion about (e.g. no `index.md`, no `log.md`, or a
  concept document without a `description`).

It is built to support **multiple OKF versions**. The format is young — `0.1` is
the only released version — so that is what ships today, but the version is
selected per-bundle and new versions can be added without breaking old ones.

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

OKF v0.1 models a **bundle**: a hierarchical directory of markdown files. Each
non-reserved `.md` file is a **concept document** (YAML frontmatter + markdown
body). Two filenames are **reserved**: `index.md` (a navigable listing) and
`log.md` (an update history).

`okf-lint` is **opinionated**: the spec says a bundle is conformant with very few
requirements, and that consumers should tolerate almost everything else. We
honor that split exactly — only true conformance failures are **errors**;
everything we merely _recommend_ is a **warning** you can turn off.

### Errors — mandatory OKF conformance

These map directly to the spec's conformance requirements. A bundle that
produces any of these is **not** a conformant OKF v0.1 bundle.

| Rule                    | What it enforces                                                                          |
| ----------------------- | ----------------------------------------------------------------------------------------- |
| `frontmatter-present`   | Every non-reserved `.md` file begins with a YAML frontmatter block.                       |
| `frontmatter-parseable` | That frontmatter block is parseable YAML (a mapping).                                     |
| `type-required`         | Every frontmatter block has a non-empty `type` field.                                     |
| `index-frontmatter`     | Only the bundle-root `index.md` may contain frontmatter; other `index.md` files must not. |
| `index-version-key`     | The bundle-root `index.md` frontmatter contains **only** `okf_version`.                   |
| `log-date-format`       | `log.md` entry headings use ISO 8601 `YYYY-MM-DD` dates.                                  |

### Warnings — optional but useful (the opinionated part)

The spec marks these as optional, and forbids consumers from _rejecting_ a
bundle over them. But they make a catalog dramatically more useful to humans and
agents, so `okf-lint` nudges you toward them. Disable any you disagree with.

| Rule                      | Why we recommend it                                                                        |
| ------------------------- | ------------------------------------------------------------------------------------------ |
| `recommended-title`       | A human-readable display name makes listings and search legible.                           |
| `recommended-description` | A one-line summary is what most consumers show first.                                      |
| `recommended-resource`    | A canonical URI ties the concept to the asset it actually describes.                       |
| `recommended-tags`        | Cross-cutting tags enable discovery beyond the directory hierarchy.                        |
| `recommended-timestamp`   | A last-modified time lets consumers reason about freshness.                                |
| `tags-type`               | When present, `tags` should be a list of strings (not a bare scalar).                      |
| `timestamp-format`        | When present, `timestamp` should be a valid ISO 8601 datetime.                             |
| `recommended-index`       | A bundle-root `index.md` gives readers a navigable, grouped entry point.                   |
| `recommended-log`         | A `log.md` records how the catalog evolved — invaluable for consumers tracking changes.    |
| `log-date-order`          | Log entries read best newest-first.                                                        |
| `valid-links`             | Internal `.md` cross-links should resolve. (The spec permits broken links; we flag them.)  |
| `okf-version-declared`    | Declaring `okf_version` lets tools pick the right rules. (See [Versioning](#versioning).)  |
| `okf-version-supported`   | Warns when the declared version is newer/unknown to this linter.                           |
| `okf-version-format`      | `okf_version` should be a quoted string so e.g. `"0.10"` isn't parsed as the number `0.1`. |

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
2. **Declared but unsupported** (e.g. a future `0.2`) → emit an
   `okf-version-supported` **warning** and validate against the most recent
   supported version anyway (best-effort, as the spec recommends).
3. **Not declared** → emit an `okf-version-declared` **warning** and validate
   against the most recent supported version.

The currently supported versions are listed by `okf-lint --help`. Today that is
just **`0.1`**.

## Configuration

Drop a `.okflintrc.json` in your bundle root (or the directory you run
`okf-lint` from) to tune rule severities. Each rule can be set to `"error"`,
`"warning"`, or `"off"`:

```json
{
  "rules": {
    "recommended-tags": "off",
    "valid-links": "error",
    "okf-version-declared": "off"
  }
}
```

This is how you make the linter _less_ or _more_ opinionated for your catalog —
turn off conventions you don't follow, or promote a warning to a hard error in
CI.

## Examples

The [`examples/`](./examples) directory contains two runnable bundles:

- [`examples/valid`](./examples/valid) — a clean bundle that lints with zero
  problems.
- [`examples/invalid`](./examples/invalid) — a bundle that intentionally
  triggers a representative spread of errors and warnings.

```bash
okf-lint examples/valid     # ✓ No problems found.
okf-lint examples/invalid   # ✖ 11 problems (4 errors, 7 warnings)
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
   array (start by importing and adapting the v0.1 set).
2. Register it in `src/versions/index.ts` (`RULE_SETS` and, when appropriate,
   `LATEST_VERSION`).
3. Add fixtures under `examples/` and assertions in `test/`.

Rules are small, self-contained objects (`meta` + `run(context)`), so most
changes touch only one file.

## License

[MIT](./LICENSE)

[okf]: https://github.com/GoogleCloudPlatform/knowledge-catalog
