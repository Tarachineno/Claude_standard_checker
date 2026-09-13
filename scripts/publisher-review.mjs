#!/usr/bin/env node
// Portable research interface. No model SDK, public write endpoint, or API key required.
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { readFileSync, writeFileSync, mkdirSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { readReviewState, createManifest, validateReport, buildReviewSql, digest, REVIEW_SCHEMA } from '../src/lib/publisher-review.js';

const exec = promisify(execFile);
const root = fileURLToPath(new URL('../', import.meta.url));
const wrangler = fileURLToPath(new URL('../node_modules/wrangler/bin/wrangler.js', import.meta.url));
const args = process.argv.slice(2), command = args.shift();
const options = {};
while (args.length) {
  const flag = args.shift();
  if (!['--out','--manifest','--results','--keys'].includes(flag) || !args.length || args[0].startsWith('--') || options[flag]) throw new Error('Invalid or duplicate option');
  const value = args.shift();
  options[flag] = flag === '--keys' ? value.split(',').map(key => key.trim()) : resolve(value);
}
if (options['--keys'] && command !== 'export') throw new Error('--keys is only supported for an explicit targeted export');
const readJson = path => {
  if (!path) throw new Error('Missing JSON file argument');
  if (statSync(path).size > 8 * 1024 * 1024) throw new Error('JSON file exceeds 8 MiB');
  return JSON.parse(readFileSync(path, 'utf8'));
};
const save = (path, value) => writeFileSync(path, typeof value === 'string' ? value : JSON.stringify(value, null, 2) + '\n', { flag: 'wx', mode: 0o600 });
async function wrangle(extra) {
  try {
    const result = await exec(process.execPath, [wrangler, 'd1', 'execute', 'standards-checker', '--remote', ...extra], { cwd: root, maxBuffer: 16 * 1024 * 1024 });
    return result.stdout;
  } catch {
    // Wrangler errors can include SQL or signed URLs. Do not echo child output indiscriminately.
    throw new Error('D1 operation failed. Check Cloudflare authentication, network and migrations; verify the run status before retrying.');
  }
}
async function query(sql) {
  const data = JSON.parse(await wrangle(['--command', sql, '--json']));
  if (!Array.isArray(data) || data.some(result => !result.success)) throw new Error('D1 query failed');
  return data.flatMap(result => result.results || []);
}
const db = { prepare(sql) { return { async all() { return { results: await query(sql) }; } }; } };
const quote = text => `'${String(text).replaceAll("'", "''")}'`;

try {
  if (command === 'export') {
    if (!options['--out']) throw new Error('export requires --out NEW_DIRECTORY');
    mkdirSync(options['--out'], { recursive: false });
    const state = await readReviewState(db);
    const manifest = await createManifest(state, new Date().toISOString(), crypto.randomUUID(), options['--keys'] || null);
    save(resolve(options['--out'], 'manifest.json'), manifest);
    save(resolve(options['--out'], 'state-before.json'), state);
    save(resolve(options['--out'], 'results-template.json'), { schema_version: REVIEW_SCHEMA, run_id: manifest.run_id,
      runner: 'SET_EXECUTOR_NAME', results: manifest.targets.map(ref => ({ key: ref.key, expected_hash: ref.expected_hash,
        outcome: 'unverified', note: 'Not yet researched' })) });
    console.log(JSON.stringify({ run_id: manifest.run_id, targets: manifest.targets.length, unresolved_scope_strings: manifest.unresolved_scope_strings, directory: options['--out'] }, null, 2));
  } else if (command === 'validate') {
    const manifest = readJson(options['--manifest']), results = readJson(options['--results']);
    const valid = validateReport(manifest, results);
    console.log(JSON.stringify({ valid: true, verified: valid.filter(result => result.outcome === 'verified').length, unverified: valid.filter(result => result.outcome === 'unverified').length }));
  } else if (command === 'apply') {
    const manifest = readJson(options['--manifest']), results = readJson(options['--results']);
    validateReport(manifest, results);
    const key = quote(manifest.run_id);
    const previous = await query(`SELECT * FROM publisher_review_runs WHERE run_id=${key}`);
    if (previous.length) {
      if (previous[0].report_hash !== await digest(results)) throw new Error('This run_id was already applied with different results');
      console.log(JSON.stringify({ already_applied: true, results: await query(`SELECT reference_key,outcome,reason FROM publisher_review_results WHERE run_id=${key}`) }));
    } else {
      const state = await readReviewState(db);
      const plan = await buildReviewSql(state, manifest, results);
      const directory = options['--out'];
      if (!directory) throw new Error('apply requires --out NEW_DIRECTORY for the backup, SQL and verification result');
      mkdirSync(directory, { recursive: false });
      save(resolve(directory, 'state-before-apply.json'), state);
      save(resolve(directory, 'results.json'), results);
      const file = resolve(directory, 'update.sql');
      save(file, plan.sql);
      await wrangle(['--file', file, '--yes']);
      const applied = await query(`SELECT reference_key,outcome,reason FROM publisher_review_results WHERE run_id=${key} ORDER BY reference_key`);
      if (applied.length !== manifest.targets.length) throw new Error('Post-write run count mismatch; inspect saved artifacts');
      // Read back exact accepted records. Failed/conflicting targets were not written.
      const keys = applied.filter(row => ['changed','unchanged'].includes(row.outcome)).map(row => quote(row.reference_key));
      const records = keys.length ? await query(`SELECT reference_key,manual_json FROM publisher_catalog WHERE reference_key IN (${keys.join(',')})`) : [];
      const expected = new Map(validateReport(manifest, results).map(result => [result.key, result.record]));
      if (records.length !== keys.length || records.some(row => JSON.stringify(JSON.parse(row.manual_json)) !== JSON.stringify(expected.get(row.reference_key)))) throw new Error('Post-write record mismatch; inspect saved artifacts');
      const outcomes = Object.fromEntries(['changed','unchanged','unverified','conflict'].map(value => [value, applied.filter(row => row.outcome === value).length]));
      const verification = { run_id: manifest.run_id, verified_at: new Date().toISOString(), target_keys: manifest.target_keys, outcomes, results: applied,
        unresolved_scope_strings: manifest.unresolved_scope_strings, complete: !manifest.target_keys && !outcomes.unverified && !outcomes.conflict && !manifest.unresolved_scope_strings.length };
      save(resolve(directory, 'verification.json'), verification);
      console.log(JSON.stringify(verification, null, 2));
    }
  } else if (command === 'status') {
    const manifest = readJson(options['--manifest']);
    if (!/^[a-zA-Z0-9_-]{8,100}$/.test(manifest.run_id)) throw new Error('Invalid run_id');
    console.log(JSON.stringify({ runs: await query(`SELECT * FROM publisher_review_runs WHERE run_id=${quote(manifest.run_id)}`),
      results: await query(`SELECT reference_key,outcome,reason FROM publisher_review_results WHERE run_id=${quote(manifest.run_id)}`) }, null, 2));
  } else throw new Error('Usage: publisher-review.mjs export --out NEW_DIRECTORY [--keys KEY,KEY] | validate --manifest FILE --results FILE | apply --manifest FILE --results FILE --out NEW_DIRECTORY | status --manifest FILE');
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
