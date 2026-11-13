import { createRequire } from 'node:module'
import { readFile, writeFile } from 'node:fs/promises'
import { dirname, join, relative, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'
import { collectLicenses, sha256 } from './collect-licenses.mjs'

const require = createRequire(import.meta.url), root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const webpack = require('webpack'), config = require('../webpack.config.js')
const lockBytes = await readFile(join(root, 'package-lock.json')), lock = JSON.parse(lockBytes)
const compiler = webpack({ ...config, context: root, mode: 'production' })
const stats = await new Promise((resolve, reject) => compiler.run((error, result) => error ? reject(error) : resolve(result)))
try {
  if (stats.hasErrors()) throw new Error(stats.toString({ preset: 'errors-only' }))
  if (stats.hasWarnings()) console.warn(stats.toString({ preset: 'errors-warnings' }))
  const compilation = stats.compilation, main = compilation.entrypoints.get('main')
  if (!main) throw new Error('No webpack main entrypoint.')
  const paths = new Set(), visited = new Set()
  async function visit(module) {
    if (visited.has(module)) return
    visited.add(module)
    if (module.resource) {
      const resource = module.resource.split('?')[0]
      let cursor = dirname(resource)
      while (cursor !== root && cursor !== dirname(cursor)) {
        const path = relative(root, cursor).split(sep).join('/')
        if (path.startsWith('node_modules/') && lock.packages[path]) { paths.add(path); break }
        cursor = dirname(cursor)
      }
    }
    // Concatenated modules inherit membership of their containing main chunk.
    if (module.modules) for (const child of module.modules) await visit(child)
  }
  for (const chunk of main.getEntrypointChunk().getAllReferencedChunks()) {
    for (const module of compilation.chunkGraph.getChunkModulesIterable(chunk)) await visit(module)
  }
  const packages = []
  for (const path of [...paths].sort()) {
    const pkg = JSON.parse(await readFile(join(root, path, 'package.json'), 'utf8')), locked = lock.packages[path]
    if (pkg.version !== locked.version) throw new Error(`Installed package differs from lock: ${path}`)
    packages.push({ path, name: pkg.name, version: pkg.version, integrity: locked.integrity })
  }
  const manifest = {
    bundle: 'js/main.js', bundleSha256: sha256(await readFile(join(root, 'js/main.js'))),
    bundleNotices: 'js/main.js.LICENSE.txt', bundleNoticesSha256: sha256(await readFile(join(root, 'js/main.js.LICENSE.txt'))),
    lockSha256: sha256(lockBytes), packages,
  }
  await writeFile(join(root, 'js/main.licenses.json'), `${JSON.stringify(manifest, null, 2)}\n`, 'utf8')
  await collectLicenses({ root })
  console.log(`Webpack production bundle built with ${packages.length} third-party packages.`)
} finally {
  await new Promise((resolve, reject) => compiler.close(error => error ? reject(error) : resolve()))
}
