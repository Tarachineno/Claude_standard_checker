import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { parseStandardsFromXlsx } from '../src/lib/excel.js';
import { findExcelLinkInHtml, listAnchors } from '../src/lib/standards.js';

test('bundled EC Excel files parse', () => {
  for (const [d, min] of [['EMC', 150], ['RED', 200], ['LVD', 800]]) {
    const bytes = new Uint8Array(readFileSync(new URL(`../static/data/${d}.xlsx`, import.meta.url)));
    const list = parseStandardsFromXlsx(bytes, d);
    assert.ok(list.length >= min, `${d}: ${list.length}`);
    assert.ok(list.every(s => s.number.includes('EN')));
    assert.ok(list.some(s => /^\d{4}-\d{2}-\d{2}$/.test(s.withdrawal_date)), `${d}: withdrawal dates converted`);
  }
});

test('findExcelLinkInHtml picks the summary xls link', () => {
  const html = `<html><body>
    <p>Publications</p>
    <a href="/single-market/goods/x_en">Page</a>
    <a class="ecl-link" href="https://ec.europa.eu/docsroom/documents/51315">Summary list as&nbsp;<strong>xls</strong> file</a>
    <a href="/foo.pdf">Summary list as pdf</a></body></html>`;
  assert.equal(findExcelLinkInHtml(html, 'https://single-market-economy.ec.europa.eu/x'), 'https://ec.europa.eu/docsroom/documents/51315');
  assert.equal(listAnchors(html).length, 3);
  assert.equal(findExcelLinkInHtml('<a href="/a">nothing</a>', 'https://x/'), null);
});
