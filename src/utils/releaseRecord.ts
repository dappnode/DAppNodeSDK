import fs from "fs";
import path from "path";

interface ReleaseRecord {
  hash: string;
  type: string;
  uploadedTo: {
    [location: string]: string;
  };
}

const fileName = "releases.json";

function readReleaseRecords(dir: string) {
  const releaseRecordPath = path.join(dir, fileName);
  return fs.existsSync(releaseRecordPath)
    ? JSON.parse(fs.readFileSync(releaseRecordPath, "utf8"))
    : {};
}

function readReleaseRecord(dir: string, version: string) {
  const releaseRecord = readReleaseRecords(dir);
  return releaseRecord[version] || {};
}

function writeReleaseRecord(
  dir: string,
  version: string,
  newReleaseRecord: Partial<ReleaseRecord>
) {
  const releaseRecordPath = path.join(dir, fileName);
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
    JSON.stringify(mergedReleaseRecord, null, 2)
  );
}

export function addReleaseRecord({
  dir,
  version,
  hash,
  type,
  to
}: {
  dir: string;
  version: string;
  hash: string;
  type: string;
  to: string;
}) {
  const releaseRecord = readReleaseRecord(dir, version);
  const { uploadedTo = {}, hash: previousHash } = releaseRecord;

  writeReleaseRecord(dir, version, {
    hash,
    type,
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
}) {
  writeReleaseRecord(dir, version, { link });
}
