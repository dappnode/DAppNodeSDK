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

Counts are from all 113 non-archived `DAppNodePackage*` and `DNP_*` repositories in November 2026; "active" means a push in the last 12 months (87 repositories). 58 active repositories currently have at least one finding, mostly SPEC-M03; 37 repositories are already clean.

### Manifest

**SPEC-M01: One manifest named `dappnode_package.json`.** Each package directory (root and every variant) contains exactly one manifest, in JSON, named `dappnode_package.json`. `sdk-publish`, the ISO installer and tropibot read that exact name, and when several files match `dappnode_package*` the SDK picks one arbitrarily. Today: 0 active repositories.

**SPEC-M02: Package name format.** `name` matches `^[a-z0-9]+(-[a-z0-9]+)*\.(dnp|public)\.dappnode\.eth$`. Today: 2 inactive (Zosma-Nethermind, Zosma-OE).

**SPEC-M03: Upstream declared with `upstream[]`.** Upstream software is declared as `"upstream": [{ "repo", "version", "arg" }]`. The legacy `upstreamRepo`, `upstreamVersion` and `upstreamArg` fields are deprecated. Today: 44 active repositories still use them, including DNP_BIND, DNP_IPFS, Hopr, NEAR, Hermes-agent and Honcho. This is the largest migration and removes a second code path from the SDK bumper, tropibot's discovery and edit code, and the dashboards.

**SPEC-M04: The upstream `arg` is a compose build arg.** Every upstream entry names an `arg` that some compose service declares in `build.args`. Packages using the legacy fields often rely on the implicit default `UPSTREAM_VERSION`. Today: 9 active (SafeStake-testnet, SplitPro, avalanche, graph, monero, rocketpool, rocketpool-testnet, supabase, web3signer-kiln).

**SPEC-M05: The upstream `version` equals the build arg value.** The manifest version and the compose build arg are the same string, so tools never translate between `v1.2.3` and `1.2.3`. A digest-pinned arg (`1.2.3@sha256:…`) counts as equal. Today: 4 active (GnosisVPNExitNode, Hopr-testnet, Tornado-Cash-Relayer, aztec-testnet).

**SPEC-M06: A variant `upstream[]` keeps the root's positions.** Root and variant manifests are merged by array position. A variant may list fewer or more entries than the root, but an entry at an existing position must refer to the same `repo`. Today: 0 repositories.

**SPEC-M07: Only fields from the manifest schema.** Fields outside the published manifest schema (plus `upnpDisable`, supported by DAPPMANAGER but not yet published) are ignored or stripped at install. Today: 1 active (owncloud: `minimumDappnodeVersion`), 5 inactive with legacy `avatar`/`image`.

**SPEC-M08: `repository.url` points to the package repository.** When a manifest declares `repository`, its URL is the package's own GitHub repository (`https://` or `git+https://`, with or without `.git`). Today: 8 active point elsewhere: renamed repositories (DMS, anchor-generic), sibling packages (Erigon-Sepolia-Archival, lukso-erigon, NEAR-testnet), a fork (avalanche) and upstream projects (SplitPro, supabase).

**SPEC-M09: Exposable services exist in the compose.** `exposable[].serviceName` names a service in the compose. Today: 2 active (op-erigon, op-geth).

### Templates (multi-variant packages)

**SPEC-T01: The template root manifest has no `name` or `version`.** When a package has variants, each variant manifest declares its own `name` and `version` and the root holds only shared fields. A named root becomes a phantom package for pin cleanup, dashboards and on-chain sync. Today: 5 active (juno-generic, jupyter-generic, nethermind-generic, ollama-generic, pathfinder-generic) and madara-generic.

**SPEC-T02: Variants live in `package_variants/`.** A custom `--variants_dir_name` is reported. Workflows, tropibot and the staking tests only read `package_variants/`. Today: 0 repositories.

**SPEC-T03: Variant directory names.** Variant names match `^[a-z0-9]+(-[a-z0-9]+)*$`; they appear in git tags (`<variant>@v<version>`) and ENS names. Today: 0 repositories.

**SPEC-T04: A single release file is in the root or the variant, not both.** For avatar, Prometheus targets, disclaimer, getting-started and the legacy setup files, the variant copy replaces the root copy, so a root copy next to variant copies is dead and goes stale. Setup wizards and notifications are merged by design, and Grafana dashboards are collected from both, so they are exempt. Today: 1 active (erigon-generic: a stale root `prometheus-targets.json`).

**SPEC-T05: Every variant directory has a manifest.** Today: 0 repositories.

### Compose

**SPEC-C01: The compose file is `docker-compose.yml`.** A custom `--compose_file_name` is reported. DAPPMANAGER only recognises `compose*.yml` in a release, so `docker-compose.yaml` or `production.yml` produce a release that cannot be installed. Today: 0 repositories use the flag.

**SPEC-C02: No `container_name`.** DAPPMANAGER replaces it at install, so it has no effect. Core packages (`type: dncore`) are exempt: the installer starts them directly and addresses them by name. Today: 6 active (Hermes-agent, Nextcloud, graph, jupyter-generic, ollama-generic, openclaw).

**SPEC-C03: External images are pinned.** A service without `build` uses an image with an explicit, non-`latest` tag or a digest. Today: 2 active (graph: `postgres`; owncloud: `webhippie/mariadb:latest`, `webhippie/redis:latest`).

**SPEC-C04: No `${VAR}` interpolation.** Compose values are written out; interpolation depends on the environment of whoever runs compose. Today: 2 active (alephium, supabase) and madara-generic.

**SPEC-C05: `build.args` is a mapping.** `args: { KEY: value }`, not a list of `KEY=value` strings, so every tool that edits upstream versions needs one parser. Today: 3 active (DNP_NOTIFICATIONS, pi-hole, portainer).

