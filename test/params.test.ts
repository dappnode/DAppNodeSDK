import { expect } from "chai";
import { Architecture } from "@dappnode/types";
import { getLegacyImagePath } from "../src/utils/getLegacyImagePath.js";
import { getImageFileName } from "../src/utils/getImageFileName.js";

describe("params", () => {
  const testCases: {
    name: string;
    version: string;
    arch: Architecture;
    imagePath: string;
    legacyImagePath: string;
  }[] = [
    {
      name: "geth.dnp.dappnode.eth",
      version: "0.1.0",
      arch: "linux/amd64",
      imagePath: "geth.dnp.dappnode.eth_0.1.0_linux-amd64.txz",
      legacyImagePath: "geth.dnp.dappnode.eth_0.1.0.tar.xz"
    },
    {
      name: "geth.dnp.dappnode.eth",
      version: "0.1.0",
      arch: "linux/arm64",
      imagePath: "geth.dnp.dappnode.eth_0.1.0_linux-arm64.txz",
      legacyImagePath: "geth.dnp.dappnode.eth_0.1.0.tar.xz"
    }
  ];

  for (const { name, version, arch, imagePath } of testCases) {
    it(`should get imagePath for ${name} ${version} ${arch}`, () => {
      expect(getImageFileName(name, version, arch)).to.equal(imagePath);
    });
  }
  for (const { name, version, legacyImagePath } of testCases) {
    it(`should get legacyImagePath for ${name} ${version}`, () => {
      expect(getLegacyImagePath(name, version)).to.equal(legacyImagePath);
    });
  }
});
