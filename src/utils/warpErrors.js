function warpErrors(fn) {
  return async (...args) => {
    try {
      await fn(...args);
      process.exit(0);
    } catch (e) {
      console.error(`Error: ${e.message}`);
      process.exit(1);
    }
  };
}

module.exports = warpErrors;
