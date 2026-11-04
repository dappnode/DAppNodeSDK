import fs from "fs";
import path from "path";
import yaml from "js-yaml";
import { expect } from "chai";
import Listr from "listr";
import { initHandler } from "../../../src/commands/init/handler.js";
import { generatePackagesProps } from "../../../src/tasks/buildAndUpload/generatePackagesProps.js";
import { getFileCopyTask } from "../../../src/tasks/buildAndUpload/getFileCopyTask.js";
import { getFileValidationTask } from "../../../src/tasks/buildAndUpload/getFileValidationTask.js";
import { getUpdateFilesTask } from "../../../src/tasks/publish/subtasks/getUpdateFilesTask.js";
import {
  readManifest,
  readSetupWizardIfExists
} from "../../../src/files/index.js";
import { ManifestFormat } from "../../../src/files/manifest/types.js";
import {
  temporaryDirectory,
  executable,
  useExecutables
} from "../../helpers/fixtures.js";

describe("template and generic package artifacts", () => {
  let dir: string;
  let variantsDirPath: string;
  beforeEach(async () => {
    dir = temporaryDirectory();
    await initHandler({ dir, yes: true, force: true, use_variants: true });
    variantsDirPath = path.join(dir, "package_variants");
  });
  afterEach(() => fs.rmSync(dir, { recursive: true, force: true }));

  it("packages the merged wizard and notifications, with variant asset overrides", async () => {
    const variantDir = path.join(variantsDirPath, "mainnet");
    fs.writeFileSync(
      path.join(dir, "setup-wizard.json"),
      JSON.stringify({
        version: "2",
        fields: [
          { id: "shared", title: "Shared", description: "Shared field" },
          { id: "replace", title: "Old", description: "Preserved description" }
        ]
      })
    );
    fs.writeFileSync(
      path.join(variantDir, "setup-wizard.yaml"),
      yaml.dump({
        version: "2",
        fields: [
          { id: "replace", title: "Variant" },
          { id: "new", title: "New", description: "New field" }
        ]
      })
    );
    fs.writeFileSync(
      path.join(dir, "notifications.yaml"),
      yaml.dump({
        customEndpoints: [
          {
            name: "shared",
            correlationId: "shared",
            description: "shared",
            enabled: true,
            isBanner: false
          }
        ]
      })
    );
    fs.writeFileSync(
      path.join(variantDir, "notifications.yaml"),
      yaml.dump({
        customEndpoints: [
          {
            name: "variant",
            correlationId: "variant",
            description: "variant",
            enabled: true,
            isBanner: false
          }
        ]
      })
    );
    fs.writeFileSync(path.join(dir, "disclaimer.md"), "shared disclaimer");
    fs.writeFileSync(
      path.join(variantDir, "disclaimer.md"),
      "variant disclaimer"
    );
    fs.writeFileSync(
      path.join(dir, "prometheus-targets.json"),
      JSON.stringify([
        { targets: ["shared:9090"], labels: { network: "shared" } }
      ])
    );
    fs.writeFileSync(
      path.join(variantDir, "prometheus-targets.yaml"),
      yaml.dump([{ targets: ["variant:9090"], labels: { network: "variant" } }])
    );
    const packages = generatePackagesProps({
      variants: ["mainnet"],
      rootDir: dir,
      variantsDirPath
    });
    const pkg = packages[0];
    fs.mkdirSync(pkg.releaseDir, { recursive: true });
    await new Listr(
      [
        getFileCopyTask({
          packagesToBuildProps: packages,
          rootDir: dir,
          variantsDirPath,
          composeFileName: "docker-compose.yml"
        })
      ],
      { renderer: "silent" }
    ).run();
    // The variant's targets replace the root's (e.g. a stale root template in
    // erigon-generic must not be scraped); YAML sources are released as JSON.
    expect(
      JSON.parse(
        fs.readFileSync(
          path.join(pkg.releaseDir, "prometheus-targets.json"),
          "utf8"
        )
      )
    ).to.deep.equal([
      { targets: ["variant:9090"], labels: { network: "variant" } }
    ]);
    const wizard = JSON.parse(
      fs.readFileSync(path.join(pkg.releaseDir, "setup-wizard.json"), "utf8")
    );
    expect(
      wizard.fields.map((field: { id: string }) => field.id)
    ).to.deep.equal(["shared", "replace", "new"]);
    expect(wizard.fields[1]).to.include({
      title: "Variant",
      description: "Preserved description"
    });
    expect(
      yaml.load(
        fs.readFileSync(path.join(pkg.releaseDir, "notifications.yaml"), "utf8")
      )
    ).to.deep.equal(pkg.notifications);
    expect(
      fs.readFileSync(path.join(pkg.releaseDir, "disclaimer.md"), "utf8")
    ).to.equal("variant disclaimer");
  });

  it("preserves an upstream image and updates the release directory when publishing", async () => {
    const packages = generatePackagesProps({
      variants: ["mainnet"],
      rootDir: dir,
      variantsDirPath
    });
    const pkg = packages[0];
    const composePath = path.join(
      variantsDirPath,
      "mainnet",
      "docker-compose.yml"
    );
    fs.writeFileSync(
      composePath,
      yaml.dump({
        version: "3.5",
        services: { external: { image: "alpine:3.21" } }
      })
    );
    const ctx = {
      [pkg.manifest.name]: {
        nextVersion: "0.1.2",
        releaseDir: pkg.releaseDir,
        variant: pkg.variant
      }
    };
    await new Listr(
      [
        getUpdateFilesTask({
          rootDir: dir,
          variantsDirPath,
          composeFileName: "docker-compose.yml",
          packagesToBuildProps: packages
        })
      ],
      { renderer: "silent" }
    ).run(ctx);
    expect(pkg.images.find(image => image.type === "external")).to.include({
      originalImageTag: "alpine:3.21"
    });
    expect(pkg.manifest.version).to.equal("0.1.2");
    expect(pkg.releaseDir).to.equal(
      path.join(dir, `build_${pkg.manifest.name}_0.1.2`)
    );
    expect(ctx[pkg.manifest.name].releaseDir).to.equal(pkg.releaseDir);
  });

  it("accepts a single YAML manifest without invoking template-only restrictions", () => {
    const file = path.join(dir, "single.yaml");
    fs.writeFileSync(file, "name: demo.public.dappnode.eth\nversion: 0.1.0\n");
    expect(
      readManifest([{ dir, manifestFileName: "single.yaml" }]).format
    ).to.equal(ManifestFormat.yaml);
  });

  it("accepts JSON setup wizards and rejects invalid wizard schemas", async () => {
    fs.writeFileSync(
      path.join(dir, "setup-wizard.json"),
      '{"version":"2","fields":[]}'
    );
    expect(readSetupWizardIfExists([{ dir }])).to.deep.equal({
      version: "2",
      fields: []
    });
    const packages = generatePackagesProps({
      variants: ["mainnet"],
      rootDir: dir,
      variantsDirPath
    });
    packages[0].setupWizard = {
      version: "2",
      fields: [{ id: "missing-title" }]
    } as never;
    const bin = path.join(dir, "bin");
    executable(bin, "docker", "process.exit(0);");
    const restore = useExecutables(bin);
    try {
      const error = await new Listr(
        [getFileValidationTask({ packagesToBuildProps: packages })],
        { renderer: "silent" }
      )
        .run()
        .catch(error => error);
      expect(error.message).to.include("Invalid setupWizard");
    } finally {
      restore();
    }
  });
});
