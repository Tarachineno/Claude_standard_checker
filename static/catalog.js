// Publisher catalogue and two-axis edition comparison.
let catalogData = null;
let catalogAuth = null;
const catalogueTranslations = {
    en: {
        title: 'Published edition catalogue', intro: 'Publisher editions are checked independently of OJ listings. Last verification dates are shown; elapsed time alone does not invalidate results.',
        load: 'Load catalogue', provider: 'Publisher', search: 'Search references', reference: 'Reference', edition: 'Published edition',
        checked: 'Last verified / source', last_checked: 'Last verified', date_unknown: 'Unknown', actions: 'Actions', admin: 'Manual verification / correction', admin_help: 'Saving requires an administration key. The key is kept only in this page; it is not saved to browser storage.',
        token: 'Administration key', edition_input: 'One edition including amendments / corrigenda', publication_status: 'Publication status',
        email_login: 'Sign in with @sgs.com', email_logout: 'Sign out', email_help: 'Verify your @sgs.com mailbox with a one-time code. Editing identity is recorded privately; no shared administration key is sent.', needs_login: 'Sign in with your @sgs.com email before saving.',
        date: 'Publication date (optional)', url: 'Official source URL', note: 'Verification note', save: 'Save verified edition', help: 'Catalogue setup and verification guide',
        directive: 'OJ directive', basis: 'Summary / filter basis', published_basis: 'Latest Published', oj_basis: 'Active OJ',
        unverified: 'Unverified', manual: 'Manually verified', automatic: 'Automatic', supplement: 'Verify / edit', source: 'Official source',
        saved: 'Verified edition saved. Rerun the bulk check to update results.', unavailable: 'Catalogue unavailable. See setup guide.', missing: 'Not yet verified',
        needs_key: 'Enter the administration key in the manual verification section.',
        count: '{shown} / {total} references', guidance: 'Edition coverage only. OJ presumption, publisher status and accreditation conditions are distinct.',
        cache: 'OJ data includes cached / bundled information; check the source dates before relying on it.', history: 'History', clear: 'Use automatic data', cleared: 'Manual override removed; history is retained.'
    },
    ja: {
        title: 'Published版の管理', intro: 'OJ掲載とは別に、発行団体の最新版を確認します。最終確認日時を表示し、日数の経過だけでは判定を変更しません。',
        load: '版情報を表示', provider: '発行団体', search: '規格番号で絞り込み', reference: '規格', edition: 'Published版',
        checked: '最終確認日時・出典', last_checked: '最終確認日時', date_unknown: '不明', actions: '操作', admin: '版情報の確認・補完', admin_help: '保存には管理キーが必要です。キーはこのページ内だけで使用し、ブラウザーには保存しません。',
        token: '管理キー', edition_input: '最新版（追補・正誤票を含む1版）', publication_status: '発行状態',
        email_login: '@sgs.comでログイン', email_logout: 'ログアウト', email_help: '@sgs.comへの一度限りのコードで本人確認します。編集者は非公開の操作記録に残ります。共有の管理キーは配布しません。', needs_login: '保存する前に@sgs.comのメールでログインしてください。',
        date: '発行日（任意）', url: '公式の根拠URL', note: '確認根拠・メモ', save: '確認した版を保存', help: '版情報の取得・補完ヘルプ',
        directive: 'OJの対象指令', basis: '集計・絞り込み基準', published_basis: '最新Published版', oj_basis: '有効なOJ掲載版',
        unverified: '未確認', manual: '手動確認済み', automatic: '自動取得', supplement: '確認・補完', source: '公式出典',
        saved: '確認した版を保存しました。一括確認を再実行すると結果に反映されます。', unavailable: '版情報の台帳を利用できません。ヘルプの初期設定を確認してください。', missing: '未取得・未確認',
        needs_key: '「版情報の確認・補完」に管理キーを入力してください。',
        count: '{shown} / {total} 規格', guidance: '版数の対応状況です。OJによる適合推定・発行状態・認定条件は別に確認してください。',
        cache: 'OJ情報にキャッシュ・同梱データを含みます。出典の確認日時に注意してください。', history: '確認履歴', clear: '自動取得に戻す', cleared: '手動補完を解除しました。履歴は保持しています。'
    }
};
const extraReasons = {
    en: {
        amendments_missing: 'Base edition matches; required amendments / corrigenda are not fully listed in the scope.',
        reference_unknown: 'Reference could not be identified. Review the original scope.',
        catalog_missing: 'Publisher edition has not been verified.', published_missing: 'No current Published edition confirmed.',
        fetch_failed: 'Source update failed. The previous value is shown for reference.', verification_date_invalid: 'The last verification date is missing or invalid.',
        reference_changed: 'Publisher lists a different designation. Confirm the successor / adoption relationship.',
        version_match: 'The accreditation scope includes the target edition.',
        scope_version_old: 'The accreditation scope only lists older editions.',
        scope_version_newer: 'The scope edition is newer than the target; confirm applicability.',
        scope_version_missing: 'No edition in the accreditation scope. Confirm the conditions for applying the latest edition.'
    },
    ja: {
        amendments_missing: '本体版は一致していますが、追補・正誤票の包含を確認できません。',
        reference_unknown: '規格を特定できません。認定スコープの原文を確認してください。',
        catalog_missing: '発行団体の版数を未確認です。', published_missing: '現行のPublished版を確認できません。',
        fetch_failed: '更新確認に失敗しました。前回値は参考表示です。', verification_date_invalid: '最終確認日時が未記録、または不正です。',
        reference_changed: '発行団体の規格名が変わっています。後継・採用関係を確認してください。',
        version_match: '認定スコープに対象版が含まれています。',
        scope_version_old: '認定スコープは対象版より古い版のみです。',
        scope_version_newer: '認定スコープが対象版より新しいため、適用関係を確認してください。',
        scope_version_missing: '認定スコープに版数の記載がありません。最新版を適用する条件の確認が必要です。'
    }
};
for (const lang of ['en', 'ja']) {
    for (const [key, value] of Object.entries(catalogueTranslations[lang])) translations[lang]['catalog.' + key] = value;
    for (const [key, value] of Object.entries(extraReasons[lang])) translations[lang]['scope_oj.reason_' + key] = value;
}
translations.ja['catalog.manual_required'] = '自動取得未対応・手動確認対象';
translations.en['catalog.manual_required'] = 'Manual verification required; no automatic adapter';
translations.ja['catalog.review'] = '定期調査で確認';
translations.en['catalog.review'] = 'Verified by scheduled review';
const lifecycleTranslations = {
    ja: { confirmation: '版情報なし', withdrawn: '廃止', partial_withdrawal: '一部廃止', withdrawal_date: '廃止日', replacement: '後継規格',
        replacement_full: '全面置換', replacement_partial: '部分置換', replacement_cited: '置換関係の記載版',
        successor_latest: '後継の現行Published版', successor_unknown: '後継の最新版は未確認', successor_withdrawn: 'この後継規格も廃止',
        relationship_source: '置換関係の公式出典', lifecycle_managed: '廃止・後継情報は巡回手順で更新',
        review_failed: '直近の確認は失敗／競合。確認済み情報を保持しています。',
        withdrawal_scope_note: '発行団体側の廃止です。認定取消し・OJ掲載終了・後継規格の認定を意味しません。',
        publisher_withdrawn_known: '規格の廃止と後継関係を確認済みです。', publisher_withdrawn_none: '規格は廃止。後継規格なしと確認済みです。',
        publisher_withdrawn_unknown: '規格の廃止は確認済み。後継規格は未確認です。' },
    en: { confirmation: 'No scope edition', withdrawn: 'Withdrawn', partial_withdrawal: 'Partly withdrawn', withdrawal_date: 'Withdrawal date', replacement: 'Successor',
        replacement_full: 'Full replacement', replacement_partial: 'Partial replacement', replacement_cited: 'Edition cited in replacement relationship',
        successor_latest: 'Successor current Published edition', successor_unknown: 'Successor latest edition not verified', successor_withdrawn: 'This successor is also withdrawn',
        relationship_source: 'Official replacement evidence', lifecycle_managed: 'Update lifecycle through the review workflow',
        review_failed: 'Latest check failed or conflicted; previously verified information is retained.',
        withdrawal_scope_note: 'Publisher withdrawal is not accreditation revocation, OJ withdrawal, or accreditation of the successor.',
        publisher_withdrawn_known: 'Reference withdrawal and replacement relationship verified.', publisher_withdrawn_none: 'Withdrawn; no successor confirmed.',
        publisher_withdrawn_unknown: 'Withdrawal verified; successor not yet verified.' },
};
for (const [lang, labels] of Object.entries(lifecycleTranslations)) for (const [key, value] of Object.entries(labels)) {
    translations[lang][key.startsWith('publisher_withdrawn_') ? 'scope_oj.reason_' + key : 'catalog.' + key] = value;
}
Object.assign(translations.ja, { 'scope_oj.check_btn': '認定スコープの版数を一括確認', 'scope_oj.description': '全認定スコープをOJ掲載版・最新Published版と照合します。EMCはPublished、REDはOJを初期の集計基準にします。', 'scope_oj.title': '認定スコープ・OJ・Published版の比較' });
Object.assign(translations.en, { 'scope_oj.check_btn': 'Check all scope editions', 'scope_oj.description': 'Compare all scopes with OJ and current Published editions. EMC defaults to Published; RED defaults to OJ.', 'scope_oj.title': 'Accreditation / OJ / Published edition comparison' });

