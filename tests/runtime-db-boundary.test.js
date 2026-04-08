const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const repoRoot = process.cwd();
const allowedDirectImports = new Set([
  path.normalize('services/runtime-db.js')
]);

function collectFiles(dirPath, collected = []) {
  const entries = fs.readdirSync(dirPath, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dirPath, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === 'node_modules' || entry.name === '.git' || entry.name === 'dist') {
        continue;
      }
      collectFiles(fullPath, collected);
      continue;
    }
    if (entry.isFile() && entry.name.endsWith('.js')) {
      collected.push(fullPath);
    }
  }
  return collected;
}

function findDirectDatabaseImports() {
  const directories = ['routes', 'services'];
  const offenders = [];

  for (const directory of directories) {
    const files = collectFiles(path.join(repoRoot, directory));
    for (const filePath of files) {
      const relativePath = path.normalize(path.relative(repoRoot, filePath));
      const content = fs.readFileSync(filePath, 'utf8');
      const hasDirectImport = content.includes("require('../database')")
        || content.includes('require("../database")')
        || content.includes("require('./database')")
        || content.includes('require("./database")');

      if (hasDirectImport && !allowedDirectImports.has(relativePath)) {
        offenders.push(relativePath);
      }
    }
  }

  return offenders.sort();
}

function runCase(name, fn) {
  try {
    fn();
    console.log(`PASS ${name}`);
  } catch (error) {
    console.error(`FAIL ${name}`);
    throw error;
  }
}

runCase('solo runtime-db puede importar database directamente en routes/services', () => {
  const offenders = findDirectDatabaseImports();
  assert.deepEqual(offenders, []);
});
