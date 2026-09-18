#!/usr/bin/env node
/**
 * 构建 dsh-regression 客户端插件：src/client/index.tsx → lib/client.js
 * 使用 esbuild，输出与 dsh-memory 一致的 __ModuleLoader__.load() 格式。
 */
import { createRequire } from 'node:module'
const require = createRequire(import.meta.url)
const { build } = require('esbuild')
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const pkgName = '@dsh-extra/dsh-regression'

const EXTERNALS = [
  'react', 'react/jsx-runtime', 'react-dom', 'react-dom/client',
  '@deepseek-ai/cordis', '@deepseek-ai/dsh-client-runtime', '@deepseek-ai/dsh-client-runtime/client',
  '@deepseek-ai/dsh-client-ui-conversation', '@deepseek-ai/dsh-client-ui-conversation/client',
  '@deepseek-ai/dsh-client-ui-slots', '@deepseek-ai/dsh-client-web-react',
  '@deepseek-ai/dsh-client-ui-primitives', '@deepseek-ai/dsh-client-locale',
  '@deepseek-ai/dsh-client-locale/client', '@deepseek-ai/dsh-api-remotes',
  '@deepseek-ai/dsh-api-remotes/client', '@deepseek-ai/dsh-client-ui-settings/client',
  '@deepseek-ai/dsh-client-ui-plugin-manager', '@deepseek-ai/dsh-client-ui-plugin-manager/client',
]

const banner = `window.__ModuleLoader__.load({
\tid: ${JSON.stringify(pkgName)},
\tfactory: (require) => {
\t\tvar module = { exports: {} };
\t\tvar exports = module.exports;`

const footer = `\t\treturn module.exports;
\t}
});`

console.log('[build-client] bundling src/client/index.tsx → lib/client.js …')
await build({
  entryPoints: [resolve(root, 'src/client/index.tsx')],
  bundle: true, format: 'cjs', platform: 'browser', target: 'es2022',
  jsx: 'automatic', external: EXTERNALS,
  banner: { js: banner }, footer: { js: footer },
  outfile: resolve(root, 'lib/client.js'),
  sourcemap: true, logLevel: 'info', legalComments: 'none',
}).catch((e) => { console.error(e); process.exit(1) })
console.log('[build-client] done.')
