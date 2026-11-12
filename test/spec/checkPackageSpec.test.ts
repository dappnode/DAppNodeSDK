import fs from "fs";
import path from "path";
import yaml from "js-yaml";
import Listr from "listr";
import { expect } from "chai";
import { initHandler } from "../../src/commands/init/handler.js";
import { getPackagesToBuildProps } from "../../src/commands/build/variants.js";
import { checkPackageSpec } from "../../src/spec/checkPackageSpec.js";
import {
  formatGithubAnnotations,
  formatSpecReport,
  getSpecMode
} from "../../src/spec/report.js";
import { SpecFinding, specRules } from "../../src/spec/rules.js";
import { getFileValidationTask } from "../../src/tasks/buildAndUpload/getFileValidationTask.js";
import { temporaryDirectory } from "../helpers/fixtures.js";

function check(
  dir: string,
  extra: Partial<Parameters<typeof checkPackageSpec>[0]> = {}
): SpecFinding[] {
  const variantsDirPath = path.join(dir, "package_variants");
  return checkPackageSpec({
    rootDir: dir,
    variantsDirPath,
    packagesToBuildProps: getPackagesToBuildProps({
      allVariants: fs.existsSync(variantsDirPath),
      rootDir: dir,
      variantsDirPath,
      composeFileName: "docker-compose.yml"
    }),
    env: {},
    ...extra
  });
}

const rulesOf = (findings: SpecFinding[]) =>
  [...new Set(findings.map(finding => finding.rule))].sort();

