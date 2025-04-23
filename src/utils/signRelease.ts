import { create, CID } from "ipfs-http-client";
import { base58btc } from "multiformats/bases/base58";
import { base32 } from "multiformats/bases/base32";
import { base64, base64url } from "multiformats/bases/base64";
import { BaseWallet, SigningKey } from "ethers";
import sortBy from "lodash/sortBy";
import { parseIpfsPath } from "./isIpfsHash.js";

const signatureFileName = "signature.json";

export async function signRelease(
  releaseHash: string,
  ipfsApiUrls: string[],
  signingKey: SigningKey,
): Promise<string> {
  if (ipfsApiUrls.length < 1) {
    throw Error("ipfsApiUrls is empty");
  }

  const ipfsArr = ipfsApiUrls.map((ipfsApiUrl) => create({
    url: ipfsApiUrl,
    timeout: "5000"
  }));

  const [ipfs, ...ipfsExtras] = ipfsArr;

  // Format release hash, remove prefix
  const releaseCID = CID.parse(parseIpfsPath(releaseHash));

  const releaseRootDag: IpfsDagGetResult<IpfsDagPbValue> = await ipfs.dag.get(
    releaseCID
  );

  const releaseFilenames = dagGetToFilenames(releaseRootDag);
  if (releaseFilenames.length == 0) {
    throw Error(`releaseRootDag is not a directory has 0 files: ${releaseRootDag.toString()}`)
  }
  if (releaseFilenames.find((filename) => filename === signatureFileName)) {
    throw Error("Release is already signed");
  }

  const releaseFiles = dagGetToFiles(releaseRootDag);
  const cidOpts: ReleaseSignature["cid"] = { version: 0, base: "base58btc" };
  const signedData = serializeIpfsDirectory(releaseFiles, cidOpts);

  const signer = new BaseWallet(signingKey);
  const flatSig = await signer.signMessage(signedData);

  const signature: ReleaseSignature = {
    version: 1,
    cid: cidOpts,
    signature_protocol: "ECDSA_256",
    signature: flatSig,
  };

  const signatureJson = JSON.stringify(signature, null, 2);
  const signatureIpfsEntry = await ipfs.add(signatureJson);
  // Upload to redundant nodes if any
  for (const ipfsExtra of ipfsExtras) await ipfsExtra.add(signatureJson);

  // Mutate dag-pb value appending a new Link
  // TODO: What happens if the block becomes too big
  releaseRootDag.value.Links.push({
    Hash: signatureIpfsEntry.cid,
    Name: signatureFileName,
    Tsize: signatureIpfsEntry.size,
  });

  // DAG-PB form (links must be sorted by Name then bytes)
  releaseRootDag.value.Links = sortBy(releaseRootDag.value.Links, [
    "Name",
    "Bytes",
  ]);

  // Strongly type the options to ensure all properties are known
  const dagProps: Parameters<typeof ipfs.dag.put>[1] = {
    storeCodec: "dag-pb",
    hashAlg: "sha2-256",
  };

  const newReleaseCid = await ipfs.dag.put(releaseRootDag.value, dagProps);
  // Upload to redundant nodes if any
  for (const ipfsExtra of ipfsExtras)
    await ipfsExtra.dag.put(releaseRootDag.value, dagProps);

  // Validate that the new release hash contains all previous files + signature
  const newReleaseRootDag = await ipfs.dag.get(newReleaseCid);
  const newFilesStr = JSON.stringify(
    dagGetToFilenames(newReleaseRootDag).sort()
  );
  const expectedFilesStr = JSON.stringify(
    [...releaseFiles.map((file) => file.name), signatureFileName].sort()
  );
  if (newFilesStr !== expectedFilesStr) {
    throw Error(`Wrong files in new release: ${newFilesStr}`);
  }

  return newReleaseCid.toV0().toString();
}

