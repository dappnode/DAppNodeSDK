# Package-spec audit — November 2026 baseline

This is the historical baseline used when the package spec was introduced. It predates subsequent package migrations and is not a pending-work list or a current scan. The normative rules are in [package-spec.md](package-spec.md). New scans should record their date, repository revisions and scan scope separately.

Counts are from all 113 non-archived `DAppNodePackage*` and `DNP_*` repositories in November 2026; "active" means a push in the last 12 months (87 repositories). 58 active repositories currently have at least one finding, mostly SPEC-M03; 37 repositories are already clean.

| Rule | Baseline observation |
|---|---|
| SPEC-M01 | 0 active repositories. |
| SPEC-M02 | 2 inactive (Zosma-Nethermind, Zosma-OE). |
| SPEC-M03 | 44 active repositories still use them, including DNP_BIND, DNP_IPFS, Hopr, NEAR, Hermes-agent and Honcho. This is the largest migration and removes a second code path from the SDK bumper, tropibot's discovery and edit code, and the dashboards. |
| SPEC-M04 | 9 active (SafeStake-testnet, SplitPro, avalanche, graph, monero, rocketpool, rocketpool-testnet, supabase, web3signer-kiln). |
| SPEC-M05 | 4 active (GnosisVPNExitNode, Hopr-testnet, Tornado-Cash-Relayer, aztec-testnet). |
| SPEC-M06 | 0 repositories. |
| SPEC-M07 | 1 active (owncloud: `minimumDappnodeVersion`), 5 inactive with legacy `avatar`/`image`. |
| SPEC-M08 | 8 active point elsewhere: renamed repositories (DMS, anchor-generic), sibling packages (Erigon-Sepolia-Archival, lukso-erigon, NEAR-testnet), a fork (avalanche) and upstream projects (SplitPro, supabase). |
| SPEC-M09 | 2 active (op-erigon, op-geth). |
| SPEC-T01 | 5 active (juno-generic, jupyter-generic, nethermind-generic, ollama-generic, pathfinder-generic) and madara-generic. |
| SPEC-T02 | 0 repositories. |
| SPEC-T03 | 0 repositories. |
| SPEC-T04 | 1 active (erigon-generic: a stale root `prometheus-targets.json`). |
| SPEC-T05 | 0 repositories. |
| SPEC-C01 | 0 repositories use the flag. |
| SPEC-C02 | 6 active (Hermes-agent, Nextcloud, graph, jupyter-generic, ollama-generic, openclaw). |
| SPEC-C03 | 2 active (graph: `postgres`; owncloud: `webhippie/mariadb:latest`, `webhippie/redis:latest`). |
| SPEC-C04 | 2 active (alephium, supabase) and madara-generic. |
| SPEC-C05 | 3 active (DNP_NOTIFICATIONS, pi-hole, portainer). |
| SPEC-F01 | 5 active: NEAR `setup-wizard-ui.yml`, Tornado-Cash-Relayer `avatar-default.jpg`, package-harness `avatar-harness.svg`, pathfinder-generic `getting-started.yml` (must be `.md`) and reth-gnosis `notifications.yml` (must be `.yaml`). |
| SPEC-F02 | 2 active (Lido-CSM-generic avatar 123 KB, lukso-erigon avatar 245 KB). |
| SPEC-F03 | 1 active (DMS notifications). |
| SPEC-B01 | no workflow uses it. |

Other observations from the same review: 109 repositories declared Compose version, 25 omitted architectures, 6 inactive repositories used unpinned Dockerfile bases, and 20 active repositories used remote ADD without a checksum (19 through the staking-scripts pattern). Tropibot workflows covered 46 repositories and the SDK bumper covered 5.
