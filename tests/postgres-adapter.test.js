const assert = require('node:assert/strict');

function runCase(name, fn) {
  try {
    fn();
    console.log(`PASS ${name}`);
  } catch (error) {
    console.error(`FAIL ${name}`);
    throw error;
  }
}

function main() {
  const { convertQuestionParamsToPg } = require('../backend/dist/db/postgres-adapter.js');

  runCase('convierte placeholders sqlite a postgres', () => {
    const sql = 'SELECT * FROM products WHERE id = ? AND sku = ?';
    assert.equal(
      convertQuestionParamsToPg(sql),
      'SELECT * FROM products WHERE id = $1 AND sku = $2'
    );
  });

  runCase('respeta signos de pregunta dentro de strings', () => {
    const sql = "SELECT '?' as literal, name FROM products WHERE sku = ?";
    assert.equal(
      convertQuestionParamsToPg(sql),
      "SELECT '?' as literal, name FROM products WHERE sku = $1"
    );
  });

  runCase('traduce date sobre columnas a cast date', () => {
    const sql = 'SELECT * FROM sales s WHERE date(s.created_at) = ?';
    assert.equal(
      convertQuestionParamsToPg(sql),
      'SELECT * FROM sales s WHERE CAST(s.created_at AS DATE) = $1'
    );
  });

  runCase('traduce filtros sqlite de hoy y rangos relativos', () => {
    const sql = "SELECT * FROM sales WHERE date(created_at) = date('now') AND created_at >= date('now', '-7 days')";
    assert.equal(
      convertQuestionParamsToPg(sql),
      "SELECT * FROM sales WHERE CAST(created_at AS DATE) = CURRENT_DATE AND created_at >= CURRENT_DATE - INTERVAL '7 days'"
    );
  });

  runCase('traduce comparaciones strftime de mes y anio', () => {
    const monthSql = "SELECT * FROM sales WHERE strftime('%Y-%m', created_at) = strftime('%Y-%m', 'now')";
    const yearSql = "SELECT * FROM sales WHERE strftime('%Y', created_at) = strftime('%Y', 'now')";

    assert.equal(
      convertQuestionParamsToPg(monthSql),
      "SELECT * FROM sales WHERE TO_CHAR(created_at, 'YYYY-MM') = TO_CHAR(CURRENT_DATE, 'YYYY-MM')"
    );
    assert.equal(
      convertQuestionParamsToPg(yearSql),
      "SELECT * FROM sales WHERE TO_CHAR(created_at, 'YYYY') = TO_CHAR(CURRENT_DATE, 'YYYY')"
    );
  });
}

main();