interface IpfsDagPbValue {
  Data: Uint8Array;
  Links: {
    Hash: CID;
    /** "dappnode_package.json" */
    Name: string;
    /** 67 */
    Tsize: number;
  }[];
}

interface IpfsDagGetResult<V> {
  /**
   * The value or node that was fetched during the get operation
   */
  value: V;

  /**
   * The remainder of the Path that the node was unable to resolve or what was left in a localResolve scenario
   */
  remainderPath?: string;
}

/**
 * Example serializing `QmRhdmquYoiMR5GB2dKqhLipMzdFUeyZ2eSVvTLDvndTvh` with v0 base58btc
 *
 * ```
 * avatar.png zdj7WnZ4Yn4ev7T8qSACAjqnErfqfQsCPsfrHuJNKcaAp7PkJ
 * dappmanager.dnp.dappnode.eth_0.2.43_linux-amd64.txz zdj7WifbEQAjxvDftqcMBFPVexDu4SmMF66NkcoPJjtHv9HJQ
 * dappmanager.dnp.dappnode.eth_0.2.43_linux-arm64.txz zdj7WhMmCV4ZRJQ981bqsZd9Wcu6rSMqgSqx8fKJcnbmRhB5H
 * dappmanager.dnp.dappnode.eth_0.2.43.tar.xz zdj7WifbEQAjxvDftqcMBFPVexDu4SmMF66NkcoPJjtHv9HJQ
 * dappnode_package.json zdj7WbUmsj617EgJRysWqPpzJxriYfmBxBo1uhAv3kqq6k3VJ
 * docker-compose.yml zdj7Wf2pYesVyvSbcTEwWVd8TFtTjv588FET9L7qgkP47kRkf
 * ```
 */
export function serializeIpfsDirectory(
  files: { name: string; cid: CID }[],
  opts: ReleaseSignature["cid"]
): string {
  return (
    files
      .filter((file) => file.name && file.name !== signatureFileName)
      // Sort alphabetically in descending order
      .sort((a, b) => a.name.localeCompare(b.name))
      /** `${name} ${cidStr}` */
      .map((file) => {
        const cidStr = cidToString(
          getCidAtVersion(file.cid, opts.version),
          opts.base
        );
        return `${file.name} ${cidStr}`;
      })
      .join("\n")
  );
}

interface ReleaseSignature {
  /** Version of the ReleaseSignature format */
  version: 1;
  /** Specs of the signed CIDs */
  cid: {
    version: 0 | 1;
    base: "base58btc" | "base32" | "base64" | "base64url";
  };
  signature_protocol: "ECDSA_256";
  /**
   * Signature of the serialized files in the directory
   * ```
   * 0x71b61418808a85c495f52bc9c781cbfeb0154c86aec8528c6cf7a83a26a0365f7ac4dea4eea7eea5e4ec14a10e01d8b8708d8c0c7c12420d152a272b69092b851b
   * ```
   */
  signature: string;
}

function getCidAtVersion(cid: CID, version: number): CID {
  switch (version) {
    case 0:
      return cid.toV0();
    case 1:
      return cid.toV1();
    default:
      throw Error(`Unknown CID version ${version}`);
  }
}

function cidToString(cid: CID, base: string): string {
  switch (base) {
    case "base58btc":
      return cid.toString(base58btc);
    case "base32":
      return cid.toString(base32);
    case "base64":
      return cid.toString(base64);
    case "base64url":
      return cid.toString(base64url);
    default:
      throw Error(`Unknown CID base ${base}`);
  }
}

function dagGetToFiles(
  content: IpfsDagGetResult<IpfsDagPbValue>
): { name: string; cid: CID }[] {
  return content.value.Links.map((link) => ({
    cid: CID.parse(parseIpfsPath(link.Hash.toString())),
    name: link.Name,
  }));
}

function dagGetToFilenames(
  content: IpfsDagGetResult<IpfsDagPbValue>
): string[] {
  return content.value.Links.map((link) => link.Name);
}

