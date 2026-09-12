import { parseStandardReferences } from '../src/lib/references.js';
import { fetchPublisher } from '../src/lib/publishers.js';

// Read-only live smoke check; never writes to D1 or other services.
const names = process.argv.slice(2);
for (const name of names.length ? names : ['EN 300 328', 'EN 61326-1', 'IEC 61326-1', 'CISPR 11', 'RSS-GEN', 'ICES-003']) {
  try {
    const [ref] = parseStandardReferences(name);
    if (!ref) throw new Error('Unknown reference');
    const data = await fetchPublisher(ref);
    console.log(JSON.stringify({ reference: name, success: true, editions: data.editions, checked_at: data.checked_at }));
  } catch (error) {
    process.exitCode = 1;
    console.error(JSON.stringify({ reference: name, success: false, error: error.message }));
  }
}
