# DAppNode package spec

This spec narrows what a DAppNode package repository may contain. Many repositories rely on behaviour that the SDK, DAPPMANAGER and tropibot only tolerate: legacy fields, alternative file names, values that are rewritten at install, and layouts that need guessing. Each tolerated variation costs code in every consumer, and some of it silently produces broken or incomplete releases.

The SDK checks every package against these rules during `build` and `publish`.

## Rollout

| Phase | SDK behaviour | Who acts |
|---|---|---|
| 1. Warn (this release) | Violations are printed after the run, with rule id, file and fix. In GitHub Actions they also appear as `::warning` annotations on the run and the pull request. Builds never fail because of the spec. | Package maintainers fix warnings in normal PRs. |
| 2. Opt-in strict | `DAPPNODE_SDK_SPEC=error` makes validation fail on any violation. Set it in `dappnode/workflows` for repositories that are already clean, or for new packages. | Workflow owners and tropibot. |
| 3. Strict by default | `error` becomes the default; `DAPPNODE_SDK_SPEC=warn` remains as a temporary escape hatch. | SDK release, announced in advance. |
| 4. Remove tolerances | The SDK and tropibot drop the code paths listed under each rule. | SDK and tropibot maintainers. |

`DAPPNODE_SDK_SPEC=off` disables the checks. Rule ids are stable: a rule keeps its meaning when it moves from warning to error.

## Rules

Repository counts and migration observations belong to dated audit reports; see the [November 2026 baseline](package-spec-audit-2026-11.md). They are not part of the package contract.

### Manifest

**SPEC-M01: One manifest named `dappnode_package.json`.** Each package directory (root and every variant) contains exactly one manifest, in JSON, named `dappnode_package.json`. `sdk-publish`, the ISO installer and tropibot read that exact name, and when several files match `dappnode_package*` the SDK picks one arbitrarily.

**SPEC-M02: Package name format.** `name` matches `^[a-z0-9]+(-[a-z0-9]+)*\.(dnp|public)\.dappnode\.eth$`.

**SPEC-M03: Upstream declared with `upstream[]`.** Upstream software is declared as `"upstream": [{ "repo", "version", "arg" }]`. The legacy `upstreamRepo`, `upstreamVersion` and `upstreamArg` fields are deprecated.

**SPEC-M04: The upstream `arg` is a compose build arg.** Every upstream entry names an `arg` that some compose service declares in `build.args`. Packages using the legacy fields often rely on the implicit default `UPSTREAM_VERSION`.

**SPEC-M05: The upstream `version` equals every matching build arg value.** Every compose service declaring the upstream `arg` must use the same string as `upstream[].version`. Matching one service does not excuse a conflicting value in another. A value `<version>@sha256:<digest>` also matches when the digest contains exactly 64 lowercase hexadecimal characters. Findings identify the conflicting service and the compose fragment that supplies its value.

**SPEC-M06: A variant `upstream[]` keeps the root's positions.** Root and variant manifests are merged by array position. A variant may list fewer or more entries than the root, but an entry at an existing position must refer to the same `repo`.

**SPEC-M07: Only fields from the manifest schema.** Fields outside the published manifest schema (plus `upnpDisable`, supported by DAPPMANAGER but not yet published) are ignored or stripped at install.

**SPEC-M08: `repository.url` points to the package repository.** When a manifest declares `repository`, its URL is the package's own GitHub repository (`https://` or `git+https://`, with or without `.git`).

**SPEC-M09: Exposable services exist in the compose.** `exposable[].serviceName` names a service in the compose.

**SPEC-M10: Manifest service references exist in the resolved compose.** Explicit `mainService`, `chain.serviceName`, `backup[].service` and `globalEnvs[].services[]` references name services present after root and variant files are merged. Omitted optional references retain their runtime defaults; the spec does not choose a service implicitly. Findings identify the manifest field, its defining source fragment and the affected variant.

