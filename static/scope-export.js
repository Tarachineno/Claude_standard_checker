// Export the full comparison, not filtered DOM rows or a directive-specific view.
const scopeExportLabels = {
    ja: {
        button: '全件CSVをエクスポート', busy: '全件を取得中…',
        hint: '画面の絞り込みを適用せず、全認定・全施設・全指令（RED / EMC / LVD）の比較結果を取得して出力します。1スコープ＝1行です。',
        failed: '全件CSVの出力に失敗しました。', invalid: '全件の比較結果を取得できませんでした。再試行してください。',
        done: '全{count}スコープをCSVに出力しました。',
        headers: ['認定', '認可書番号', '認定取得組織', '認可書有効期限', '施設番号', '施設名', '施設所在地', '区分', '認定スコープ', '補足説明', '認定スコープ版数',
            'OJ総合判定', 'OJ総合判定理由', 'OJ有効版数', 'OJ規格別判定・理由', 'OJ掲載内容・適用日・制限', 'OJ元データ更新日', 'OJ取得元・取得状況',
            'Published総合判定', 'Published総合判定理由', 'Published版・廃止版', 'Published規格別判定・理由', 'Published最終確認日時', 'Published公式出典', 'Published最終調査状況',
            '廃止情報', '後継規格・置換範囲', '後継の現行Published版', '後継関係の公式出典', '比較日時（UTC）', 'スコープ取得元', '認可書PDF', 'スコープ詳細'],
    },
    en: {
        button: 'Export all to CSV', busy: 'Loading all scopes…',
        hint: 'Export a fresh comparison for all accreditations, facilities and OJ directives (RED / EMC / LVD), regardless of filters. One scope per row.',
        failed: 'Failed to export all scopes.', invalid: 'The complete comparison could not be loaded. Please retry.',
        done: 'Exported all {count} scopes to CSV.',
        headers: ['Accreditation', 'Certificate number', 'Organization', 'Certificate valid until', 'Facility number', 'Facility name', 'Facility location', 'Category', 'Accreditation scope', 'Description', 'Scope editions',
            'OJ overall status', 'OJ overall reason', 'Active OJ editions', 'OJ reference status / reason', 'OJ listings / applicability / restrictions', 'OJ source update dates', 'OJ source / availability',
            'Published overall status', 'Published overall reason', 'Published / withdrawn editions', 'Published reference status / reason', 'Published last verified', 'Published official source', 'Published latest review',
            'Withdrawal details', 'Successors / replacement scope', 'Successor current Published edition', 'Official replacement evidence', 'Comparison time (UTC)', 'Scope source', 'Certificate PDF', 'Scope details'],
    },
};
for (const [lang, labels] of Object.entries(scopeExportLabels)) {
    for (const [key, value] of Object.entries(labels)) if (key !== 'headers') translations[lang]['scope_export.' + key] = value;
}

