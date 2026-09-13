import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createContext, runInContext } from 'node:vm';
const script = readFileSync(new URL('../static/publisher-notices.js', import.meta.url), 'utf8');
const notice = { id: 1, designation: 'IEC 61326-1', before: ['2020'], after: ['2024'], source_url: 'https://webstore.iec.ch/', detected_at: '2026-09-13T00:00:00.000Z', expires_at: '2026-09-20T00:00:00.000Z' };
function view(lang = 'ja') {
  const elements = new Map();
  const get = id => {
    if (!elements.has(id)) elements.set(id, { hidden: true, textContent: '', innerHTML: '', attributes: {},
      classList: { add() { elements.get(id).hidden = true; }, remove() { elements.get(id).hidden = false; } },
      setAttribute(name, value) { this.attributes[name] = value; }, addEventListener() {} });
    return elements.get(id);
  };
  const context = createContext({ Date, console, currentLanguage: lang, fixture: { items: [{ ...notice }], banner_days: 7 },
    localStorage: { getItem() { return null; }, setItem() {} }, setInterval() {},
    document: { getElementById: get, addEventListener() {} },
    esc: value => String(value).replaceAll('<', '&lt;').replaceAll('>', '&gt;'),
    safeSourceLink: (url, label) => url.startsWith('https:') ? `<a>${label}</a>` : '',
  });
  const run = code => runInContext(code, context);
  run(script); run('publisherChanges = fixture');
  return { get, run, context };
}
test('notices show changed editions and official evidence in both languages', () => {
  for (const lang of ['ja','en']) {
    const ui = view(lang);
    ui.run("renderPublisherNotices(Date.parse('2026-09-14T00:00:00Z'))");
    assert.equal(ui.get('publisher-change-banner').hidden, false);
    assert.match(ui.get('publisher-change-list').innerHTML, /2020 → 2024/);
    assert.ok(ui.get('publisher-change-title').textContent.includes('1'));
    assert.ok(ui.get('publisher-change-title').textContent.includes('7'));
    assert.ok(ui.get('publisher-change-close').attributes['aria-label']);
  }
});
test('notices expire at seven days, ignore future dates and escape source text', () => {
  const ui = view();
  ui.run("renderPublisherNotices(Date.parse('2026-09-20T00:00:00Z'))");
  assert.equal(ui.get('publisher-change-banner').hidden, true);
  ui.run("renderPublisherNotices(Date.parse('2026-09-12T00:00:00Z'))");
  assert.equal(ui.get('publisher-change-banner').hidden, true);
  ui.context.fixture.items = [{ ...notice, designation: '<script>attack</script>' }];
  ui.run("renderPublisherNotices(Date.parse('2026-09-14T00:00:00Z'))");
  assert.ok(!ui.get('publisher-change-list').innerHTML.includes('<script>'));
});
test('dismissal suppresses existing events, but a new change is visible', () => {
  const ui = view();
  ui.run("dismissedPublisherChange=1; renderPublisherNotices(Date.parse('2026-09-14T00:00:00Z'))");
  assert.equal(ui.get('publisher-change-banner').hidden, true);
  ui.context.fixture.items.push({ ...notice, id: 2 });
  ui.run("renderPublisherNotices(Date.parse('2026-09-14T00:00:00Z'))");
  assert.equal(ui.get('publisher-change-banner').hidden, false);
});

test('lifecycle notices show withdrawal and replacement states without losing legacy edition notices', () => {
  for (const lang of ['ja','en']) {
    const ui=view(lang);
    for(const status of ['known','none','unknown']) {
      ui.context.fixture.items=[notice,{...notice,id:2,before:[],after:[],before_state:{status:'unknown',published:[]},
        after_state:{status:'withdrawn',published:[],replacement_status:status,replacements:status==='known'?[{reference:'EN 55032',cited_edition:'2012',relation:'partial',note:'<script>coverage</script>'}]:[]}}];
      ui.run("renderPublisherNotices(Date.parse('2026-09-14T00:00:00Z'))");
      const content=ui.get('publisher-change-list').innerHTML;
      assert.ok(content.includes(lang==='ja'?'廃止':'Withdrawn'));
      assert.ok(content.includes('2020 → 2024'));
      assert.ok(!content.includes('<script>'));
      if(status==='known') for(const text of ['EN 55032','2012','&lt;script&gt;']) assert.ok(content.includes(text));
    }
  }
});