**SPEC-M11: Global environment names match the runtime catalogue.** Entries in `globalEnvs[].envs` use short names from the `GLOBAL_ENVS` catalogue bundled with `@dappnode/types`, for example `PUBLIC_IP`, `HOSTNAME` or `ENVS_ACTIVE`. DAPPMANAGER adds `_DAPPNODE_GLOBAL_` at install, so `_DAPPNODE_GLOBAL_PUBLIC_IP` in the manifest would be prefixed twice. Catalogue keys are not aliases: the key `ACTIVE` maps to `ENVS_ACTIVE`, which is the valid manifest value. Catalogue updates must be released through shared types and consumed by the SDK before packages adopt newly supported names.

**SPEC-M12: Upstream bump metadata is valid.** Each `upstream[]` entry may set `provider` to `docker` (the default), `github`, or `docker_tags`, case-insensitively. `docker-tags` and `dockerhub` are aliases for `docker_tags`; legacy manifests use `upstreamProvider`. An optional `tagPattern` filters upstream tags and extracts capture group 1, or the whole match when no capture is present. Patterns must compile with JavaScript `RegExp` and use the common JavaScript/Rust regex subset: no lookaround or backreferences. Unknown providers and invalid patterns are reported as warnings.

### Manifest semantics

The source manifest describes package metadata and installation instructions. A template root and its variant manifests are source fragments; the merged result is the installable manifest and is validated against the full shared schema. Root fragments need not repeat each variant’s required identity fields.

- `version` is the package’s registry version in numeric `major.minor.patch` form. It is independent of `upstream[].version`, whose string may include a leading `v` or an upstream-specific prefix. The registry ABI stores package-version components as unsigned 16-bit integers. Full canonical/range checking and the initial-publication rule are tracked in the later-phase work below; static builds should not require a chain connection.
- `upstream[].version` is the version string expected by its compose build argument, before an optional digest suffix. The spec never strips prefixes automatically. Mapping a source release tag to a different build value requires a separately defined upstream-provider contract. The SDK bumper currently requires unique upstream repositories and argument names; a shared duplicate-entry policy is still needed.
- Explicit global-env lists use `{ "envs": ["PUBLIC_IP"], "services": ["app"] }` entries. The runtime also supports legacy `{ "all": true }` to inject its global env file into every service; `{ "all": false }` is a no-op. Empty lists are allowed. Schema corrections for this legacy form and required `envs`/`services` fields must be published before all consumers agree.
- Minimum runtime versions belong under `requirements.minimumDappnodeVersion` and `requirements.minimumDockerVersion`, not at the manifest top level.
- SPEC-M07 currently checks top-level field names. Nested-field typo checks remain later-phase work, including the treatment of deliberately open maps such as `links`.

### Variant inheritance

The current manifest merge recursively combines objects, replaces scalar values and merges arrays by index. A variant entry at index 0 overrides the root entry at index 0; it does not replace the whole array. Omitted object fields and trailing array entries are inherited. An empty array does not clear an inherited array, and omitting a field does not delete it. Schema-invalid values such as `null` are not a deletion mechanism.

For example, if the root upstream list is `[app, scripts]` and a variant supplies only a compatible `[appOverride]`, the resolved list is `[mergedApp, scripts]`. SPEC-M06 requires the root and variant to retain the same repository at every overlapping position. Checks of argument values and service references run on this resolved result. A move to whole-array replacement or merging by a stable key requires a coordinated migration across the SDK and consumers.

### Templates (multi-variant packages)

**SPEC-T01: The template root manifest has no `name` or `version`.** When a package has variants, each variant manifest declares its own `name` and `version` and the root holds only shared fields. A named root becomes a phantom package for pin cleanup, dashboards and on-chain sync.

**SPEC-T02: Variants live in `package_variants/`.** A custom `--variants_dir_name` is reported. Workflows, tropibot and the staking tests only read `package_variants/`.

**SPEC-T03: Variant directory names.** Variant names match `^[a-z0-9]+(-[a-z0-9]+)*$`; they appear in git tags (`<variant>@v<version>`) and ENS names.