const catalogueElement = id => document.getElementById(id);
const editionText = edition => [edition.base, ...(edition.amendments || []), ...(edition.corrections || [])].join('+');
const statusText = status => ['unverified', 'withdrawn', 'confirmation'].includes(status) ? t('catalog.' + status) : scopeOjStatusLabel(status);
const statusBadge = status => '<span class="scope-oj-status scope-oj-status-' + esc(status) + '">' + esc(statusText(status)) + '</span>';
const verificationText = record => {
    const timestamp = Date.parse(record?.checked_at);
    const date = Number.isFinite(timestamp) ? new Date(timestamp).toLocaleString() : t('catalog.date_unknown');
    return t('catalog.last_checked') + ': ' + date;
};
const safeSourceLink = (url, label) => {
    try {
        const u = new URL(url);
        if (u.protocol !== 'https:' || u.username || u.password) return '';
        return '<a href="' + esc(u.href) + '" target="_blank" rel="noopener noreferrer">' + esc(label) + '</a>';
    } catch { return ''; }
};
const reviewFailureText = record => {
    const review = record?.latest_review;
    return review && ['unverified', 'conflict'].includes(review.outcome) && Date.parse(review.completed_at) >= Date.parse(record.checked_at)
        ? '<small class="catalog-error">' + esc(t('catalog.review_failed')) + ' ' + esc(review.reason) + ' (' + esc(new Date(review.completed_at).toLocaleString()) + ')</small>'
        : record?.error ? '<small class="catalog-error">' + esc(t('catalog.review_failed')) + ' ' + esc(record.error) + '</small>' : '';
};
function withdrawalDetails(lifecycle, replacements = []) {
    if (lifecycle?.status !== 'withdrawn') return '';
    return '<small>' + esc(t('catalog.withdrawal_date')) + ': ' + esc(lifecycle.withdrawal_date || t('catalog.date_unknown')) + '</small>'
        + replacements.map(replacement => {
            const successor = replacement.published;
            const latest = successor?.latest;
            const edition = successor?.status === 'withdrawn' ? esc(t('catalog.successor_withdrawn'))
                : latest && successor.status !== 'unverified' && !latest.reference_changed
                    ? esc(t('catalog.successor_latest')) + ': ' + esc(latest.designation) + ' · ' + esc(verificationText(successor.record))
                    : esc(t('catalog.successor_unknown'));
            return '<div class="publisher-replacement"><strong>' + esc(t('catalog.replacement')) + ': ' + esc(replacement.reference) + '</strong>'
                + '<small>' + esc(t('catalog.replacement_' + replacement.relation)) + ' — ' + esc(replacement.note) + '</small>'
                + (replacement.cited_edition ? '<small>' + esc(t('catalog.replacement_cited')) + ': ' + esc(replacement.cited_edition) + '</small>' : '')
                + '<small>' + edition + '</small>' + safeSourceLink(replacement.source_url, t('catalog.relationship_source'))
                + (latest ? safeSourceLink(latest.source_url, t('catalog.source')) : '') + '</div>';
        }).join('') + '<small class="muted">' + esc(t('catalog.withdrawal_scope_note')) + '</small>';
}
function renderEditionComparison(data) {
    const basis = catalogueElement('scope-oj-basis').value;
    const { accreditation, facility } = updateScopeFilters(data.items);
    const withdrawnOption = catalogueElement('scope-oj-filter-withdrawn');
    withdrawnOption.hidden = basis !== 'published';
    withdrawnOption.disabled = basis !== 'published';
    if (basis !== 'published' && catalogueElement('scope-oj-status-filter').value === 'withdrawn') catalogueElement('scope-oj-status-filter').value = 'all';
    const filter = catalogueElement('scope-oj-status-filter').value;
    const query = catalogueElement('scope-oj-search').value.trim().toLowerCase();
    const selected = item => basis === 'published' ? item.published : item;
    const matching = data.items.filter(item => (accreditation === 'all' || scopeAccreditationKey(item) === accreditation)
        && (facility === 'all' || scopeFacilityKey(item) === facility)
        && (!query || [item.cert_type, item.certificate_number, item.facility_number, item.facility_name, item.facility_location, item.category, item.standard, item.description,
            ...(item.references || []).flatMap(r => [r.published?.latest?.designation, ...(r.published?.replacements || []).flatMap(s => [s.reference, s.published?.latest?.designation])])].join(' ').toLowerCase().includes(query)));
    const items = matching.filter(item => filter === 'all' || selected(item).status === filter);
    const statuses = ['valid', 'warning', 'caution', 'confirmation', 'not_listed', 'unverified', ...(basis === 'published' ? ['withdrawn'] : [])];
    const summary = Object.fromEntries(statuses.map(status => [status, matching.filter(item => selected(item).status === status).length]));
    catalogueElement('scope-oj-summary').innerHTML = statuses.map(s =>
        '<button type="button" class="scope-oj-summary-card scope-oj-summary-' + s + '" data-scope-status="' + s + '" aria-pressed="' + (filter === s) + '"><span>' + esc(statusText(s)) + '</span><strong>' + (summary?.[s] || 0) + '</strong></button>').join('');
    catalogueElement('scope-oj-result-count').textContent = t('scope_oj.result_count', { shown: items.length, total: data.items.length });
    const sources = Object.entries(data.sources.oj || {}).map(([d, s]) => d + ': ' + (s.last_checked ? new Date(s.last_checked).toLocaleString() : s.source || 'error')).join(' · ');
    const stale = Object.values(data.sources.oj || {}).some(s => ['kv-stale', 'bundled', 'fallback'].includes(s.source) || s.error);
    catalogueElement('scope-oj-sources').textContent = t('catalog.guidance') + ' OJ: ' + sources + (stale ? ' ' + t('catalog.cache') : '') + (!data.sources.catalog?.available ? ' ' + t('catalog.unavailable') : '');
    catalogueElement('scope-oj-tbody').innerHTML = items.map(item => {
        const refs = item.references || [];
        const oj = refs.map(ref => '<div class="edition-reference"><strong>' + esc(ref.designation) + '</strong>' + ref.oj.checks.map(check =>
            '<div><span class="scope-oj-directive">' + esc(check.directive) + '</span> ' + statusBadge(check.status) +
            '<small>' + esc((check.oj_numbers || []).join(' / ') || scopeOjReasonLabel(check.reason)) + '</small></div>').join('') + '</div>').join('');
        const published = refs.map(ref => {
            const p = ref.published;
            return '<div class="edition-reference"><strong>' + esc(p.latest?.designation || ref.designation) + '</strong> ' + statusBadge(p.status) +
                '<small>' + esc(scopeOjReasonLabel(p.reason)) + '</small>' +
                withdrawalDetails(p.lifecycle, p.replacements) +
                '<small>' + esc(verificationText(p.record)) + (p.record?.origin ? ' · ' + esc(t('catalog.' + p.record.origin)) : '') + '</small>' +
                reviewFailureText(p.record) +
                safeSourceLink(p.latest?.source_url || p.record?.source_url, t('catalog.source')) + '</div>';
        }).join('') + (item.published?.partial_withdrawal ? '<small class="scope-oj-partial">' + esc(t('catalog.partial_withdrawal')) + '</small>' : '');
        const detail = item.anchor ? '<br><button type="button" class="btn-link" data-scope-detail-cert="' + esc(item.cert_type) + '" data-scope-detail-anchor="' + esc(item.anchor) + '">' + esc(t('quick.detail_link')) + '</button>' : '';
        return '<tr><td>' + esc(item.cert_type.toUpperCase()) + '<small>' + esc(item.certificate_number || '') + '</small></td><td>' +
            esc(scopeFacilityLabel(item)) + '<small>' + esc(item.category || '') + '</small></td><td><strong>' + esc(item.standard) +
            '</strong>' + detail + '</td><td>' + (oj || esc(t('catalog.unverified'))) + '</td><td>' + (published || esc(t('catalog.unverified'))) +
            '</td></tr>';
    }).join('') || '<tr><td colspan="5" class="scope-oj-empty">' + esc(t('scope_oj.no_results')) + '</td></tr>';
    catalogueElement('scope-oj-check-results').classList.remove('hidden');
}

