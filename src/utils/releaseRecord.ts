import fs from "fs";
import path from "path";
import { stringifyJson } from "../files/index.js";
import { ManifestFormat } from "@dappnode/types";

interface ReleaseRecord {
  hash: string;
  link: string;
  uploadedTo: {
    [location: string]: string;
  };
}

interface ReleaseRecords {
  [version: string]: ReleaseRecord;
}

export const releasesRecordFileName = "releases.json";

function readReleaseRecords(dir: string): ReleaseRecords {
  const releaseRecordPath = path.join(dir, releasesRecordFileName);
  return fs.existsSync(releaseRecordPath)
    ? JSON.parse(fs.readFileSync(releaseRecordPath, "utf8"))
    : {};
}

function readReleaseRecord(dir: string, version: string): ReleaseRecord {
  const releaseRecord = readReleaseRecords(dir);
  return releaseRecord[version] || {};
}

function writeReleaseRecord(
  dir: string,
  version: string,
  newReleaseRecord: Partial<ReleaseRecord>
): void {
  const releaseRecordPath = path.join(dir, releasesRecordFileName);
  const releaseRecord = readReleaseRecords(dir);
  const mergedReleaseRecord = {
    ...releaseRecord,
    [version]: {
      ...releaseRecord[version],
      ...newReleaseRecord
    }
  };
  fs.writeFileSync(
    releaseRecordPath,
    stringifyJson(mergedReleaseRecord, ManifestFormat.json)
  );
}

export function addReleaseRecord({
  dir,
  version,
  hash,
  to
}: {
  dir: string;
  version: string;
  hash: string;
  to: string;
}): void {
  const releaseRecord = readReleaseRecord(dir, version);
  const { uploadedTo = {}, hash: previousHash } = releaseRecord;

  writeReleaseRecord(dir, version, {
    hash,
    uploadedTo: {
      ...(hash === previousHash ? uploadedTo : {}),
      [to]: new Date().toUTCString()
    }
  });
}

export function addReleaseTx({
  dir,
  version,
  link
}: {
  dir: string;
  version: string;
  link: string;
}): void {
  writeReleaseRecord(dir, version, { link });
}