**SPEC-T04: A single release file is in the root or the variant, not both.** For avatar, Prometheus targets, disclaimer, getting-started and the legacy setup files, the variant copy replaces the root copy, so a root copy next to variant copies is dead and goes stale. Setup wizards and notifications are merged by design, and Grafana dashboards are collected from both, so they are exempt.

**SPEC-T05: Every variant directory has a manifest.**

### Compose

**SPEC-C01: The compose file is `docker-compose.yml`.** A custom `--compose_file_name` is reported. DAPPMANAGER only recognises `compose*.yml` in a release, so `docker-compose.yaml` or `production.yml` produce a release that cannot be installed.

**SPEC-C02: No `container_name`.** DAPPMANAGER replaces it at install, so it has no effect. Core packages (`type: dncore`) are exempt: the installer starts them directly and addresses them by name.

**SPEC-C03: External images are pinned.** A service without `build` uses an image with an explicit, non-`latest` tag or a digest.

**SPEC-C04: No `${VAR}` interpolation.** Compose values are written out; interpolation depends on the environment of whoever runs compose.

**SPEC-C05: `build.args` is a mapping.** `args: { KEY: value }`, not a list of `KEY=value` strings, so every tool that edits upstream versions needs one parser.

### Release files

**SPEC-F01: Release files use the recognised names.** A file that looks like a release file but does not match its pattern is silently left out of the release.

| Type | Recognised names |
|---|---|
| Manifest | `dappnode_package.json` |
| Compose | `docker-compose.yml` |
| Avatar | `avatar*.png` |
| Setup wizard | `setup-wizard.json`, `setup-wizard.yml`, `setup-wizard.yaml` |
| Notifications | `notifications.yaml` |
| Prometheus targets | `prometheus-targets.json` (one file) |
| Grafana dashboards | `*grafana-dashboard.json` (any number) |
| Disclaimer | `disclaimer.md` |
| Getting started | `getting-started.md` |

**SPEC-F02: Release files stay within the size limits** from `@dappnode/types` `releaseFiles` (avatar 100 KB, compose 10 KB, setup wizard 100 KB, notifications 10 KB, Prometheus targets 10 KB, dashboards 10 MB).

**SPEC-F03: Values already have the schema type.** Validation coerces values in place (for example `isBanner: "false"` becomes `false`), and the release ships the coerced value.

### Build inputs

**SPEC-B01: Compose validation is not skipped.** DAPPMANAGER validates the compose again at install, so `--skip_compose_validation` only defers the failure to users.

**SPEC-B02: No `UPSTREAM_VERSION` environment override.** The upstream version comes from the package files, never from the build environment.

## Proposed for a later phase

These are not checked yet, either because they need consumer changes first or because they are too noisy today.