describe("package spec checks", function () {
  this.timeout(30000);
  let dir: string;
  const write = (rel: string, content: string | object) => {
    fs.mkdirSync(path.dirname(path.join(dir, rel)), { recursive: true });
    fs.writeFileSync(
      path.join(dir, rel),
      typeof content === "string" ? content : JSON.stringify(content, null, 2)
    );
  };
  beforeEach(() => (dir = temporaryDirectory()));
  afterEach(() => fs.rmSync(dir, { recursive: true, force: true }));

  it("finds nothing in packages created by init", async () => {
    for (const useVariants of [false, true]) {
      const pkgDir = path.join(dir, useVariants ? "template" : "single");
      fs.mkdirSync(pkgDir);
      await initHandler({
        dir: pkgDir,
        yes: true,
        force: true,
        use_variants: useVariants
      });
      expect(check(pkgDir), useVariants ? "template" : "single").to.deep.equal(
        []
      );
    }
  });

  it("reports each non-spec pattern with its rule and file", () => {
    // Template root that also names a package (juno-generic), legacy upstream fields
    // without an arg, and assorted compose and file-name issues.
    write("dappnode_package.json", {
      name: "demo.dnp.dappnode.eth",
      version: "0.1.0",
      upstreamRepo: "acme/demo",
      upstreamVersion: "v1.0.0",
      image: { path: "legacy" },
      repository: { type: "git", url: "https://github.com/acme/demo.git" }
    });
    write(
      "docker-compose.yml",
      yaml.dump({
        version: "3.5",
        services: {
          app: {
            build: { context: ".", args: ["UPSTREAM_VERSION=1.0.0"] },
            image: "app.demo.dnp.dappnode.eth:0.1.0",
            container_name: "DAppNodePackage-demo",
            environment: { PORT: "${PORT:-80}" }
          },
          db: { image: "postgres" }
        }
      })
    );
    write("avatar-default.png", "png");
    write("notifications.yml", "endpoints: []\n");
    write("prometheus-targets.json", "[]");
    write("package_variants/mainnet/dappnode_package.json", {
      name: "demo.dnp.dappnode.eth",
      version: "0.1.0"
    });
    write(
      "package_variants/mainnet/docker-compose.yml",
      yaml.dump({ version: "3.5", services: { app: {} } })
    );
    write("package_variants/mainnet/prometheus-targets.json", "[]");
    write("package_variants/Test_Net/dappnode_package.json", {
      name: "demo-test.dnp.dappnode.eth",
      version: "0.1.0"
    });
    write(
      "package_variants/Test_Net/docker-compose.yml",
      yaml.dump({ version: "3.5", services: { app: {} } })
    );

    const findings = check(dir, {
      repoSlug: "dappnode/DAppNodePackage-demo",
      skipComposeValidation: true,
      env: { UPSTREAM_VERSION: "1.0.0" }
    });
    expect(rulesOf(findings)).to.deep.equal([
      "SPEC-B01",
      "SPEC-B02",
      "SPEC-C02",
      "SPEC-C03",
      "SPEC-C04",
      "SPEC-C05",
      "SPEC-F01",
      "SPEC-M03",
      "SPEC-M04",
      "SPEC-M05",
      "SPEC-M07",
      "SPEC-M08",
      "SPEC-T01",
      "SPEC-T03",
      "SPEC-T04"
    ]);
    // A value inherited from the root is reported once, not once per variant.
    expect(
      findings.filter(finding => finding.rule === "SPEC-C02")
    ).to.have.length(1);
    expect(
      findings.find(finding => finding.rule === "SPEC-C02")?.file
    ).to.equal(path.join(dir, "docker-compose.yml"));
    // The legacy fields rely on the implicit arg UPSTREAM_VERSION, whose value differs from upstreamVersion.
    expect(
      findings.find(finding => finding.rule === "SPEC-M04")?.message
    ).to.include("implicit build arg UPSTREAM_VERSION");
    expect(
      findings.find(finding => finding.rule === "SPEC-M05")?.message
    ).to.include('version "v1.0.0"');
  });

  it("accepts escaped compose variables without reporting interpolation", () => {
    write("dappnode_package.json", {
      name: "demo.dnp.dappnode.eth",
      version: "0.1.0"
    });
    write(
      "docker-compose.yml",
      yaml.dump({
        services: {
          app: {
            image: "alpine:3.21",
            environment: {
              HEALTH_PORT: "$${PORT:-9090}",
              HEALTH_TOKEN: "$${ANON_KEY}",
              LITERAL: "$$$${LITERAL}"
            }
          }
        }
      })
    );
    expect(check(dir)).to.deep.equal([]);
  });

  it("reports real interpolation after escaped dollar pairs", () => {
    write("dappnode_package.json", {
      name: "demo.dnp.dappnode.eth",
      version: "0.1.0"
    });
    write(
      "docker-compose.yml",
      yaml.dump({
        services: {
          app: {
            image: "alpine:3.21",
            environment: {
              PORT: "${PORT:-80}",
              PREFIXED: "$$${TOKEN}",
              REPEATED: "${PORT:-80}",
              ESCAPED: "$${SAFE}"
            }
          }
        }
      })
    );
    const findings = check(dir).filter(finding => finding.rule === "SPEC-C04");
    expect(findings).to.have.length(1);
    expect(findings[0].message).to.equal(
      "Uses environment interpolation ${PORT:-80}, ${TOKEN}; write the values out."
    );
  });

  it("accepts digest-pinned args, shorter variant upstream lists and real avatars", () => {
    write("dappnode_package.json", {
      upstream: [
        { repo: "acme/app", version: "1.0.0", arg: "UPSTREAM_VERSION" },
        {
          repo: "dappnode/staker-package-scripts",
          version: "v0.1.2",
          arg: "STAKER_SCRIPTS_VERSION"
        }
      ]
    });
    write(
      "docker-compose.yml",
      yaml.dump({
        version: "3.5",
        services: {
          app: {
            build: {
              context: ".",
              args: {
                UPSTREAM_VERSION: `1.0.0@sha256:${"a".repeat(64)}`,
                STAKER_SCRIPTS_VERSION: "v0.1.2"
              }
            },
            image: "app.demo.dnp.dappnode.eth:0.1.0"
          }
        }
      })
    );
    write("avatar-notifications.png", "png");
    write("package_variants/mainnet/dappnode_package.json", {
      name: "demo.dnp.dappnode.eth",
      version: "0.1.0"
    });
    write(
      "package_variants/mainnet/docker-compose.yml",
      yaml.dump({ version: "3.5", services: { app: {} } })
    );
    write(
      "package_variants/lukso/docker-compose.yml",
      yaml.dump({ version: "3.5", services: { app: {} } })
    );
    write("package_variants/lukso/dappnode_package.json", {
      name: "demo-lukso.dnp.dappnode.eth",
      version: "0.1.0",
      upstream: [
        { repo: "acme/app", version: "1.0.0", arg: "UPSTREAM_VERSION" }
      ]
    });
    expect(check(dir)).to.deep.equal([]);
  });

  it("flags a variant that puts a different repo at a root upstream position", () => {
    write("dappnode_package.json", {
      upstream: [
        { repo: "acme/app", version: "1.0.0", arg: "UPSTREAM_VERSION" },
        { repo: "acme/tool", version: "2.0.0", arg: "TOOL_VERSION" }
      ]
    });
    write(
      "docker-compose.yml",
      yaml.dump({
        version: "3.5",
        services: {
          app: {
            build: {
              context: ".",
              args: { UPSTREAM_VERSION: "1.0.0", TOOL_VERSION: "2.0.0" }
            }
          }
        }
      })
    );
    write(
      "package_variants/main/docker-compose.yml",
      yaml.dump({ version: "3.5", services: { app: {} } })
    );
    write("package_variants/main/dappnode_package.json", {
      name: "demo.dnp.dappnode.eth",
      version: "0.1.0",
      upstream: [{ repo: "acme/tool", version: "2.0.0", arg: "TOOL_VERSION" }]
    });
    expect(rulesOf(check(dir))).to.deep.equal(["SPEC-M06"]);
  });

  it("checks every service using an upstream arg, including digest pins", () => {
    write("dappnode_package.json", {
      name: "demo.dnp.dappnode.eth",
      version: "0.1.0",
      upstream: [{ repo: "acme/app", version: "1.2.3", arg: "APP_VERSION" }]
    });
    for (const [value, valid] of [
      ["1.2.3", true],
      [`1.2.3@sha256:${"a".repeat(64)}`, true],
      ["1.2.2", false],
      ["1.2.3@sha256:abc", false],
      [`1.2.3@sha256:${"A".repeat(64)}`, false],
      [`1.2.3@sha256:${"g".repeat(64)}`, false],
      ["", false]
    ] as const) {
      write(
        "docker-compose.yml",
        yaml.dump({
          services: {
            app: { build: { context: ".", args: { APP_VERSION: "1.2.3" } } },
            worker: { build: { context: ".", args: { APP_VERSION: value } } }
          }
        })
      );
      const findings = check(dir).filter(f => f.rule === "SPEC-M05");
      expect(findings, value).to.have.length(valid ? 0 : 1);
      if (!valid) {
        expect(findings[0].message).to.include(
          "services.worker.build.args.APP_VERSION"
        );
        expect(findings[0].file).to.equal(path.join(dir, "docker-compose.yml"));
      }
    }
  });

  it("reports invalid upstream providers and patterns as SPEC-M12 warnings", () => {
    write("docker-compose.yml", {
      services: { app: { build: { args: { VERSION: "1.2.3" } } } }
    });
    for (const metadata of [
      { provider: "npm" },
      { tagPattern: "[" },
      { tagPattern: "(?=v)(.*)" },
      { tagPattern: "(v)\\1" }
    ]) {
      write("dappnode_package.json", {
        name: "demo.dnp.dappnode.eth",
        version: "0.1.0",
        upstream: [
          { repo: "acme/app", version: "1.2.3", arg: "VERSION", ...metadata }
        ]
      });
      const findings = check(dir).filter(f => f.rule === "SPEC-M12");
      expect(findings, JSON.stringify(metadata)).to.have.length(1);
      expect(findings[0].file).to.equal(
        path.join(dir, "dappnode_package.json")
      );
    }
    write("dappnode_package.json", {
      name: "demo.dnp.dappnode.eth",
      version: "0.1.0",
      upstream: [
        {
          repo: "acme/app",
          version: "1.2.3",
          arg: "VERSION",
          provider: "DockerHub",
          tagPattern: "^v(.*)$"
        }
      ]
    });
    expect(check(dir).filter(f => f.rule === "SPEC-M12")).to.deep.equal([]);
  });

  it("attributes conflicting upstream values to the variant compose", () => {
    write("dappnode_package.json", {
      upstream: [{ repo: "acme/app", version: "1.2.3", arg: "APP_VERSION" }]
    });
    write(
      "docker-compose.yml",
      yaml.dump({
        services: {
          app: { build: { context: ".", args: { APP_VERSION: "1.2.3" } } }
        }
      })
    );
    write("package_variants/main/dappnode_package.json", {
      name: "demo.dnp.dappnode.eth",
      version: "0.1.0"
    });
    write(
      "package_variants/main/docker-compose.yml",
      yaml.dump({
        services: {
          worker: { build: { context: ".", args: { APP_VERSION: "1.2.2" } } }
        }
      })
    );
    const findings = check(dir).filter(f => f.rule === "SPEC-M05");
    expect(findings).to.have.length(1);
    expect(findings[0].file).to.equal(
      path.join(dir, "package_variants/main/docker-compose.yml")
    );
    expect(findings[0].message).to.include('variant "main"');
  });

  it("validates all explicit manifest service references", () => {
    write("dappnode_package.json", {
      name: "demo.dnp.dappnode.eth",
      version: "0.1.0",
      mainService: "missing-main",
      chain: { driver: "ethereum", serviceName: "missing-chain" },
      backup: [{ name: "data", path: "/data", service: "missing-backup" }],
      globalEnvs: [{ envs: ["PUBLIC_IP"], services: ["app", "missing-global"] }]
    });
    write(
      "docker-compose.yml",
      yaml.dump({ services: { app: { image: "alpine:3.21" } } })
    );
    const findings = check(dir).filter(f => f.rule === "SPEC-M10");
    expect(findings).to.have.length(4);
    for (const field of [
      "mainService",
      "chain.serviceName",
      "backup[0].service",
      "globalEnvs[0].services[1]"
    ])
      expect(findings.some(f => f.message.startsWith(field))).to.equal(true);
    expect(
      findings.every(f => f.file === path.join(dir, "dappnode_package.json"))
    ).to.equal(true);
  });

  it("accepts valid references, implicit service defaults and runtime global-env names", () => {
    write("dappnode_package.json", {
      name: "demo.dnp.dappnode.eth",
      version: "0.1.0",
      mainService: "app",
      chain: { driver: "ethereum", serviceName: "app" },
      backup: [
        { name: "data", path: "/data" },
        { name: "config", path: "/config", service: "app" }
      ],
      globalEnvs: [
        {
          envs: ["PUBLIC_IP", "ENVS_ACTIVE", "EXECUTION_CLIENT_MAINNET"],
          services: ["app"]
        }
      ]
    });
    write(
      "docker-compose.yml",
      yaml.dump({ services: { app: { image: "alpine:3.21" } } })
    );
    expect(check(dir)).to.deep.equal([]);
    write("dappnode_package.json", {
      name: "demo.dnp.dappnode.eth",
      version: "0.1.0",
      chain: "ethereum",
      globalEnvs: { all: true }
    });
    expect(check(dir)).to.deep.equal([]);
  });

  it("rejects prefixed and unknown global-env names with actionable paths", () => {
    write("dappnode_package.json", {
      name: "demo.dnp.dappnode.eth",
      version: "0.1.0",
      globalEnvs: [
        {
          envs: ["_DAPPNODE_GLOBAL_PUBLIC_IP", "PUBLIC_IPP", "ACTIVE"],
          services: ["app"]
        }
      ]
    });
    write(
      "docker-compose.yml",
      yaml.dump({ services: { app: { image: "alpine:3.21" } } })
    );
    const findings = check(dir).filter(f => f.rule === "SPEC-M11");
    expect(findings).to.have.length(3);
    expect(findings[0].message)
      .to.include("globalEnvs[0].envs[0]")
      .and.include('Use "PUBLIC_IP"');
    expect(findings[1].message).to.include("PUBLIC_IPP");
    expect(findings[2].message).to.include('"ACTIVE"');
  });

  it("checks references after merging and attributes individual array overrides", () => {
    write("dappnode_package.json", {
      mainService: "worker",
      globalEnvs: [{ envs: ["PUBLIC_IP", "HOSTNAME"], services: ["app"] }]
    });
    write(
      "docker-compose.yml",
      yaml.dump({ services: { app: { image: "alpine:3.21" } } })
    );
    for (const variant of ["good", "bad"]) {
      write(`package_variants/${variant}/dappnode_package.json`, {
        name: `demo-${variant}.dnp.dappnode.eth`,
        version: "0.1.0",
        ...(variant === "bad"
          ? { globalEnvs: [{ envs: ["PUBLIC_IPP"], services: ["missing"] }] }
          : {})
      });
      write(
        `package_variants/${variant}/docker-compose.yml`,
        yaml.dump({
          services:
            variant === "good"
              ? { worker: { image: "alpine:3.21" } }
              : { app: {} }
        })
      );
    }
    const findings = check(dir).filter(
      f => f.rule === "SPEC-M10" || f.rule === "SPEC-M11"
    );
    expect(findings).to.have.length(3);
    expect(findings.every(f => f.message.includes('variant "bad"'))).to.equal(
      true
    );
    expect(
      findings.find(f => f.message.startsWith("mainService"))?.file
    ).to.equal(path.join(dir, "dappnode_package.json"));
    expect(
      findings
        .filter(f => f.message.startsWith("globalEnvs"))
        .every(
          f =>
            f.file ===
            path.join(dir, "package_variants/bad/dappnode_package.json")
        )
    ).to.equal(true);
  });

  it("lets core packages keep container_name, which the installer relies on", () => {
    write("dappnode_package.json", {
      name: "bind.dnp.dappnode.eth",
      version: "0.1.0",
      type: "dncore"
    });
    write(
      "docker-compose.yml",
      yaml.dump({
        version: "3.5",
        services: {
          "bind.dnp.dappnode.eth": {
            build: ".",
            image: "bind.dnp.dappnode.eth:0.1.0",
            container_name: "DAppNodeCore-bind.dnp.dappnode.eth"
          }
        }
      })
    );
    expect(check(dir)).to.deep.equal([]);
  });

  it("formats a report and GitHub annotations with relative paths", () => {
    const findings: SpecFinding[] = [
      {
        rule: "SPEC-C02",
        message: 'Service "app" sets container_name, a, b',
        file: path.join(dir, "docker-compose.yml")
      },
      { rule: "SPEC-B02", message: "line one\nline two" }
    ];
    const report = formatSpecReport(findings, { base: dir });
    expect(report)
      .to.include("2 package spec violations")
      .and.include("future SDK release");
    expect(report).to.include(
      'SPEC-C02 docker-compose.yml: Service "app" sets container_name'
    );
    expect(formatGithubAnnotations(findings, { base: dir })).to.deep.equal([
      `::warning file=docker-compose.yml,title=SPEC-C02 ${specRules["SPEC-C02"].title}::Service "app" sets container_name, a, b`,
      `::warning title=SPEC-B02 ${specRules["SPEC-B02"].title}::line one%0Aline two`
    ]);
  });

  it("collects findings in warn mode and fails validation only in error mode", async () => {
    await initHandler({ dir, yes: true, force: true });
    const manifestPath = path.join(dir, "dappnode_package.json");
    const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
    manifest.mainService = "missing";
    fs.writeFileSync(manifestPath, JSON.stringify(manifest));
    const compose = yaml.load(
      fs.readFileSync(path.join(dir, "docker-compose.yml"), "utf8")
    ) as {
      services: Record<string, Record<string, unknown>>;
    };
    for (const service of Object.values(compose.services))
      service.container_name = "fixed";
    fs.writeFileSync(path.join(dir, "docker-compose.yml"), yaml.dump(compose));
    const packagesToBuildProps = getPackagesToBuildProps({
      allVariants: false,
      rootDir: dir,
      variantsDirPath: path.join(dir, "package_variants"),
      composeFileName: "docker-compose.yml"
    });
    const run = async (mode: string | undefined) => {
      const original = process.env.DAPPNODE_SDK_SPEC;
      if (mode === undefined) delete process.env.DAPPNODE_SDK_SPEC;
      else process.env.DAPPNODE_SDK_SPEC = mode;
      const specFindings: SpecFinding[] = [];
      try {
        const error = await new Listr(
          [
            getFileValidationTask({
              packagesToBuildProps,
              rootDir: dir,
              specFindings
            })
          ],
          { renderer: "silent" }
        )
          .run()
          .then(
            () => null,
            e => e
          );
        return { error, specFindings };
      } finally {
        if (original === undefined) delete process.env.DAPPNODE_SDK_SPEC;
        else process.env.DAPPNODE_SDK_SPEC = original;
      }
    };
    expect(getSpecMode({})).to.equal("warn");
    const warn = await run(undefined);
    expect(warn.error).to.equal(null);
    expect(rulesOf(warn.specFindings)).to.deep.equal(["SPEC-C02", "SPEC-M10"]);
    const strict = await run("error");
    expect(strict.error?.message)
      .to.include("SPEC-C02")
      .and.include("SPEC-M10")
      .and.include("DAPPNODE_SDK_SPEC=error");
    const off = await run("off");
    expect(off.error).to.equal(null);
    expect(off.specFindings).to.deep.equal([]);
  });
});