### Release files

**SPEC-F01: Release files use the recognised names.** A file that looks like a release file but does not match its pattern is silently left out of the release. Today: 5 active: NEAR `setup-wizard-ui.yml`, Tornado-Cash-Relayer `avatar-default.jpg`, package-harness `avatar-harness.svg`, pathfinder-generic `getting-started.yml` (must be `.md`) and reth-gnosis `notifications.yml` (must be `.yaml`).

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

**SPEC-F02: Release files stay within the size limits** from `@dappnode/types` `releaseFiles` (avatar 100 KB, compose 10 KB, setup wizard 100 KB, notifications 10 KB, Prometheus targets 10 KB, dashboards 10 MB). Today: 2 active (Lido-CSM-generic avatar 123 KB, lukso-erigon avatar 245 KB).

**SPEC-F03: Values already have the schema type.** Validation coerces values in place (for example `isBanner: "false"` becomes `false`), and the release ships the coerced value. Today: 1 active (DMS notifications).

### Build inputs

**SPEC-B01: Compose validation is not skipped.** DAPPMANAGER validates the compose again at install, so `--skip_compose_validation` only defers the failure to users. Today: no workflow uses it.

**SPEC-B02: No `UPSTREAM_VERSION` environment override.** The upstream version comes from the package files, never from the build environment.

## Proposed for a later phase

These are not checked yet, either because they need consumer changes first or because they are too noisy today.

- **Compose `version:`** is obsolete (109 repositories still set it). Rather than warn, the SDK should strip it from releases by default once versionless composes are verified with DAPPMANAGER (`--strip_compose_version` exists today as an opt-in).
- **Dockerfiles:** no `FROM …:latest` or untagged base images (6 inactive repositories), and no remote `ADD` without `--checksum` (20 active repositories; 19 are the staking `ADD ${STAKER_SCRIPTS_URL}/*.sh` pattern, which needs a shared replacement first).
- **Declarative upstream metadata:** optional `upstream[].provider`, `tagPattern` and `imageTag` fields would let tropibot drop its built-in provider table and tag-to-image-tag inference. This needs a manifest schema change.
- **ENS names of new variants:** `<base>-<variant>.<dnp|public>.dappnode.eth` for new variants, with an allowlist of existing on-chain names (`hoodi-geth`, `nethermind-xdai`, …).
- **Explicit `architectures`** (25 repositories rely on the implicit `linux/amd64`).
- **Setup wizard targets:** every wizard target refers to a service and environment variable that exist in the compose (7 repositories reference variables the compose does not declare).
- **One next-version rule** shared by the SDK (APM) and tropibot (DApp Explorer +1 patch).

## Consumer contradictions found

These came up while defining the rules and should be fixed regardless of the rollout.

- A custom `--compose_file_name` yields a release DAPPMANAGER cannot install (SPEC-C01).
- A YAML manifest is released as `dappnode_package.yml`, which `sdk-publish` and the ISO installer cannot read (SPEC-M01).
- The SDK reads notifications with any extension, DAPPMANAGER only `.yaml` (SPEC-F01).
- `globalEnvs: { all: true }` is documented and implemented in DAPPMANAGER but rejected by the schema; the docs should drop it.
- The manifest schema's `version` pattern has unescaped dots and `name` has no pattern; the SDK checks both itself (`validatePackageVersion`, SPEC-M02).
- The variants directory default is `variants` in the bump workflow and in tropibot's package creation guide, but `package_variants` everywhere else (SPEC-T02).

## tropibot

tropibot and the SDK share most package handling. Once a rule is an error, tropibot can drop the matching tolerance:

| Rule | tropibot code that becomes removable |
|---|---|
| SPEC-M01, SPEC-C01 | Hard-coded name assumptions in discovery, pin cleanup, on-chain sync and dashboard artifacts become guarantees. |
| SPEC-M03 | The legacy `upstreamRepo/Version/Arg` path in bump discovery and edits (`bump/package/discovery.rs`, `edits.rs`); dashboards keep it only for history. |
| SPEC-M04, SPEC-C05 | Upstream arg detection heuristics and the `UPSTREAM_VERSION` default (`discovery.rs`, `compose.rs`), list-style arg parsing and string `build:` handling. |
| SPEC-M05 | Part of the tag/arg format reconciliation in `resolve.rs` and `version_format.rs`; external tag formats (`n8n@x`, `v` prefixes) remain. |
| SPEC-M06 | The workaround for variants that re-declare `upstream` (`package.rs`). |
| SPEC-T01 | Phantom root packages in dashboard manifest merging (`source/manifests.rs`) and root-only pin cleanup. |
| SPEC-T02 | The `variants/` vs `package_variants/` dual layout (`bump/package/types.rs`, `discovery.rs`). |
| SPEC-M02, SPEC-T03 | Divergent name and variant regexes across modules collapse into one. |

Issues in tropibot independent of the spec:

- Pin cleanup on branch close or delete uses only the root manifest `name`, so it errors for the 22 templates whose root has no name and misses variant packages. The SDK now cleans root and variant names (`cleanPinsFromDeletedBranches`); tropibot should do the same or leave cleanup to the SDK.
- Pinata `pinList` is not paginated (default page size 10), so cleanup sees only the first page.
- tropibot unpins when a PR closes even if its branch still exists; the SDK only cleans deleted branches.
- `docs/PACKAGE_CREATION_GUIDE.md` recommends a `variants/<v>/` layout with per-variant Dockerfiles, which contradicts SPEC-T02 and every real template.
- Two upstream bumpers exist: tropibot (46 repositories via workflows) and the SDK's `github-action bump-upstream` (5 repositories). One should become canonical.

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