const scopeAccreditationKey = item => JSON.stringify([item.cert_type, item.certificate_number || '']);
const scopeFacilityKey = item => JSON.stringify([scopeAccreditationKey(item), String(item.facility_number ?? ''), item.facility_name || '', item.facility_location || '']);
const scopeFacilityLabel = item => [
    item.facility_number != null ? t('scope_oj.facility_number', { number: item.facility_number }) : '',
    item.facility_name || item.facility_location,
].filter(Boolean).join(' · ') || t('scope_oj.facility_unspecified');

function updateScopeFilters(items) {
    const accreditationLabel = item => [item.cert_type.toUpperCase(), item.certificate_number].filter(Boolean).join(' · ');
    const setOptions = (id, entries, allLabel) => {
        const select = catalogueElement(id);
        const previous = select.value;
        select.innerHTML = '<option value="all">' + esc(t(allLabel)) + '</option>' + [...entries].map(([key, label]) =>
            '<option value="' + esc(key) + '">' + esc(label) + '</option>').join('');
        select.value = entries.has(previous) ? previous : 'all';
        return select.value;
    };
    const accreditations = new Map(items.map(item => [scopeAccreditationKey(item), accreditationLabel(item)]));
    const accreditation = setOptions('scope-oj-accreditation', accreditations, 'scope_oj.all_accreditations');
    const facilities = new Map(items.filter(item => accreditation === 'all' || scopeAccreditationKey(item) === accreditation)
        .map(item => [scopeFacilityKey(item), (accreditation === 'all' ? accreditationLabel(item) + ' · ' : '') + scopeFacilityLabel(item)]));
    const facility = setOptions('scope-oj-facility', facilities, 'scope_oj.all_facilities');
    return { accreditation, facility };
}

