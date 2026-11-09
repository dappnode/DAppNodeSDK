/**
 * DAppNode package spec rules (doc/package-spec.md).
 *
 * The SDK reports violations as warnings for now. Each rule has a stable id so
 * that workflows, tropibot and package maintainers can refer to it, and so the
 * same rule can later be turned into an error without changing its meaning.
 */
export const specRules = {
  // Manifest
  "SPEC-M01": {
    title: "One manifest named dappnode_package.json",
    why: "sdk-publish, the ISO installer and tropibot read dappnode_package.json by name; with several candidates the SDK picks one arbitrarily."
  },
  "SPEC-M02": {
    title: "Package name format",
    why: "Names must be <name>.dnp.dappnode.eth or <name>.public.dappnode.eth with lowercase letters, digits and single hyphens."
  },
  "SPEC-M03": {
    title: "Upstream declared with upstream[]",
    why: "The legacy upstreamRepo/upstreamVersion/upstreamArg fields need separate code paths in the SDK, tropibot and the dashboards."
  },
  "SPEC-M04": {
    title: "Upstream arg is a compose build arg",
    why: "Bumps edit the build arg named by `arg`; without it tools have to guess which arg holds the version."
  },
  "SPEC-M05": {
    title: "Upstream version equals the build arg value",
    why: "Manifest and compose must describe the same upstream version; tools otherwise have to translate between tag formats."
  },
  "SPEC-M06": {
    title: "Variant upstream[] matches the root order",
    why: "Root and variant manifests are merged by array position, so a reordered or shortened variant upstream[] mixes entries."
  },
  "SPEC-M07": {
    title: "Only known manifest fields",
    why: "Fields outside the manifest schema are ignored or stripped by DAPPMANAGER."
  },
  "SPEC-M08": {
    title: "repository.url points to the package repository",
    why: "GitHub releases and bots use the manifest repository; another repository's URL targets the wrong repo."
  },
  "SPEC-M09": {
    title: "Exposable services exist in compose",
    why: "An exposable entry for a service that is not in the compose cannot be exposed."
  },
  // Templates (multi-variant packages)
  "SPEC-T01": {
    title: "Template root manifest has no name or version",
    why: "With variants, every package identity comes from its variant; a named root becomes an extra phantom package for cleanup and dashboards."
  },
  "SPEC-T02": {
    title: "Variants live in package_variants/",
    why: "Workflows, tropibot and the shared staking tests only look in package_variants/."
  },
  "SPEC-T03": {
    title: "Variant directory names",
    why: "Variant names appear in git tags (<variant>@v<version>) and ENS names; use lowercase letters, digits and single hyphens."
  },
  "SPEC-T04": {
    title: "A single release file lives in the root or the variant, not both",
    why: "The variant copy silently replaces the root copy, so the root copy is dead and easily goes stale."
  },
  "SPEC-T05": {
    title: "Every variant directory has a manifest",
    why: "A variant without dappnode_package.json cannot be built or published."
  },
  // Compose
  "SPEC-C01": {
    title: "Compose file named docker-compose.yml",
    why: "DAPPMANAGER only recognises compose*.yml in a release, and the ISO installer and tropibot read docker-compose.yml."
  },
  "SPEC-C02": {
    title: "No container_name",
    why: "DAPPMANAGER replaces container_name at install, so the value has no effect."
  },
  "SPEC-C03": {
    title: "External images are pinned",
    why: "An untagged or :latest external image makes the release content depend on when it was built."
  },
  "SPEC-C04": {
    title: "No ${VAR} interpolation in compose",
    why: "Interpolation depends on the environment of whoever runs compose; releases must be self-contained."
  },
  "SPEC-C05": {
    title: "build.args is a mapping",
    why: "List-style args (- KEY=value) need separate parsing in every tool that edits upstream versions."
  },
  // Release files
  "SPEC-F01": {
    title: "Release files use the recognised names",
    why: "A file that looks like a release file but does not match its expected name is silently left out of the release."
  },
  "SPEC-F02": {
    title: "Release files stay within the size limits",
    why: "DAPPMANAGER rejects release files above the limits in @dappnode/types releaseFiles."
  },
  "SPEC-F03": {
    title: "Values have the schema types",
    why: 'Schema validation coerces values (e.g. isBanner: "false" becomes false); the source should already have the right type.'
  },
  // Build inputs
  "SPEC-B01": {
    title: "Compose validation is not skipped",
    why: "DAPPMANAGER validates the compose again at install, so a release built with --skip_compose_validation may not install."
  },
  "SPEC-B02": {
    title: "No UPSTREAM_VERSION environment override",
    why: "The upstream version must come from the package files, not from the environment of the build."
  }
} as const satisfies Record<string, { title: string; why: string }>;

export type SpecRuleId = keyof typeof specRules;

export interface SpecFinding {
  rule: SpecRuleId;
  message: string;
  /** Absolute path of the file the finding is about, if any. */
  file?: string;
}

export const specDocUrl =
  "https://github.com/dappnode/DAppNodeSDK/blob/master/doc/package-spec.md";
