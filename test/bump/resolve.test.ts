import { expect } from "chai";
import { BumpCompose, Upstream } from "../../src/bump/discovery.js";
import {
  getCurrentPin,
  ResolutionDependencies,
  resolveUpstream,
  parsePin
} from "../../src/bump/resolve.js";

const digest = `sha256:${"a".repeat(64)}`;
const upstream: Upstream = {
  repo: "acme/app",
  arg: "VERSION",
  version: "1.0.0",
  provider: "docker"
};
const compose = (value = "1.0.0"): BumpCompose => ({
  services: { app: { build: { args: { VERSION: value } } } }
});
async function rejects(task: Promise<unknown>, message: string): Promise<void> {
  try {
    await task;
  } catch (error) {
    expect(error.message).to.include(message);
    return;
  }
  throw Error(`Expected rejection: ${message}`);
}
function dependencies(
  tag: string | null
): ResolutionDependencies & { calls: string[] } {
  const calls: string[] = [];
  return {
    calls,
    latestRelease: async () => tag,
    imageSource: () => ({ image: "org/app", template: "multiarch-{version}" }),
    registry: {
      tagExists: async (_, tag) => {
        calls.push(tag);
        return !tag.includes("-v");
      },
      manifestDigest: async (_, tag) => {
        calls.push(`digest:${tag}`);
        return digest;
      },
      latestTag: async () => tag
    }
  };
}

describe("bump / resolve", () => {
  it("splits only the last @sha256 suffix and enforces lowercase digests", () => {
    expect(parsePin(`n8n@2.10.3@${digest}`)).to.deep.equal({
      version: "n8n@2.10.3",
      digest
    });
    expect(parsePin("n8n@2.10.3")).to.deep.equal({ version: "n8n@2.10.3" });
    for (const value of [
      `1@sha256:${"A".repeat(64)}`,
      "1@sha256:short",
      `@${digest}`
    ])
      expect(() => parsePin(value)).to.throw("Invalid digest pin");
  });

  it("maps candidate tags and writes the candidate rather than its rendered template", async () => {
    const deps = dependencies("v2.0.0");
    expect(await resolveUpstream(".", compose(), upstream, deps)).to.include({
      targetVersion: "2.0.0",
      composeValue: "2.0.0"
    });
    expect(deps.calls).to.deep.equal(["multiarch-v2.0.0", "multiarch-2.0.0"]);
  });

  it("preserves plain and pinned styles and resolves the new image digest", async () => {
    const deps = dependencies("v2.0.0");
    expect(
      await resolveUpstream(".", compose(`1.0.0@${digest}`), upstream, deps)
    ).to.include({ targetVersion: "2.0.0", composeValue: `2.0.0@${digest}` });
    expect(deps.calls.at(-1)).to.equal("digest:multiarch-2.0.0");
    const plain = dependencies("v2.0.0");
    await resolveUpstream(".", compose(), upstream, plain);
    expect(plain.calls.some(call => call.startsWith("digest:"))).to.equal(
      false
    );
  });

  it("short-circuits already-current and older releases before registry or Dockerfile access", async () => {
    for (const tag of ["1.0.0", "v1.0.0", "v0.9.0"]) {
      const deps = dependencies(tag);
      deps.imageSource = () => {
        throw Error("must not read image");
      };
      expect(await resolveUpstream(".", compose(), upstream, deps)).to.include({
        targetVersion: "1.0.0",
        composeValue: "1.0.0"
      });
      expect(deps.calls).to.deep.equal([]);
    }
  });

  it("uses github versions as-is and supports args outside FROM without registry calls", async () => {
    const deps = dependencies("v2.0.0");
    expect(
      await resolveUpstream(
        ".",
        compose(),
        { ...upstream, provider: "github" },
        deps
      )
    ).to.include({ targetVersion: "v2.0.0" });
    deps.imageSource = () => null;
    expect(await resolveUpstream(".", compose(), upstream, deps)).to.include({
      targetVersion: "v2.0.0"
    });
    expect(deps.calls).to.deep.equal([]);
    await rejects(
      resolveUpstream(".", compose(`1.0.0@${digest}`), upstream, deps),
      "needs a FROM image"
    );
  });

  it("extracts docker_tags versions and does not downgrade them", async () => {
    const deps = dependencies("v2.0.0");
    expect(
      await resolveUpstream(
        ".",
        compose(),
        { ...upstream, provider: "docker_tags", tagPattern: "^v(.*)$" },
        deps
      )
    ).to.include({ targetVersion: "2.0.0" });
    expect(deps.calls).to.deep.equal([]);
    expect(
      await resolveUpstream(
        ".",
        compose("3.0.0"),
        { ...upstream, version: "3.0.0", provider: "docker_tags" },
        deps
      )
    ).to.include({ targetVersion: "3.0.0" });
    await rejects(
      resolveUpstream(
        ".",
        compose(),
        { ...upstream, provider: "docker_tags", tagPattern: "^other/(.*)$" },
        deps
      ),
      "does not match tagPattern"
    );
  });

  it("allows explicit downgrades and skips release lookup", async () => {
    const deps = dependencies(null);
    deps.latestRelease = async () => {
      throw Error("must not query releases");
    };
    expect(
      await resolveUpstream(".", compose(), upstream, deps, "v0.9.0")
    ).to.include({ targetVersion: "0.9.0" });
  });

  it("rejects inconsistent versions, pinning styles, digests and missing args", () => {
    const mixed = (a: string, b: string): BumpCompose => ({
      services: {
        a: { build: { args: { VERSION: a } } },
        b: { build: { args: [`VERSION=${b}`] } }
      }
    });
    expect(() => getCurrentPin(mixed("1.0.0", "0.9.0"), upstream)).to.throw(
      "Inconsistent Compose pin"
    );
    expect(() =>
      getCurrentPin(mixed("1.0.0", `1.0.0@${digest}`), upstream)
    ).to.throw("Inconsistent digest pins");
    expect(() =>
      getCurrentPin(
        mixed(`1.0.0@${digest}`, `1.0.0@sha256:${"b".repeat(64)}`),
        upstream
      )
    ).to.throw("Inconsistent digest pins");
    expect(() => getCurrentPin({ services: {} }, upstream)).to.throw(
      "is absent"
    );
  });

  it("fails on absent candidates and registry errors", async () => {
    const deps = dependencies("v2.0.0");
    deps.registry.tagExists = async () => false;
    await rejects(
      resolveUpstream(".", compose(), upstream, deps),
      "No Docker tag candidate exists"
    );
    deps.registry.tagExists = async () => {
      throw Error("registry 500");
    };
    await rejects(
      resolveUpstream(".", compose(), upstream, deps),
      "registry 500"
    );
    deps.registry.tagExists = async () => true;
    deps.registry.manifestDigest = async () => {
      throw Error("pinning failed");
    };
    await rejects(
      resolveUpstream(".", compose(`1.0.0@${digest}`), upstream, deps),
      "pinning failed"
    );
  });
});