async function loadPublisherCatalog() {
    const button = catalogueElement('catalog-load-btn');
    button.disabled = true;
    try {
        catalogData = (await apiCall('/catalog')).data;
        renderCatalog();
    } catch (error) { showError(error.message); }
    finally { button.disabled = false; }
}
function renderCatalog() {
    if (!catalogData) return;
    const provider = catalogueElement('catalog-provider').value;
    const query = catalogueElement('catalog-search').value.toLowerCase().trim();
    const items = catalogData.items.filter(r => (provider === 'all' || r.provider === provider) && (!query || [r.designation, ...(r.record?.lifecycle?.replacements || []).map(s => s.reference)].join(' ').toLowerCase().includes(query)));
    catalogueElement('catalog-message').textContent = t('catalog.count', { shown: items.length, total: catalogData.items.length }) + (catalogData.available ? '' : ' · ' + t('catalog.unavailable'));
    catalogueElement('catalog-tbody').innerHTML = items.map(ref => {
        const record = ref.record;
        const error = record?.error;
        const withdrawn = record?.review_schema_version === 2 && record.lifecycle?.status === 'withdrawn';
        const edition = (record?.editions || []).map(e => esc(e.designation) + ' <small>' + esc(e.status) + '</small>').join('<br>');
        const providerLabel = { semi: 'SEMI', as_nzs: 'Standards Australia / Standards New Zealand (AS/NZS)' }[ref.provider] || ref.provider.toUpperCase();
        return '<tr><td><strong>' + esc(ref.designation) + '</strong><small>' + esc(providerLabel) + ' · ' + ref.scope_count + '</small></td><td>' +
            (withdrawn ? statusBadge('withdrawn') + '<small>' + esc(t('scope_oj.reason_publisher_withdrawn_' + record.lifecycle.replacement_status)) + '</small>'
                + withdrawalDetails(record.lifecycle, record.replacement_checks || record.lifecycle.replacements) : edition || esc(t('catalog.missing')))
            + (!ref.automatic_supported ? '<small>' + esc(t('catalog.manual_required')) + '</small>' : '') + (error ? '<small class="catalog-error">' + esc(error) + '</small>' : '') + reviewFailureText(record) +
            '</td><td>' + esc(verificationText(record)) + (record?.origin ? '<small>' + esc(t('catalog.' + record.origin)) + '</small>' : '') +
            safeSourceLink(record?.editions?.at(-1)?.source_url || record?.source_url || ref.search_url, t('catalog.source')) + '</td><td class="catalog-row-actions">' +
            (withdrawn ? '<small>' + esc(t('catalog.lifecycle_managed')) + '</small>' : '<button class="btn btn-small btn-outline" data-catalog-edit="' + esc(ref.key) + '">' + esc(t('catalog.supplement')) + '</button> ') +
            (record ? '<button class="btn btn-small btn-outline" data-catalog-history="' + esc(ref.key) + '">' + esc(t('catalog.history')) + '</button>' : '') +
            (record?.origin === 'manual' && !withdrawn ? '<button class="btn btn-small btn-outline" data-catalog-clear="' + esc(ref.key) + '">' + esc(t('catalog.clear')) + '</button>' : '') +
            '</td></tr>';
    }).join('');
}
async function catalogWrite(path, body) {
    const auth = await loadCatalogAuth();
    if (auth.mode === 'access') {
        if (!auth.user) {
            catalogueElement('catalog-admin').open = true;
            throw new Error(t('catalog.needs_login'));
        }
        return apiCall('/catalog/' + path, { method:'POST', credentials:'same-origin', headers:{'Content-Type':'application/json'}, body:JSON.stringify(body) });
    }
    if (auth.mode !== 'token') throw new Error('Authentication is unavailable');
    const token = catalogueElement('catalog-token').value.trim();
    if (!token) {
        catalogueElement('catalog-admin').open = true;
        catalogueElement('catalog-token').focus();
        throw new Error(t('catalog.needs_key'));
    }
    return apiCall('/catalog/' + path, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token }, body: JSON.stringify(body) });
}
async function loadCatalogAuth() {
    catalogAuth = (await apiCall('/catalog/auth', {credentials:'same-origin',cache:'no-store'})).data;
    const access = catalogAuth.mode === 'access';
    catalogueElement('catalog-token-fields').hidden = access;
    if (access) catalogueElement('catalog-token').value = '';
    const help = catalogueElement('catalog-auth-help');
    help.setAttribute('data-i18n', access ? 'catalog.email_help' : 'catalog.admin_help');
    help.textContent = t(access ? 'catalog.email_help' : 'catalog.admin_help');
    catalogueElement('catalog-auth-user').textContent = catalogAuth.user?.email || '';
    for (const name of ['login','logout']) {
        const link = catalogueElement('catalog-' + name);
        link.hidden = !access || (name === 'login' ? !!catalogAuth.user : !catalogAuth.user);
        const url = catalogAuth[name + '_url'];
        if (url?.startsWith('https://lab-scope-checker.seidaku.com/')) link.href = url;
    }
    return catalogAuth;
}
document.addEventListener('DOMContentLoaded', () => {
    loadCatalogAuth().catch(error => { catalogueElement('catalog-auth-user').textContent = error.message; });
    if (new URLSearchParams(window.location.search).get('catalog-login') === '1') {
        switchTab('search');
        catalogueElement('catalog-admin').open = true;
        loadPublisherCatalog();
    }
    catalogueElement('catalog-load-btn').addEventListener('click', loadPublisherCatalog);
    catalogueElement('catalog-provider').addEventListener('change', renderCatalog);
    catalogueElement('catalog-search').addEventListener('input', renderCatalog);
    catalogueElement('scope-oj-basis').addEventListener('change', () => scopeOjCheckData && renderEditionComparison(scopeOjCheckData));
    catalogueElement('scope-oj-directive').addEventListener('change', () => {
        catalogueElement('scope-oj-basis').value = catalogueElement('scope-oj-directive').value === 'EMC' ? 'published' : 'oj';
        if (scopeOjCheckData) runScopeOjVersionCheck();
    });
    catalogueElement('catalog-tbody').addEventListener('click', async event => {
        const button = event.target.closest('button');
        if (!button || !catalogData) return;
        if (button.dataset.catalogClear) {
            try { await catalogWrite('clear-manual', { key: button.dataset.catalogClear }); await loadPublisherCatalog(); showSuccess(t('catalog.cleared')); }
            catch (error) { showError(error.message); }
            return;
        }
        if (button.dataset.catalogHistory) {
            try {
                const history = (await apiCall('/catalog/history?key=' + encodeURIComponent(button.dataset.catalogHistory))).data;
                catalogueElement('scope-detail-title').textContent = t('catalog.history') + ' · ' + button.dataset.catalogHistory;
                catalogueElement('scope-detail-body').innerHTML = history.map(h => '<p>' + esc(h.recorded_at) + ' · ' + esc(h.payload_json.verification_method === 'scheduled_review' ? t('catalog.review') : h.origin) + '<br>' +
                    esc((h.payload_json.editions || []).map(e => e.designation).join(' / ')) + '<br>' + esc(h.payload_json.note || '')
                    + (h.payload_json.lifecycle?.status === 'withdrawn' ? statusBadge('withdrawn') + withdrawalDetails(h.payload_json.lifecycle, h.payload_json.lifecycle.replacements) : '') + '</p>').join('');
                catalogueElement('scope-detail-modal').classList.remove('hidden');
            } catch (error) { showError(error.message); }
            return;
        }
        const ref = catalogData.items.find(r => r.key === button.dataset.catalogEdit);
        if (!ref) return;
        catalogueElement('catalog-admin').open = true;
        catalogueElement('catalog-reference').value = ref.designation;
        const latest = ref.record?.editions?.at(-1);
        catalogueElement('catalog-edition').value = latest ? editionText(latest.edition) : '';
        catalogueElement('catalog-status').value = latest?.status || 'published';
        catalogueElement('catalog-date').value = latest?.publication_date || '';
        catalogueElement('catalog-url').value = latest?.source_url || ref.record?.source_url || '';
        catalogueElement('catalog-note').value = ref.record?.note || '';
        catalogueElement('catalog-reference').scrollIntoView({ block: 'center' });
    });
    catalogueElement('catalog-manual-form').addEventListener('submit', async event => {
        event.preventDefault();
        const button = event.submitter || event.currentTarget.querySelector('button[type="submit"]');
        button.disabled = true;
        try {
            await catalogWrite('manual', { reference: catalogueElement('catalog-reference').value.trim(), edition: catalogueElement('catalog-edition').value.trim(),
                status: catalogueElement('catalog-status').value, publication_date: catalogueElement('catalog-date').value || null,
                source_url: catalogueElement('catalog-url').value.trim(), note: catalogueElement('catalog-note').value.trim() });
            await loadPublisherCatalog();
            showSuccess(t('catalog.saved'));
        } catch (error) { showError(error.message); }
        finally { button.disabled = false; }
    });
});
