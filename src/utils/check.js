function check(variable, name, type) {
  if ( variable == null ) {
    throw Error(`Variable ${name} must be defined`);
  } else if (type && typeof variable !== type) {
    throw Error(`Variable ${name} must be of type ${type}`);
  }
}

module.exports = check;
