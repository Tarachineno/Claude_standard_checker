// Publisher catalogue and two-axis edition comparison.
let catalogData = null;
const catalogueTranslations = {
    en: {
        title: 'Published edition catalogue', intro: 'Publisher editions are checked independently of OJ listings. Last verification dates are shown; elapsed time alone does not invalidate results.',
        load: 'Load catalogue', provider: 'Publisher', search: 'Search references', reference: 'Reference', edition: 'Published edition',
        checked: 'Last verified / source', last_checked: 'Last verified', date_unknown: 'Unknown', actions: 'Actions', admin: 'Refresh / manually verify editions', admin_help: 'Saving requires an administration key. The key is kept only in this page; it is not saved to browser storage.',
        token: 'Administration key', refresh_batch: 'Refresh next 3 references', edition_input: 'One edition including amendments / corrigenda', publication_status: 'Publication status',
        date: 'Publication date (optional)', url: 'Official source URL', note: 'Verification note', save: 'Save verified edition', help: 'Catalogue setup and verification guide',
        directive: 'OJ directive', basis: 'Summary / filter basis', published_basis: 'Latest Published', oj_basis: 'Active OJ',
        unverified: 'Unverified', manual: 'Manually verified', automatic: 'Automatic', supplement: 'Verify / edit', refresh: 'Refresh', source: 'Official source',
        saved: 'Verified edition saved. Rerun the bulk check to update results.', unavailable: 'Catalogue unavailable. See setup guide.', missing: 'Not yet verified',
        needs_key: 'Enter the administration key in the refresh / verification section.', refreshed: 'Processed {count} references. Failed checks retain the previous result.',
        count: '{shown} / {total} references', guidance: 'Edition coverage only. OJ presumption, publisher status and accreditation conditions are distinct.',
        cache: 'OJ data includes cached / bundled information; check the source dates before relying on it.', history: 'History', clear: 'Use automatic data', cleared: 'Manual override removed; history is retained.'
    },
    ja: {
        title: 'Published版の管理', intro: 'OJ掲載とは別に、発行団体の最新版を確認します。最終確認日時を表示し、日数の経過だけでは判定を変更しません。',
        load: '版情報を表示', provider: '発行団体', search: '規格番号で絞り込み', reference: '規格', edition: 'Published版',
        checked: '最終確認日時・出典', last_checked: '最終確認日時', date_unknown: '不明', actions: '操作', admin: '公式情報の再取得・手動補完', admin_help: '保存には管理キーが必要です。キーはこのページ内だけで使用し、ブラウザーには保存しません。',
        token: '管理キー', refresh_batch: '未更新の3規格を取得', edition_input: '最新版（追補・正誤票を含む1版）', publication_status: '発行状態',
        date: '発行日（任意）', url: '公式の根拠URL', note: '確認根拠・メモ', save: '確認した版を保存', help: '版情報の取得・補完ヘルプ',
        directive: 'OJの対象指令', basis: '集計・絞り込み基準', published_basis: '最新Published版', oj_basis: '有効なOJ掲載版',
        unverified: '未確認', manual: '手動確認済み', automatic: '自動取得', supplement: '確認・補完', refresh: '再取得', source: '公式出典',
        saved: '確認した版を保存しました。一括確認を再実行すると結果に反映されます。', unavailable: '版情報の台帳を利用できません。ヘルプの初期設定を確認してください。', missing: '未取得・未確認',
        needs_key: '「公式情報の再取得・手動補完」に管理キーを入力してください。', refreshed: '{count}規格を処理しました。取得失敗時は前回の情報を保持します。',
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
Object.assign(translations.ja, { 'scope_oj.check_btn': '認定スコープの版数を一括確認', 'scope_oj.description': '全認定スコープをOJ掲載版・最新Published版と照合します。EMCはPublished、REDはOJを初期の集計基準にします。', 'scope_oj.title': '認定スコープ・OJ・Published版の比較' });
Object.assign(translations.en, { 'scope_oj.check_btn': 'Check all scope editions', 'scope_oj.description': 'Compare all scopes with OJ and current Published editions. EMC defaults to Published; RED defaults to OJ.', 'scope_oj.title': 'Accreditation / OJ / Published edition comparison' });

const catalogueElement = id => document.getElementById(id);
const editionText = edition => [edition.base, ...(edition.amendments || []), ...(edition.corrections || [])].join('+');
const statusText = status => status === 'unverified' ? t('catalog.unverified') : scopeOjStatusLabel(status);
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
function renderEditionComparison(data) {
    const basis = catalogueElement('scope-oj-basis').value;
    const { accreditation, facility } = updateScopeFilters(data.items);
    const filter = catalogueElement('scope-oj-status-filter').value;
    const query = catalogueElement('scope-oj-search').value.trim().toLowerCase();
    const selected = item => basis === 'published' ? item.published : item;
    const matching = data.items.filter(item => (accreditation === 'all' || scopeAccreditationKey(item) === accreditation)
        && (facility === 'all' || scopeFacilityKey(item) === facility)
        && (!query || [item.cert_type, item.certificate_number, item.facility_number, item.facility_name, item.facility_location, item.category, item.standard, item.description, ...(item.references || []).map(r => r.published?.latest?.designation)].join(' ').toLowerCase().includes(query)));
    const items = matching.filter(item => filter === 'all' || selected(item).status === filter);
    const statuses = ['valid', 'warning', 'caution', 'not_listed', 'unverified'];
    const summary = Object.fromEntries(statuses.map(status => [status, matching.filter(item => selected(item).status === status).length]));
    catalogueElement('scope-oj-summary').innerHTML = ['valid', 'warning', 'caution', 'not_listed', 'unverified'].map(s =>
        '<div class="scope-oj-summary-card scope-oj-summary-' + s + '"><span>' + esc(statusText(s)) + '</span><strong>' + (summary?.[s] || 0) + '</strong></div>').join('');
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
                '<small>' + esc(verificationText(p.record)) + (p.record?.origin ? ' · ' + esc(t('catalog.' + p.record.origin)) : '') + '</small>' +
                safeSourceLink(p.latest?.source_url || p.record?.source_url, t('catalog.source')) + '</div>';
        }).join('');
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
    const items = catalogData.items.filter(r => (provider === 'all' || r.provider === provider) && (!query || r.designation.toLowerCase().includes(query)));
    catalogueElement('catalog-message').textContent = t('catalog.count', { shown: items.length, total: catalogData.items.length }) + (catalogData.available ? '' : ' · ' + t('catalog.unavailable'));
    catalogueElement('catalog-tbody').innerHTML = items.map(ref => {
        const record = ref.record;
        const error = record?.error;
        const edition = (record?.editions || []).map(e => esc(e.designation) + ' <small>' + esc(e.status) + '</small>').join('<br>');
        return '<tr><td><strong>' + esc(ref.designation) + '</strong><small>' + esc(ref.provider.toUpperCase()) + ' · ' + ref.scope_count + '</small></td><td>' +
            (edition || esc(t('catalog.missing'))) + (!ref.automatic_supported ? '<small>' + esc(t('catalog.manual_required')) + '</small>' : '') + (error ? '<small class="catalog-error">' + esc(error) + '</small>' : '') +
            '</td><td>' + esc(verificationText(record)) + (record?.origin ? '<small>' + esc(t('catalog.' + record.origin)) + '</small>' : '') +
            safeSourceLink(record?.editions?.at(-1)?.source_url || record?.source_url || ref.search_url, t('catalog.source')) + '</td><td class="catalog-row-actions">' +
            '<button class="btn btn-small btn-outline" data-catalog-edit="' + esc(ref.key) + '">' + esc(t('catalog.supplement')) + '</button> ' +
            (ref.automatic_supported ? '<button class="btn btn-small btn-outline" data-catalog-refresh="' + esc(ref.key) + '">' + esc(t('catalog.refresh')) + '</button> ' : '') +
            (record ? '<button class="btn btn-small btn-outline" data-catalog-history="' + esc(ref.key) + '">' + esc(t('catalog.history')) + '</button>' : '') +
            (record?.origin === 'manual' ? '<button class="btn btn-small btn-outline" data-catalog-clear="' + esc(ref.key) + '">' + esc(t('catalog.clear')) + '</button>' : '') +
            '</td></tr>';
    }).join('');
}
async function catalogWrite(path, body) {
    const token = catalogueElement('catalog-token').value.trim();
    if (!token) {
        catalogueElement('catalog-admin').open = true;
        catalogueElement('catalog-token').focus();
        throw new Error(t('catalog.needs_key'));
    }
    return apiCall('/catalog/' + path, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token }, body: JSON.stringify(body) });
}
async function refreshPublisher(keys) {
    try {
        const response = await catalogWrite('refresh', keys ? { keys, force: true } : {});
        await loadPublisherCatalog();
        catalogueElement('catalog-message').textContent = t('catalog.refreshed', { count: response.data.processed || 0 }) + ' ' + (response.data.results || []).filter(r => !r.success).map(r => r.key + ': ' + r.error).join(' · ');
    } catch (error) { showError(error.message); }
}
document.addEventListener('DOMContentLoaded', () => {
    catalogueElement('catalog-load-btn').addEventListener('click', loadPublisherCatalog);
    catalogueElement('catalog-provider').addEventListener('change', renderCatalog);
    catalogueElement('catalog-search').addEventListener('input', renderCatalog);
    catalogueElement('scope-oj-basis').addEventListener('change', () => scopeOjCheckData && renderEditionComparison(scopeOjCheckData));
    catalogueElement('scope-oj-directive').addEventListener('change', () => {
        catalogueElement('scope-oj-basis').value = catalogueElement('scope-oj-directive').value === 'EMC' ? 'published' : 'oj';
        if (scopeOjCheckData) runScopeOjVersionCheck();
    });
    catalogueElement('catalog-refresh-btn').addEventListener('click', () => refreshPublisher());
    catalogueElement('catalog-tbody').addEventListener('click', async event => {
        const button = event.target.closest('button');
        if (!button || !catalogData) return;
        if (button.dataset.catalogRefresh) return refreshPublisher([button.dataset.catalogRefresh]);
        if (button.dataset.catalogClear) {
            try { await catalogWrite('clear-manual', { key: button.dataset.catalogClear }); await loadPublisherCatalog(); showSuccess(t('catalog.cleared')); }
            catch (error) { showError(error.message); }
            return;
        }
        if (button.dataset.catalogHistory) {
            try {
                const history = (await apiCall('/catalog/history?key=' + encodeURIComponent(button.dataset.catalogHistory))).data;
                catalogueElement('scope-detail-title').textContent = t('catalog.history') + ' · ' + button.dataset.catalogHistory;
                catalogueElement('scope-detail-body').innerHTML = history.map(h => '<p>' + esc(h.recorded_at) + ' · ' + esc(h.origin) + '<br>' +
                    esc((h.payload_json.editions || []).map(e => e.designation).join(' / ')) + '<br>' + esc(h.payload_json.note || '') + '</p>').join('');
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
