import { expect } from "chai";
import { SigningKey, verifyMessage, computeAddress } from "ethers";
import { create } from "ipfs-http-client";
import { serializeIpfsDirectory, signRelease } from "../../src/utils/signRelease.js";
import { ReleaseSignature } from "@dappnode/types";

describe("util > signRelease", function () {
  this.timeout(120 * 1000);

  it("throws if ipfsApiUrls is empty", async () => {
    const localIpfsUrl = "http://localhost:5001";
    const firstFileContent = "Hello world";

    // Upload a fake release
    const localIpfs = create({ url: localIpfsUrl, timeout: "5000" }); 
    const releaseHash = (await localIpfs.add(firstFileContent, { wrapWithDirectory: true })).cid.toString();

    const signingKey = new SigningKey("0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa");
    const newReleaseHash = await signRelease(releaseHash, [localIpfsUrl], signingKey);

    const releaseEntries = await collectAll(localIpfs.ls(newReleaseHash));
    const releaseFiles = releaseEntries.filter((entry) => entry.type === "file");
    expect(releaseFiles).to.have.lengthOf(2);

    // Assert release directory contains the expect original file
    const firstFileCID = releaseFiles[0].cid.toString();
    const firstFile = await catToString(localIpfs.cat(firstFileCID));
    expect(firstFile).equal(firstFileContent);

    // Assert the new file is the signature JSON
    const signatureEntry = releaseFiles[1];
    expect(signatureEntry.name).equal("signature.json");
    const signatureFileTxt = await catToString(localIpfs.cat(signatureEntry.cid));
    const signatureFileJson = JSON.parse(signatureFileTxt);

    // Assert signature is correct
    const cidOpts: ReleaseSignature["cid"] = { version: 0, base: "base58btc" };
    const signatureContent = serializeIpfsDirectory(releaseEntries, cidOpts);
    const recoveredAddress = verifyMessage(signatureContent, signatureFileJson.signature);
    const signerAddress = computeAddress(signingKey.publicKey);
    expect(recoveredAddress).equal(signerAddress); 
  });
});

/**
 * Drain any `AsyncIterable<T>` into an array.
 */
async function collectAll<T>(src: AsyncIterable<T>): Promise<T[]> {
  const out: T[] = [];
  for await (const x of src) out.push(x);
  return out;
}

async function catToString(
  iterable: AsyncIterable<Uint8Array>
): Promise<string> {
  const decoder = new TextDecoder();
  let out = "";

  for await (const chunk of iterable) {
    out += decoder.decode(chunk, { stream: true }); // stream=true keeps decoder state
  }
  out += decoder.decode(); // flush last partial code‑point
  return out;
}
