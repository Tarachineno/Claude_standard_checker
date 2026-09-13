// EC's newer export combines references, a title and legal notices in one cell.
// Only designation lines are normative references; citations inside a notice are not.
const REFERENCE_START = /^(?:ETSI\s+)?EN(?:\s+(?:IEC|ISO)(?:\s*\/\s*IEC)?)?\s+\d/i;

export function splitOjReferenceText(value) {
  const lines = String(value || '')
    // Also accept the one-line display form: "EN … V2.1.1 / Short Range …".
    .replace(/\s+\/\s+(?!(?:(?:ETSI\s+)?EN|ISO|IEC)\b|(?:V\d|A\d|AC\b|AMD\b|COR\b))(?=[a-z])/gi, '\n')
    .split(/[\r\n]+/).map(s => s.trim()).filter(Boolean);
  const references = [], title = [], restriction = [];
  let inNotice = false;
  for (const line of lines) {
    if (/^(?:Notice|Restriction)\b/i.test(line)) inNotice = true;
    if (inNotice) restriction.push(line);
    else if (!references.length || REFERENCE_START.test(line)) references.push(line.replace(/,\s*$/, ''));
    else title.push(line);
  }
  return { number: references.join('\n'), title: title.join('\n'), restriction: restriction.join('\n') };
}
