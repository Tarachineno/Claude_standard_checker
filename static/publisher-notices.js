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
        ? `Published版の更新 ${items.length}件（検知から${publisherChanges.banner_days}日間表示）`
        : `${items.length} Published edition update(s) (shown for ${publisherChanges.banner_days} days after detection)`;
    document.getElementById('publisher-change-details-label').textContent = ja ? '変更内容と公式出典を見る' : 'View changes and official sources';
    document.getElementById('publisher-change-close').setAttribute('aria-label', ja ? '更新のお知らせを閉じる' : 'Dismiss edition updates');
    document.getElementById('publisher-change-list').innerHTML = items.map(item => {
        const empty = ja ? 'Published版なし／未確認' : 'No Published edition / not verified';
        return `<li><strong>${esc(item.designation)}</strong>: ${esc(item.before.join(' / ') || empty)} → ${esc(item.after.join(' / ') || empty)}
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