- **Package-version validation:** canonical numeric versions without leading zeros, registry component limits, and early first-publication checks before upload/transaction generation (#212). Keep chain-dependent publish checks separate from offline manifest checks.
- **Nested manifest fields:** report unknown keys with full paths, while preserving intentional open maps. Use shared schema metadata and distinguish source fragments from resolved releases.
- **Upstream identity and inheritance:** define duplicate-entry behavior, a stable identity for overrides, and any migration away from positional array merging before changing either consumer.
- **Compose `version:`** is obsolete. Rather than warn, the SDK should strip it from releases by default once versionless composes are verified with DAPPMANAGER (`--strip_compose_version` exists today as an opt-in).
- **Dockerfiles:** no `FROM …:latest` or untagged base images, and no remote `ADD` without `--checksum`. The staking `ADD ${STAKER_SCRIPTS_URL}/*.sh` pattern needs a shared replacement first.
- **Declarative upstream metadata:** `upstream[].provider` and `tagPattern` are now checked by SPEC-M12. Publishing the shared schema/types support and defining an optional image override would allow more package-specific bump configuration to move into manifests.
- **ENS names of new variants:** `<base>-<variant>.<dnp|public>.dappnode.eth` for new variants, with an allowlist of existing on-chain names (`hoodi-geth`, `nethermind-xdai`, …).
- **Explicit `architectures`**, replacing reliance on the implicit `linux/amd64`.
- **Setup wizard targets:** every wizard target refers to a service and environment variable that exist in the compose (service/environment existence should be checked after merging).
- **One next-version rule** shared by the SDK (APM) and tropibot (DApp Explorer +1 patch).

## Consumer contradictions found

These came up while defining the rules and should be fixed regardless of the rollout.

- A custom `--compose_file_name` yields a release DAPPMANAGER cannot install (SPEC-C01).
- A YAML manifest is released as `dappnode_package.yml`, which `sdk-publish` and the ISO installer cannot read (SPEC-M01).
- The SDK reads notifications with any extension, DAPPMANAGER only `.yaml` (SPEC-F01).
- The published global-env schema rejects the runtime’s legacy `{ all: true }` form and nests `services` under the `envs` schema instead of beside it. The shared-schema correction preserves the runtime form and requires both fields for explicit lists. Publish it together with the matching types.
- Published numeric-version patterns contain unescaped dots. The shared-schema correction uses literal separators for package and minimum-runtime versions. Canonical/range validation remains later-phase work; SPEC-M02 continues checking names in the SDK.

## tropibot

tropibot and the SDK share most package handling. Once a rule is an error, tropibot can drop the matching tolerance:

| Rule | TropiBot tolerance that becomes removable |
|---|---|
| SPEC-M01, SPEC-C01 | Hard-coded name assumptions in discovery, pin cleanup, on-chain sync and dashboard artifacts become guarantees. |
| SPEC-M03 | Legacy upstream-field discovery and editing; dashboards keep the fields only for history. |
| SPEC-M04, SPEC-C05 | Upstream arg detection heuristics, the `UPSTREAM_VERSION` default, list-style arg parsing and string `build:` handling. |
| SPEC-M05 | Some version/build-arg reconciliation; external tag formats (`n8n@x`, `v` prefixes) remain. |
| SPEC-M06 | The workaround for variants that re-declare `upstream`. |
| SPEC-T01 | Phantom root packages in dashboard manifest merging and root-only pin cleanup. |
| SPEC-T02 | The `variants/` vs `package_variants/` dual layout. |
| SPEC-M02, SPEC-T03 | Divergent name and variant regexes across modules collapse into one. |

Issues in tropibot independent of the spec:

- Pin cleanup on branch close or delete uses only the root manifest `name`, so it errors for templates whose root has no name and misses variant packages. The SDK now cleans root and variant names (`cleanPinsFromDeletedBranches`); tropibot should do the same or leave cleanup to the SDK.
- Pinata `pinList` is not paginated (default page size 10), so cleanup sees only the first page.
- tropibot unpins when a PR closes even if its branch still exists; the SDK only cleans deleted branches.
- Older package-creation guidance recommends a `variants/<v>/` layout with per-variant Dockerfiles, which contradicts SPEC-T02.
- The SDK’s `github-action bump-upstream` is deprecated and will be removed in a future release. DAppNode org packages should call `dappnode/workflows/.github/workflows/bump-upstream.yml@master`. Other packages should use `dappnode/workflows/actions/bump-upstream@master` for file edits, followed by their own PR step. See the migration example in [README.md](../README.md#bump-upstream-action-deprecated).

Contract between the SDK and tropibot that the spec work must keep:

- The build comment markers `<!-- dappnode-build-comment:v1 -->` and `<!-- dappnode-build-result:v1 {...} -->`. tropibot parses the JSON with `deny_unknown_fields`, so spec findings must not be added to it; they are reported through logs and annotations instead.
- Git tags `v<version>` and `<variant>@v<version>` joined by `_`; release assets `<short>_content-hash` and `<short>_dappnode_package.json`.
- Pin metadata keys `dnpName`, `version`, `upstreamVersion`, `commit` and `branch`.
- `package_variants/<variant>/releases.json`, read by the staking workflows with `jq 'to_entries | last'`, so its key order matters.

## Checking a package locally

`dappnodesdk build --skip_save` runs the checks without saving images. To see what strict mode would do:

```sh
DAPPNODE_SDK_SPEC=error dappnodesdk build --skip_save
```
