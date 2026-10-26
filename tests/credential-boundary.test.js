/* eslint-disable @typescript-eslint/no-require-imports */
const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const ts = require('typescript')
const walk = dir => fs.readdirSync(dir, { withFileTypes: true }).flatMap(e => e.isDirectory() ? walk(path.join(dir, e.name)) : [path.join(dir, e.name)])
const files = walk('src').filter(p => /\.(ts|tsx)$/.test(p))
const resolve = (parent, name) => {
  const base = name.startsWith('@/') ? path.resolve('src', name.slice(2)) : name.startsWith('.') ? path.resolve(path.dirname(parent), name) : null
  return base && [base, base + '.ts', base + '.tsx', base + '/index.ts', base + '/index.tsx'].find(p => fs.existsSync(p) && fs.statSync(p).isFile())
}
test('client dependency graphs cannot reach credentials or server-only modules', () => {
  const modules = new Map(files.map(filename => {
    const source = fs.readFileSync(filename, 'utf8')
    const ast = ts.createSourceFile(filename, source, ts.ScriptTarget.Latest, true)
    const imports = []
    function visit(node) {
      if ((ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) && node.moduleSpecifier && !node.importClause?.isTypeOnly && !node.isTypeOnly) imports.push(node.moduleSpecifier.text)
      if (ts.isCallExpression(node) && node.expression.kind === ts.SyntaxKind.ImportKeyword && ts.isStringLiteral(node.arguments[0])) imports.push(node.arguments[0].text)
      ts.forEachChild(node, visit)
    }
    visit(ast)
    return [path.resolve(filename), { source, imports, client: ast.statements.some(n => ts.isExpressionStatement(n) && ts.isStringLiteral(n.expression) && n.expression.text === 'use client') }]
  }))
  const visited = new Set()
  function visit(filename) {
    if (visited.has(filename)) return
    visited.add(filename)
    assert.ok(!filename.includes('/lib/config/'), 'Client code must never import credential configuration')
    const entry = modules.get(filename)
    if (!entry) return
    assert.ok(!entry.imports.includes('server-only'), 'Client dependency graph reached a server-only module: ' + path.relative('.', filename))
    for (const name of entry.imports) {
      const dependency = resolve(filename, name)
      if (dependency) visit(dependency)
    }
  }
  for (const [filename, entry] of modules) if (entry.client) visit(filename)
  assert.ok(visited.size > 0)
})
