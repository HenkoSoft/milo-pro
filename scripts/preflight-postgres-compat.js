const fs = require('fs');
const path = require('path');

const ROOT_DIR = path.resolve(__dirname, '..');

const TARGETS = [
  path.join(ROOT_DIR, 'routes'),
  path.join(ROOT_DIR, 'services'),
  path.join(ROOT_DIR, 'auth.js')
];

const FILE_EXTENSIONS = new Set(['.js']);

const CHECKS = [
  { pattern: /\bINSERT\s+OR\s+REPLACE\b/i, label: 'INSERT OR REPLACE' },
  { pattern: /\bstrftime\s*\(/, label: 'strftime()' },
  { pattern: /\bdate\s*\(/, label: 'date()' },
  { pattern: /\bdatetime\s*\(/, label: 'datetime()' },
  { pattern: /\bifnull\s*\(/, label: 'ifnull()' },
  { pattern: /\blast_insert_rowid\s*\(/, label: 'last_insert_rowid()' },
  { pattern: /\bPRAGMA\b/i, label: 'PRAGMA' },
  { pattern: /\bAUTOINCREMENT\b/i, label: 'AUTOINCREMENT' },
  { pattern: /\bgroup_concat\s*\(/, label: 'group_concat()' },
  { pattern: /\bjson_extract\s*\(/, label: 'json_extract()' }
];

const ADAPTER_HANDLED_LABELS = new Set(['strftime()', 'date()', 'datetime()']);

function walkFiles(inputPath, files = []) {
  const stat = fs.statSync(inputPath);
  if (stat.isFile()) {
    if (FILE_EXTENSIONS.has(path.extname(inputPath))) {
      files.push(inputPath);
    }
    return files;
  }

  for (const entry of fs.readdirSync(inputPath, { withFileTypes: true })) {
    if (entry.name === 'node_modules' || entry.name === 'dist') continue;
    walkFiles(path.join(inputPath, entry.name), files);
  }

  return files;
}

function main() {
  const findings = [];
  const files = TARGETS.flatMap((targetPath) => walkFiles(targetPath));

  for (const filePath of files) {
    const content = fs.readFileSync(filePath, 'utf8');
    const relativePath = path.relative(ROOT_DIR, filePath);
    const lines = content.split(/\r?\n/);

    lines.forEach((line, index) => {
      for (const check of CHECKS) {
        if (check.pattern.test(line)) {
          findings.push({
            file: relativePath,
            line: index + 1,
            label: check.label,
            source: line.trim()
          });
        }
      }
    });
  }

  if (!findings.length) {
    console.log('[PG-PREFLIGHT] No se detectaron patrones SQLite especificos en routes/services/auth.js');
    return;
  }

  const adapterHandled = findings.filter((item) => ADAPTER_HANDLED_LABELS.has(item.label));
  const blockers = findings.filter((item) => !ADAPTER_HANDLED_LABELS.has(item.label));

  if (adapterHandled.length > 0) {
    console.log('[PG-PREFLIGHT] Patrones detectados pero ya cubiertos por el adapter PostgreSQL:');
    for (const finding of adapterHandled) {
      console.log(`[PG-PREFLIGHT] ${finding.file}:${finding.line} ${finding.label} -> ${finding.source}`);
    }
  }

  if (!blockers.length) {
    console.log('[PG-PREFLIGHT] No se detectaron bloqueos SQLite-specific sin cubrir');
    return;
  }

  console.log('[PG-PREFLIGHT] Se detectaron bloqueos potenciales no cubiertos:');
  for (const finding of blockers) {
    console.log(`[PG-PREFLIGHT] ${finding.file}:${finding.line} ${finding.label} -> ${finding.source}`);
  }

  process.exitCode = 1;
}

main();
