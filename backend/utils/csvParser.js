const { parse } = require('csv-parser');
const { Readable } = require('stream');

/**
 * Generic CSV buffer parser.
 * Returns an array of row objects keyed by header names.
 * @param {Buffer} buffer
 * @returns {Promise<Array<object>>}
 */
const parseCSVBuffer = (buffer) => {
  return new Promise((resolve, reject) => {
    const rows = [];
    Readable.from(buffer)
      .pipe(parse({ headers: true, skipEmptyLines: true, trim: true }))
      .on('data', (row) => rows.push(row))
      .on('end', () => resolve(rows))
      .on('error', (err) => reject(new Error(`CSV parse error: ${err.message}`)));
  });
};

/**
 * Validates that required columns are present in the first row.
 * @param {Array<object>} rows
 * @param {string[]} requiredCols
 * @throws {Error} if any required column is missing
 */
const validateCSVColumns = (rows, requiredCols) => {
  if (!rows.length) throw new Error('CSV file is empty or has no data rows.');
  const headers = Object.keys(rows[0]);
  const missing = requiredCols.filter((col) => !headers.includes(col));
  if (missing.length) {
    throw new Error(`CSV missing required columns: ${missing.join(', ')}`);
  }
};

module.exports = { parseCSVBuffer, validateCSVColumns };