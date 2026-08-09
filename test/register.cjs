// Unit tests for provider utilities do not require a Zotero runtime.
const fs = require("node:fs");
require.extensions[".md"] = (module, filename) => {
  module.exports = fs.readFileSync(filename, "utf8");
};
