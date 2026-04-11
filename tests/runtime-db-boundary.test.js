const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const repoRoot = process.cwd();
const allowedDirectImports = new Set([
  path.normalize('backend/src/services/runtime-db.ts')
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
    if (entry.isFile() && (entry.name.endsWith('.js') || entry.name.endsWith('.ts'))) {
      collected.push(fullPath);
    }
  }
  return collected;
}

function findDirectDatabaseImports() {
  const directories = ['backend/src/routes', 'backend/src/services'];
  const offenders = [];

  for (const directory of directories) {
    const files = collectFiles(path.join(repoRoot, directory));
    for (const filePath of files) {
      const relativePath = path.normalize(path.relative(repoRoot, filePath));
      const content = fs.readFileSync(filePath, 'utf8');
      const hasDirectImport = content.includes("require('../config/database')")
        || content.includes('require("../config/database")')
        || content.includes("require('../config/database.js')")
        || content.includes('require("../config/database.js")');

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

