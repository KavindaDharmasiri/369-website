const fs = require('node:fs')
const path = require('node:path')
const ts = require('typescript')

// Offline handler testing only: this is not a database or Next server emulator.
function loadTypescript(relativePath, mocks = {}) {
  const root = path.resolve(__dirname, '..')
  const cache = new Map()
  function load(filename) {
    if (cache.has(filename)) return cache.get(filename).exports
    const loadedModule = { exports: {} }
    cache.set(filename, loadedModule)
    const source = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
      fileName: filename,
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true, jsx: ts.JsxEmit.ReactJSX },
    }).outputText
    const requireModule = (id) => {
      if (Object.hasOwn(mocks, id)) return mocks[id]
      if (id.startsWith('@/') || id.startsWith('.')) {
        let resolved = id.startsWith('@/') ? path.join(root, 'src', id.slice(2)) : path.resolve(path.dirname(filename), id)
        if (!path.extname(resolved)) resolved += '.ts'
        // Never load the real DB/credentials as an accidental test fallback.
        if (resolved === path.join(root, 'src/lib/db.ts') || resolved === path.join(root, 'src/lib/auth.ts')) {
          throw new Error(`A test double is required for ${id}`)
        }
        return load(resolved)
      }
      return require(id)
    }
    const quiet = { ...console, error() {}, warn() {} }
    new Function('require', 'module', 'exports', 'console', source)(requireModule, loadedModule, loadedModule.exports, quiet)
    return loadedModule.exports
  }
  return load(path.join(root, relativePath))
}

module.exports = { loadTypescript }
