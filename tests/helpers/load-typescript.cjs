const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

// Execute the production module, replacing only explicit external boundaries.
// Unknown imports fail so tests cannot silently connect to an API or database.
function loadTypescript(filename, imports) {
  const source = fs.readFileSync(path.resolve(filename), 'utf8');
  const { outputText } = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
    },
  });
  const exports = {};
  vm.runInNewContext(
    outputText,
    {
      exports,
      require(name) {
        if (!Object.hasOwn(imports, name)) {
          throw new Error(`Unexpected import in ${filename}: ${name}`);
        }
        return imports[name];
      },
      Request,
      Response,
      URL,
      Date,
      console,
    },
    { filename },
  );
  return exports;
}

module.exports = { loadTypescript };
