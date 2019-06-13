const errTag = "YARGSERR:";

/**
 * Rebrand custom errors as yargs native errors, to display help
 */

/**
 * Call this function instead of throwing a yargs parsing error
 * @param {string} msg
 */
function throwYargsErr(msg) {
  throw Error(`YARGSERR: ${msg}`);
}

/**
 * Use this method to parse this tagged errors
 * @param {object} e Error object
 */
function isYargsErr(e = {}) {
  const msg = e.message || "";
  if (msg.startsWith(errTag)) return e.message.replace(errTag, "").trim();
  else return null;
}

module.exports = {
  throwYargsErr,
  isYargsErr
};
