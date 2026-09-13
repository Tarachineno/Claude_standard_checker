let publisherChanges = { items: [], banner_days: 7 };
let dismissedPublisherChange = 0;
try { dismissedPublisherChange = Number(localStorage.getItem('publisher-change-dismissed')) || 0; } catch { /* Storage may be disabled. */ }

function renderPublisherNotices(now = Date.now()) {
    const banner = document.getElementById('publisher-change-banner');
    const items = publisherChanges.items.filter(item => Date.parse(item.expires_at) > now && Date.parse(item.detected_at) <= now);
    if (!items.length || items.every(item => Number(item.id) <= dismissedPublisherChange)) {
        banner.classList.add('hidden');
        return;
    }
    const ja = currentLanguage === 'ja';
    document.getElementById('publisher-change-title').textContent = ja
        ? `Published版・廃止・後継情報の更新 ${items.length}件（検知から${publisherChanges.banner_days}日間表示）`
        : `${items.length} Published edition / lifecycle update(s) (shown for ${publisherChanges.banner_days} days after detection)`;
    document.getElementById('publisher-change-details-label').textContent = ja ? '変更内容と公式出典を見る' : 'View changes and official sources';
    document.getElementById('publisher-change-close').setAttribute('aria-label', ja ? '更新のお知らせを閉じる' : 'Dismiss edition updates');
    document.getElementById('publisher-change-list').innerHTML = items.map(item => {
        const empty = ja ? 'Published版なし／未確認' : 'No Published edition / not verified';
        const stateText = (state, editions) => {
            if (state?.status !== 'withdrawn') return editions.join(' / ') || empty;
            const replacements = state.replacements || [];
            const label = state.replacement_status === 'none' ? (ja ? '後継規格なし' : 'No successor')
                : state.replacement_status === 'unknown' ? (ja ? '後継規格は未確認' : 'Successor not verified')
                : replacements.map(s => s.reference + (s.cited_edition ? ':' + s.cited_edition : '')
                    + (s.relation === 'partial' ? (ja ? '（部分置換）' : ' (partial)') : '') + ' — ' + s.note).join(' / ');
            return (ja ? '廃止' : 'Withdrawn') + (state.withdrawal_date ? ' (' + state.withdrawal_date + ')' : '') + ' · ' + label;
        };
        return `<li><strong>${esc(item.designation)}</strong>: ${esc(stateText(item.before_state, item.before))} → ${esc(stateText(item.after_state, item.after))}
            <small>${ja ? '検知日' : 'Detected'}: ${esc(new Date(item.detected_at).toLocaleDateString())}</small>
            ${safeSourceLink(item.source_url, ja ? '公式出典' : 'Official source')}</li>`;
    }).join('');
    banner.classList.remove('hidden');
}

async function loadPublisherNotices() {
    try {
        publisherChanges = (await apiCall('/catalog/changes')).data;
        renderPublisherNotices();
    } catch (error) {
        // An unavailable change feed is not proof that there were no changes.
        console.warn('Publisher change feed unavailable:', error.message);
        renderPublisherNotices();
    }
}

document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('publisher-change-close').addEventListener('click', () => {
        dismissedPublisherChange = Math.max(dismissedPublisherChange, ...publisherChanges.items.map(item => Number(item.id)));
        try { localStorage.setItem('publisher-change-dismissed', String(dismissedPublisherChange)); } catch { /* Session-only dismissal. */ }
        renderPublisherNotices();
    });
    loadPublisherNotices();
    // Expire already-open banners without extending their detection date.
    setInterval(renderPublisherNotices, 60000);
    setInterval(() => { if (!document.hidden) loadPublisherNotices(); }, 5 * 60000);
    document.addEventListener('visibilitychange', () => { if (!document.hidden) loadPublisherNotices(); });
});