function scopeExportCsvCell(value) {
    let text = String(value ?? '');
    // Quoting alone does not prevent a spreadsheet from evaluating a formula.
    if (/^[\s\u0000-\u001f]*[=+\-@]/.test(text) || /^[\t\r\n]/.test(text)) text = "'" + text;
    return '"' + text.replace(/"/g, '""') + '"';
}

function scopeComparisonCsv(data, lang = currentLanguage, origin = window.location.origin) {
    const labels = scopeExportLabels[lang] || scopeExportLabels.en;
    const translate = key => translations[lang]?.[key] || translations.en[key] || key;
    const unknown = translate('catalog.date_unknown');
    const status = value => value ? translate((['confirmation', 'withdrawn', 'unverified'].includes(value) ? 'catalog.' : 'scope_oj.') + value) : unknown;
    const reason = value => value ? translate('scope_oj.reason_' + value) : unknown;
    const line = values => values.filter(v => v !== undefined && v !== null && v !== '').join(' · ');
    const lines = values => values.filter(Boolean).join('\n');
    const dated = value => value && Number.isFinite(Date.parse(value)) ? value : unknown;
    const byReference = (item, format) => lines((item.references || []).map(ref => {
        const value = format(ref);
        return value ? ref.designation + ': ' + value : '';
    }));
    const byOj = (item, format) => byReference(item, ref => lines((ref.oj?.checks || []).map(check => {
        const value = format(check);
        return value ? line([check.directive, value]) : '';
    })));
    const bySuccessor = (item, format) => byReference(item, ref => lines((ref.published?.replacements || []).map(replacement => line([replacement.reference, format(replacement)]))));
    const sourceDates = lines(['RED', 'EMC', 'LVD'].map(d => {
        const source = data.sources?.oj?.[d] || {};
        return line([d, dated(source.source_updated_at), source.source_updated_kind ? translate('catalog.' + source.source_updated_kind) : '']);
    }));
    const sources = lines(['RED', 'EMC', 'LVD'].map(d => {
        const source = data.sources?.oj?.[d];
        return line([d, source?.source || unknown, source?.error]);
    }));
    const rows = (data.items || []).map(item => [
        String(item.cert_type || '').toUpperCase(), item.certificate_number, item.organization, item.valid_until,
        item.facility_number, item.facility_name, item.facility_location, item.category, item.standard, item.description,
        byReference(item, ref => ref.edition_unparsed ? unknown : ref.versions?.join(' / ') || translate('catalog.confirmation')),
        status(item.status), reason(item.reason),
        byOj(item, check => check.oj_designations?.join(' / ') || reason(check.reason)),
        byOj(item, check => line([status(check.status), reason(check.reason)])),
        byOj(item, check => lines((check.oj_entries || []).map(entry => line([
            entry.number, entry.title, entry.oj_reference, entry.publication_decision_reference,
            entry.date_of_start_presumption ? 'Start: ' + entry.date_of_start_presumption : '',
            entry.withdrawal_date ? 'End: ' + entry.withdrawal_date : '',
            entry.restriction && entry.restriction !== '-' ? entry.restriction : '',
            entry.restriction_date ? 'Restriction: ' + entry.restriction_date : '',
        ])))), sourceDates, sources,
        status(item.published?.status), line([reason(item.published?.reason), item.published?.partial_withdrawal ? translate('catalog.partial_withdrawal') : '']),
        byReference(item, ref => ref.published?.latest?.designation || (ref.published?.record?.editions || []).map(e => line([e.designation, e.status])).join(' / ') || unknown),
        byReference(item, ref => line([status(ref.published?.status), reason(ref.published?.reason)])),
        byReference(item, ref => line([dated(ref.published?.record?.checked_at), ref.published?.record?.origin ? translate('catalog.' + ref.published.record.origin) : ''])),
        byReference(item, ref => ref.published?.latest?.source_url || ref.published?.record?.source_url || ''),
        byReference(item, ref => {
            const record = ref.published?.record;
            return line([record?.note, record?.error, record?.latest_review?.outcome, record?.latest_review?.reason, record?.latest_review?.completed_at, data.sources?.catalog?.error]);
        }),
        byReference(item, ref => {
            const lifecycle = ref.published?.lifecycle;
            return lifecycle?.status === 'withdrawn' ? line([status('withdrawn'), dated(lifecycle.withdrawal_date), reason('publisher_withdrawn_' + lifecycle.replacement_status), lifecycle.source_url, translate('catalog.withdrawal_scope_note')]) : '';
        }),
        bySuccessor(item, replacement => line([translate('catalog.replacement_' + replacement.relation), replacement.cited_edition ? translate('catalog.replacement_cited') + ': ' + replacement.cited_edition : '', replacement.note])),
        bySuccessor(item, replacement => {
            const p = replacement.published;
            return p?.status === 'withdrawn' ? translate('catalog.successor_withdrawn')
                : p?.latest && p.status !== 'unverified' && !p.latest.reference_changed
                    ? line([p.latest.designation, dated(p.record?.checked_at), p.latest.source_url || p.record?.source_url])
                    : translate('catalog.successor_unknown');
        }),
        bySuccessor(item, replacement => replacement.source_url), dated(data.checked_at), item.source,
        ['a2la', 'jab'].includes(item.cert_type) ? new URL('/certificates/' + item.cert_type + '.pdf', origin).href : '',
        item.anchor ? new URL('/api/scope-detail?cert_type=' + encodeURIComponent(item.cert_type) + '&anchor=' + encodeURIComponent(item.anchor), origin).href : '',
    ]);
    // UTF-8 BOM for Excel, CRLF records, quoted multiline fields, no formula cells.
    return '\uFEFF' + [labels.headers, ...rows].map(row => row.map(scopeExportCsvCell).join(',')).join('\r\n') + '\r\n';
}

async function exportAllScopeComparison() {
    const button = document.getElementById('scope-oj-export-btn');
    if (button.disabled) return;
    button.disabled = true;
    button.setAttribute('aria-busy', 'true');
    button.textContent = t('scope_export.busy');
    try {
        // Never reuse scopeOjCheckData: it may contain only the selected directive.
        const response = await apiCall('/scope-oj-version-check?directive=ALL');
        const data = response.data;
        if (!response.success || data?.directive !== 'ALL' || !Array.isArray(data.items) || data.summary?.total !== data.items.length) {
            throw new Error(t('scope_export.invalid'));
        }
        const csv = scopeComparisonCsv(data);
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        downloadFile(csv, 'lab-scope-comparison_all_' + timestamp + '.csv', 'text/csv;charset=utf-8');
        showSuccess(t('scope_export.done', { count: data.items.length }));
    } catch (error) {
        showError(t('scope_export.failed') + ' ' + error.message);
    } finally {
        button.disabled = false;
        button.setAttribute('aria-busy', 'false');
        button.textContent = t('scope_export.button');
    }
}

document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('scope-oj-export-btn').addEventListener('click', exportAllScopeComparison);
});
