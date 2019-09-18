const fs = require("fs");
const path = require("path");

const fileName = "releases.json";

function readReleaseRecordAll(dir) {
  const releaseRecordPath = path.join(dir, fileName);
  return fs.existsSync(releaseRecordPath)
    ? JSON.parse(fs.readFileSync(releaseRecordPath, "utf8"))
    : {};
}

function readReleaseRecord(dir, version) {
  const releaseRecord = readReleaseRecordAll(dir);
  return releaseRecord[version] || {};
}

function writeReleaseRecord(dir, version, newReleaseRecord) {
  const releaseRecordPath = path.join(dir, fileName);
  const releaseRecord = readReleaseRecordAll(dir);
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

function addReleaseRecord({ dir, version, hash, type, ipfsProvider }) {
  const releaseRecord = readReleaseRecord(dir, version);
  const { uploadedTo = {}, hash: previousHash } = releaseRecord;

  writeReleaseRecord(dir, version, {
    hash,
    type,
    uploadedTo: {
      ...(hash === previousHash ? uploadedTo : {}),
      [ipfsProvider]: new Date().toUTCString()
    }
  });
}

function addReleaseTx({ dir, version, link }) {
  writeReleaseRecord(dir, version, {
    link
  });
}

module.exports = {
  addReleaseRecord,
  addReleaseTx
};
