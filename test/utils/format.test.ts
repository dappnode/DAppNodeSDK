import { expect } from "chai";
import { Manifest } from "../../src/types";
import { GitHead } from "../../src/utils/git";
import { prettyPinataPinName } from "../../src/utils/format";

describe("utils / format", () => {
  describe("prettyPinataPinName", () => {
    const testCases: {
      id: string;
      manifest: Manifest;
      gitHead?: GitHead;
      result: string;
    }[] = [
      {
        id: "dappmanager with gitdata",
        manifest: {
          name: "dappmanager.dnp.dappnode.eth",
          version: "0.2.30"
        },
        gitHead: {
          branch: "some_feature",
          commit: "16a4d573a05943be5f753fb728bdec1316b97a66"
        },
        result: "dappmanager some_feature 16a4d57"
      },
      {
        id: "dappmanager without gitdata",
        manifest: {
          name: "dappmanager.dnp.dappnode.eth",
          version: "0.2.30"
        },
        result: "dappmanager v0.2.30"
      },
      {
        id: "Public package",
        manifest: {
          name: "external.public.dappnode.eth",
          version: "0.2.30"
        },
        result: "external.public v0.2.30"
      }
    ];

    for (const { id, manifest, gitHead, result } of testCases) {
      it(id, () => {
        expect(prettyPinataPinName(manifest, gitHead)).to.equal(result);
      });
    }
  });
});
