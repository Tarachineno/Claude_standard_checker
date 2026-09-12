// EU Harmonized Standards Checker - Frontend JavaScript
// Pure JavaScript implementation for Netlify deployment

// Global variables
let uploadedCertificateData = null;
let currentStandardsData = null; // Store current standards for sorting/filtering
let currentLanguage = 'ja'; // Default language

// Scope matching cache to avoid repeated API calls
let scopeMatchingCache = new Map();

// Internationalization (i18n) translations
const translations = {
    en: {
        'app.title': 'EU Harmonized Standards Checker',
        'app.description': 'Check compliance with EU directives (RED, EMC, LVD) and compare with ISO17025 certificates',
        'nav.quick_check': 'Quick Check',
        'nav.oj_standards': 'OJ Standards',
        'nav.search_standards': 'Search Standards', 
        'nav.iso17025_certificate': 'ISO17025 Certificate',
        'quick.title': 'Quick Check — can we test it under accreditation?',
        'quick.description': 'Paste standard numbers (one per line, or comma separated). JAB / A2LA accreditation scopes and the EU Official Journal lists (EMC / RED / LVD) are checked at once.',
        'quick.placeholder': 'EN 55032:2015\nEN 301 489-17 V3.2.4\nEN 300 328 V2.2.2\nIEC 61000-4-2',
        'quick.check_btn': 'Check',
        'quick.example_btn': 'Example',
        'quick.clear_btn': 'Clear',
        'quick.hint': 'Tip: Ctrl+Enter runs the check',
        'quick.legend_ok': 'within accreditation scope',
        'quick.legend_check': 'listed with a different edition — confirm with engineering',
        'quick.legend_ng': 'not in JAB or A2LA scope',
        'quick.results_title': 'Results',
        'quick.copy_btn': 'Copy table',
        'quick.print_btn': 'Print',
        'quick.col_standard': 'Standard',
        'quick.col_verdict': 'Verdict',
        'quick.col_oj': 'OJ (EMC / RED / LVD)',
        'quick.summary': '{ok} OK / {check} CHECK / {ng} NG of {total}',
        'quick.oj_harmonised': 'Listed',
        'quick.oj_withdrawn': 'Withdrawn',
        'quick.oj_not_listed': 'Not listed',
        'quick.oj_other_edition': 'other edition',
        'quick.no_scope': 'No scope',
        'quick.also': 'also',
        'quick.sources': 'JAB {jab_no} (valid until {jab_until}) · A2LA {a2la_no} (valid until {a2la_until}) · OJ lists: {oj} · checked {at}',
        'quick.copied': 'Copied {n} rows to clipboard',
        'quick.empty': 'Enter at least one standard number',
        'quick.detail_source_db': 'source: D1 database',
        'quick.detail_source_md': 'source: MD file',
        'quick.detail_valid_until': 'valid until',
        'quick.detail_open_pdf': 'Open certificate PDF',
        'quick.detail_link': 'Detail',
        'standards.title_main': 'EU Harmonized Standards',
        'standards.description': 'Fetch and analyze standards from Official Journal publications',
        'standards.directive_label': 'Select Directive:',
        'standards.directive_red': 'RED (Radio Equipment Directive)',
        'standards.directive_emc': 'EMC (Electromagnetic Compatibility)',
        'standards.directive_lvd': 'LVD (Low Voltage Directive)',
        'standards.fetch_btn': 'Fetch Standards',
        'standards.results_title': 'Results',
        'standards.count': '{count} standards',
        'standards.sort_label': 'Sort by:',
        'standards.sort_number_asc': 'Standard Number (A-Z)',
        'standards.sort_number_desc': 'Standard Number (Z-A)',
        'standards.sort_date_desc': 'OJ Date (Newest First)',
        'standards.sort_date_asc': 'OJ Date (Oldest First)',
        'standards.filter_label': 'Filter by Status:',
        'standards.filter_all': 'All Standards',
        'standards.filter_valid': 'Valid (Published, Not Withdrawn)',
        'standards.filter_invalid': 'Invalid (Withdrawn)',
        'standards.search_label': 'Search in Results:',
        'standards.search_placeholder': 'Search standards or descriptions...',
        'standards.apply_btn': 'Apply',
        'standards.reset_btn': 'Reset',
        'standards.export_btn': 'Export',
        'certificate.title': 'ISO17025 Certificate Analysis',
        'certificate.description': 'Compare your standards with ISO17025 certified testing laboratories',
        'certificate.type_label': 'Select Certificate Type:',
        'certificate.load_btn': 'Load Certificate Data',
        'certificate.search_title': 'Search Certificate Scopes',
        'certificate.search_placeholder': 'Enter standard number (e.g., EN 301 783, 55032)',
        'certificate.search_btn': 'Search',
        'certificate.clear_btn': 'Clear',
        'certificate.info_title': 'Certificate Information',
        'certificate.number_label': 'Certificate Number:',
        'certificate.organization_label': 'Organization:',
        'certificate.valid_until_label': 'Valid Until:',
        'certificate.load_a2la': 'Load A2LA Certificate Data',
        'certificate.load_jab': 'Load JAB Certificate Data',
        'certificate.search_description': 'Search for specific standards in A2LA and JAB certificate scopes',
        'search.title': 'Search Standards on Official Portals',
        'search.description': 'Search for specific standards on official standards portals. Choose your preferred portal and enter a standard number or keyword.',
        'search.input_placeholder': 'Enter standard number or keyword (e.g., 50360:2017, 18031-1)',
        'search.etsi_btn': 'Search on ETSI Portal',
        'search.cenelec_btn': 'Search on CEN-CENELEC Portal',
        'search.how_to_title': 'How to Search',
        'search.etsi_portal_title': 'ETSI Portal',
        'search.cenelec_portal_title': 'CEN-CENELEC Portal',
        'search.standard_number_label': 'Standard Number:',
        'search.keywords_label': 'Keywords:',
        'search.technology_label': 'Technology:',
        'search.product_type_label': 'Product Type:',
        'search.direct_search_note': 'Direct search: Opens ETSI portal with automatic search.',
        'search.manual_search_note': 'Manual search: Standard number copied to clipboard for pasting. (Standard Reference field of Deliverable)',
        'standards.title_fetch': 'Fetch OJ Standards',
        'standards.description': 'Fetch and analyze standards from Official Journal publications',
        'standards.fetch_method_label': 'Fetch Method:',
        'standards.excel_method': 'Excel File (Parse hEN list)',
        'standards.download_excel': 'Download Excel File',
        'standards.note_oj_update': 'The latest OJ information may not be reflected. If this is the case, please check manually from the following links.',
        'standards.note_red_link': 'RED:',
        'standards.note_emc_link': 'EMC:',
        'standards.note_lvd_link': 'LVD:',
        'standards.new_banner': 'New harmonized standards added: {list} (shown for {days} more day(s))',
        'common.loading': 'Processing...',
        'common.no_results': 'No results found',
        'common.error': 'Error',
        'scope.title': 'ISO17025 Certificate Scope:',
        'scope.exact_match': 'Exact match',
        'scope.comprehensive_match': 'Comprehensive scope',
        'scope.version_tolerant_match': 'Version tolerant match',
        'scope.version_mismatch': 'Version mismatch',
        'scope.prefix_mismatch': 'Prefix mismatch',
        'scope.no_match': 'No scope coverage',
        'scope.note.comprehensive': 'Comprehensive scope applied (includes {part})',
        'scope.note.version_mismatch': 'Version mismatch ({version1}↔{version2})',
        'scope.note.version_tolerant': 'Version tolerant ({version})',
        'scope.note.scope_applied': 'Scope applied',
        'scope.note.prefix_mismatch': 'Prefix mismatch ({prefix1}/{prefix2})'
    },
    ja: {
        'app.title': 'EU Harmonized Standards Checker',
        'app.description': 'Check compliance with EU directives (RED, EMC, LVD) and compare with ISO17025 certificates',
        'nav.quick_check': 'クイック判定',
        'nav.oj_standards': 'OJ規格',
        'nav.search_standards': '規格検索',
        'nav.iso17025_certificate': 'ISO17025証明書',
        'quick.title': 'クイック判定 — この規格、認定範囲で試験できる？',
        'quick.description': '規格番号を貼り付けてください（1行に1つ、またはカンマ区切り）。JAB / A2LA の認定スコープと、EU官報（OJ）の整合規格リスト（EMC / RED / LVD）をまとめて照合します。',
        'quick.placeholder': 'EN 55032:2015\nEN 301 489-17 V3.2.4\nEN 300 328 V2.2.2\nIEC 61000-4-2',
        'quick.check_btn': '判定する',
        'quick.example_btn': '例を入れる',
        'quick.clear_btn': 'クリア',
        'quick.hint': 'ヒント: Ctrl+Enter で判定',
        'quick.legend_ok': '認定範囲内',
        'quick.legend_check': '年版違いで掲載あり — エンジニアに確認',
        'quick.legend_ng': 'JAB・A2LA どちらの認定範囲にもなし',
        'quick.results_title': '判定結果',
        'quick.copy_btn': '表をコピー',
        'quick.print_btn': '印刷',
        'quick.col_standard': '規格',
        'quick.col_verdict': '総合',
        'quick.col_oj': 'OJ整合規格（EMC / RED / LVD）',
        'quick.summary': '{total}件中 OK {ok} / CHECK {check} / NG {ng}',
        'quick.oj_harmonised': '掲載あり',
        'quick.oj_withdrawn': '取下げ済',
        'quick.oj_not_listed': '掲載なし',
        'quick.oj_other_edition': '版違い',
        'quick.no_scope': 'スコープなし',
        'quick.also': '他',
        'quick.sources': 'JAB {jab_no}（有効期限 {jab_until}）· A2LA {a2la_no}（有効期限 {a2la_until}）· OJリスト: {oj} · 判定日時 {at}',
        'quick.copied': '{n}行をクリップボードにコピーしました',
        'quick.empty': '規格番号を1つ以上入力してください',
        'quick.detail_source_db': 'データ元: D1データベース',
        'quick.detail_source_md': 'データ元: MDファイル',
        'quick.detail_valid_until': '有効期限',
        'quick.detail_open_pdf': '認定書PDFを開く',
        'quick.detail_link': '詳細',
        'standards.title_main': 'EU調和規格',
        'standards.description': '官報公告から規格を取得・分析',
        'standards.directive_label': '指令を選択:',
        'standards.directive_red': 'RED（無線機器指令）',
        'standards.directive_emc': 'EMC（電磁適合性）',
        'standards.directive_lvd': 'LVD（低電圧指令）',
        'standards.fetch_btn': '規格取得',
        'standards.results_title': '結果',
        'standards.count': '{count}個の規格',
        'standards.sort_label': '並び順:',
        'standards.sort_number_asc': '規格番号（昇順）',
        'standards.sort_number_desc': '規格番号（降順）',
        'standards.sort_date_desc': 'OJ日付（新しい順）',
        'standards.sort_date_asc': 'OJ日付（古い順）',
        'standards.filter_label': '状態で絞り込み:',
        'standards.filter_all': '全ての規格',
        'standards.filter_valid': '有効（公開済み、取り下げなし）',
        'standards.filter_invalid': '無効（取り下げ済み）',
        'standards.search_label': '結果内検索:',
        'standards.search_placeholder': '規格番号や説明を検索...',
        'standards.apply_btn': '適用',
        'standards.reset_btn': 'リセット',
        'standards.export_btn': 'エクスポート',
        'certificate.title': 'ISO17025証明書分析',
        'certificate.description': '規格をISO17025認定試験所の証明書と比較',
        'certificate.type_label': '証明書タイプを選択:',
        'certificate.load_btn': '証明書データ読込',
        'certificate.search_title': '証明書スコープ検索',
        'certificate.search_placeholder': '規格番号を入力（例：EN 301 783、55032）',
        'certificate.search_btn': '検索',
        'certificate.clear_btn': 'クリア',
        'certificate.info_title': '証明書情報',
        'certificate.number_label': '証明書番号:',
        'certificate.organization_label': '機関:',
        'certificate.valid_until_label': '有効期限:',
        'certificate.load_a2la': 'A2LA証明書データ読込',
        'certificate.load_jab': 'JAB証明書データ読込',
        'certificate.search_description': 'A2LAおよびJAB証明書スコープから特定規格を検索',
        'search.title': '規格検索',
        'search.description': '公式規格ポータルで特定の規格を検索します。希望するポータルを選択し、規格番号またはキーワードを入力してください。',
        'search.input_placeholder': '規格番号またはキーワードを入力（例：50360:2017、18031-1）',
        'search.etsi_btn': 'ETSIポータルで検索',
        'search.cenelec_btn': 'CEN-CENELECポータルで検索',
        'search.how_to_title': '検索方法',
        'search.etsi_portal_title': 'ETSIポータル',
        'search.cenelec_portal_title': 'CEN-CENELECポータル',
        'search.standard_number_label': '規格番号:',
        'search.keywords_label': 'キーワード:',
        'search.technology_label': '技術:',
        'search.product_type_label': '製品タイプ:',
        'search.direct_search_note': '直接検索: ETSIポータルを自動検索で開きます。',
        'search.manual_search_note': '手動検索: 規格番号をクリップボードにコピーして貼り付け可能。（DeliverableのStandard Reference欄）',
        'standards.title_fetch': 'OJ規格取得',
        'standards.description': '官報公告から規格を取得・分析',
        'standards.fetch_method_label': '取得方法:',
        'standards.excel_method': 'Excelファイル（hENリスト解析）',
        'standards.download_excel': 'Excelファイルダウンロード',
        'standards.note_oj_update': '最新のOJについては反映されていない可能性があります。その場合は以下のリンクから手動で確認してください。',
        'standards.note_red_link': 'RED:',
        'standards.note_emc_link': 'EMC:',
        'standards.note_lvd_link': 'LVD:',
        'standards.new_banner': '新しい整合規格が追加されました：{list}（あと{days}日間表示）',
        'common.loading': '処理中...',
        'common.no_results': '結果が見つかりません',
        'common.error': 'エラー',
        'scope.title': 'ISO17025証明書スコープ:',
        'scope.exact_match': '完全一致',
        'scope.comprehensive_match': '包括スコープ',
        'scope.version_tolerant_match': 'バージョン包括',
        'scope.version_mismatch': '年版違い',
        'scope.prefix_mismatch': '表記違い',
        'scope.no_match': '対応スコープなし',
        'scope.note.comprehensive': '包括スコープ適用({part}含む)',
        'scope.note.version_mismatch': '年版違い({version1}↔{version2})',
        'scope.note.version_tolerant': 'バージョン包括({version})',
        'scope.note.scope_applied': 'スコープに適用',
        'scope.note.prefix_mismatch': '表記違い({prefix1}/{prefix2})'
    }
};

// Cache helper functions
function createCacheKey(standards) {
    if (!standards || !Array.isArray(standards)) {
        return '';
    }
    return standards.map(s => s.number || s.full_number).sort().join('|');
}

function getScopeMatchesFromCache(standards) {
    const cacheKey = createCacheKey(standards);
    return scopeMatchingCache.get(cacheKey);
}

function setScopeMatchesInCache(standards, matches) {
    const cacheKey = createCacheKey(standards);
    scopeMatchingCache.set(cacheKey, matches);
}

// API configuration - Cloudflare Workers (旧 /.netlify/functions も互換パスとして残してある)
const API_BASE = '/api';
// GitHub repository for viewing scope details

const GITHUB_REPO_URL = 'https://github.com/Tarachineno/Claude_standard_checker';
// スコープ MD の参照先ブランチ（「詳細を見る」リンク）。/api/me が返す値で上書きされる。
let SCOPE_SOURCE_BRANCH = 'cloudflare-workers';

// Certificate data is now loaded dynamically from MD files via API
// No more hardcoded certificate data - all data comes from:
// - /static/data/a2la-scopes.md
// - /static/data/jab-scopes.md

// DOM elements (will be initialized after DOM load)
let loadingOverlay, errorModal, successModal, scopeDetailModal;

// Initialize the application
document.addEventListener('DOMContentLoaded', function() {
    initializeApp();
});

async function initializeApp() {
    loadIdentity();
    // Initialize DOM elements
    loadingOverlay = document.getElementById('loading-overlay');
    errorModal = document.getElementById('error-modal');
    successModal = document.getElementById('success-modal');
    scopeDetailModal = document.getElementById('scope-detail-modal');
    
    // Load saved language or default to Japanese
    currentLanguage = localStorage.getItem('language') || 'ja';
    
    setupEventListeners();
    setupLanguageSwitcher();
    updateLanguageDisplay();
    await loadDirectives();
    console.log('EU Harmonized Standards Checker initialized');
}

// Language switching functions
function setupLanguageSwitcher() {
    document.getElementById('lang-en').addEventListener('click', () => switchLanguage('en'));
    document.getElementById('lang-ja').addEventListener('click', () => switchLanguage('ja'));
}

function switchLanguage(lang) {
    currentLanguage = lang;
    localStorage.setItem('language', lang);
    updateLanguageDisplay();
    updateLanguageButtons();
}

function updateLanguageButtons() {
    document.querySelectorAll('.lang-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    document.getElementById(`lang-${currentLanguage}`).classList.add('active');
}

function updateLanguageDisplay() {
    // Update all elements with data-i18n attribute
    document.querySelectorAll('[data-i18n]').forEach(element => {
        const key = element.getAttribute('data-i18n');
        const translation = getTranslation(key);
        
        if ((element.tagName === 'INPUT' && element.type !== 'button') || element.tagName === 'TEXTAREA') {
            element.placeholder = translation;
        } else {
            element.textContent = translation;
        }
    });
    
    // Update document language attribute
    document.documentElement.lang = currentLanguage;
    
    // Update page title
    document.title = getTranslation('app.title');
}

function getTranslation(key, params = {}) {
    const translation = translations[currentLanguage]?.[key] || translations.en[key] || key;
    
    // Replace parameters in translation (e.g., {count})
    return translation.replace(/\{(\w+)\}/g, (match, param) => {
        return params[param] !== undefined ? params[param] : match;
    });
}

// Translate scope matching notes from backend (Japanese) to current language
function translateScopeNote(note) {
    if (!note) return '';
    
    // If already in English or current language is Japanese, return as is
    if (currentLanguage === 'ja') {
        return note;
    }
    
    // Parse Japanese note patterns and translate
    // Pattern: 包括スコープ適用(489-17含む)
    const comprehensiveMatch = note.match(/包括スコープ適用\(([^)]+)含む\)/);
    if (comprehensiveMatch) {
        return getTranslation('scope.note.comprehensive', { part: comprehensiveMatch[1] });
    }
    
    // Pattern: 年版違い(2015↔2018)
    const versionMismatchMatch = note.match(/年版違い\(([^↔]+)↔([^)]+)\)/);
    if (versionMismatchMatch) {
        return getTranslation('scope.note.version_mismatch', { 
            version1: versionMismatchMatch[1], 
            version2: versionMismatchMatch[2] 
        });
    }
    
    // Pattern: バージョン包括(2015)
    const versionTolerantMatch = note.match(/バージョン包括\(([^)]+)\)/);
    if (versionTolerantMatch) {
        return getTranslation('scope.note.version_tolerant', { version: versionTolerantMatch[1] });
    }
    
    // Pattern: スコープに適用
    if (note === 'スコープに適用') {
        return getTranslation('scope.note.scope_applied');
    }
    
    // Pattern: 表記違い(EN/ETSI) or 表記違い(EN / ETSI)
    const prefixMismatchMatch = note.match(/表記違い\(([^/]+)\s*\/\s*([^)]+)\)/);
    if (prefixMismatchMatch) {
        return getTranslation('scope.note.prefix_mismatch', { 
            prefix1: prefixMismatchMatch[1].trim(), 
            prefix2: prefixMismatchMatch[2].trim() 
        });
    }
    
    // If no pattern matches, return original note
    return note;
}

function t(key, params = {}) {
    return getTranslation(key, params);
}

function setupEventListeners() {
    // Tab navigation
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', () => switchTab(btn.dataset.tab));
    });

    // Quick check tab
    document.getElementById('quick-check-btn').addEventListener('click', runQuickCheck);
    document.getElementById('quick-example-btn').addEventListener('click', () => {
        document.getElementById('quick-input').value = 'EN 55032:2015\nEN 301 489-17 V3.2.4\nEN 300 328 V2.2.2\nEN 55022:2016\nEN 62311:2020\nIEC 61000-4-2';
    });
    document.getElementById('quick-clear-btn').addEventListener('click', () => {
        document.getElementById('quick-input').value = '';
        document.getElementById('quick-results').classList.add('hidden');
    });
    document.getElementById('quick-input').addEventListener('keydown', (e) => {
        if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') runQuickCheck();
    });
    document.getElementById('quick-copy-btn').addEventListener('click', copyQuickResults);
    document.getElementById('quick-csv-btn').addEventListener('click', downloadQuickCsv);
    document.getElementById('quick-print-btn').addEventListener('click', () => window.print());

    // Standards tab
    document.getElementById('fetch-standards-btn').addEventListener('click', fetchStandards);
    document.getElementById('standards-new-banner-close').addEventListener('click', () => {
        const banner = document.getElementById('standards-new-banner');
        dismissedBannerKey = banner.dataset.bannerKey || null;
        banner.classList.add('hidden');
    });
    document.getElementById('export-standards-btn').addEventListener('click', exportStandards);
    document.getElementById('directive-select').addEventListener('change', updateFetchMethodOptions);
    document.getElementById('apply-controls-btn').addEventListener('click', applySortAndFilter);
    document.getElementById('reset-controls-btn').addEventListener('click', resetSortAndFilter);

    // Search tab
    document.getElementById('search-etsi-btn').addEventListener('click', () => searchStandards('etsi'));
    document.getElementById('search-cen-btn').addEventListener('click', () => searchStandards('cen'));
    document.getElementById('search-input').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') searchStandards('etsi'); // Default to ETSI on Enter
    });

    // Certificate tab
    const certificateTypeSelect = document.getElementById('certificate-type-select');
    const loadCertificateBtn = document.getElementById('load-certificate-btn');

    certificateTypeSelect.addEventListener('change', handleCertificateTypeChange);
    loadCertificateBtn.addEventListener('click', loadCertificateData);

    // Scope search
    document.getElementById('scope-search-btn').addEventListener('click', performScopeSearch);
    document.getElementById('clear-search-btn').addEventListener('click', clearScopeSearch);
    document.getElementById('scope-search-input').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') performScopeSearch();
    });

    // Standards results search
    document.getElementById('standards-search-btn').addEventListener('click', performStandardsSearch);
    document.getElementById('clear-standards-search-btn').addEventListener('click', clearStandardsSearch);
    document.getElementById('standards-search-input').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') performStandardsSearch();
    });

    // Modals
    document.querySelectorAll('.close').forEach(closeBtn => {
        closeBtn.addEventListener('click', closeModals);
    });

    // Close modals on outside click
    [errorModal, successModal, scopeDetailModal].forEach(modal => {
        modal.addEventListener('click', (e) => {
            if (e.target === modal) closeModals();
        });
    });
}

// Tab switching
function switchTab(tabName) {
    // Update tab buttons
    document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
    document.querySelector(`[data-tab="${tabName}"]`).classList.add('active');

    // Update tab content
    document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));
    document.getElementById(`${tabName}-tab`).classList.add('active');

}

// API functions
async function apiCall(endpoint, options = {}) {
    try {
        showLoading();
        
        const url = `${API_BASE}${endpoint}`;
        console.log('Making API call to:', url);
        
        const fetchOptions = {
            headers: {
                'Content-Type': 'application/json',
                ...options.headers
            },
            ...options
        };
        
        const response = await fetch(url, fetchOptions);
        console.log('Response status:', response.status);
        
        let data;
        const contentType = response.headers.get('content-type');
        
        if (contentType && contentType.includes('application/json')) {
            data = await response.json();
        } else {
            const text = await response.text();
            console.log('Non-JSON response:', text);
            throw new Error(`Server returned non-JSON response: ${text.substring(0, 200)}...`);
        }
        
        console.log('API response data:', data);
        
        if (!response.ok) {
            throw new Error(data.error || `HTTP ${response.status}: ${response.statusText}`);
        }

        return data;
    } catch (error) {
        console.error('API call failed:', error);
        throw error;
    } finally {
        hideLoading();
    }
}

// Load directives
async function loadDirectives() {
    try {
        console.log('Loading directives...');
        
        const response = await apiCall('/directives');
        
        if (!response.success) {
            throw new Error(response.error || 'Failed to load directives');
        }
        
        const directives = response.data;
        console.log('Loaded directives:', directives);

        // Populate directive selects
        const selects = ['directive-select'];
        selects.forEach(selectId => {
            const select = document.getElementById(selectId);
            if (!select) {
                console.error(`Select element not found: ${selectId}`);
                return;
            }
            
            select.innerHTML = '<option value="">Select directive...</option>';
            
            directives.forEach(directive => {
                const option = document.createElement('option');
                option.value = directive.code;
                option.textContent = `${directive.code} - ${directive.name}`;
                select.appendChild(option);
            });
            
            console.log(`Populated ${selectId} with ${directives.length} directives`);
        });
        
        // Initialize fetch method options
        updateFetchMethodOptions();
    } catch (error) {
        console.error('Failed to load directives:', error);
        showError(`Failed to load directives: ${error.message}`);
    }
}

// Update fetch method options based on selected directive
function updateFetchMethodOptions() {
    const directive = document.getElementById('directive-select').value;
    const fetchMethodSelect = document.getElementById('fetch-method');
    
    fetchMethodSelect.innerHTML = '';
    
    if (!directive) {
        fetchMethodSelect.innerHTML = '<option value="">Select directive first...</option>';
        return;
    }
    
    if (directive === 'EMC') {
        // EMC: Excel Parse first, then ETSI Portal
        fetchMethodSelect.innerHTML = `
            <option value="excel">Excel File (Parse hEN list)</option>
            <option value="etsi">ETSI Portal (Open in new tab)</option>
        `;
    } else if (directive === 'RED') {
        // RED: Excel Parse first, then ETSI Portal
        fetchMethodSelect.innerHTML = `
            <option value="excel">Excel File (Parse hEN list)</option>
            <option value="etsi">ETSI Portal (Open in new tab)</option>
        `;
    } else if (directive === 'LVD') {
        // LVD: Excel Parse first, then ETSI Portal
        fetchMethodSelect.innerHTML = `
            <option value="excel">Excel File (Parse hEN list)</option>
            <option value="etsi">ETSI Portal (Open in new tab)</option>
        `;
    } else {
        // Other directives: ETSI Portal only
        fetchMethodSelect.innerHTML = `
            <option value="etsi">ETSI Portal (Open in new tab)</option>
        `;
    }
}

// Standards functions
async function fetchStandards() {
    const directive = document.getElementById('directive-select').value;
    const fetchMethod = document.getElementById('fetch-method').value;
    
    if (!directive) {
        showError('Please select a directive');
        return;
    }

    if (fetchMethod === 'etsi') {
        // ETSI Portal redirect method with standardized format
        const etsiUrls = {
            'RED': 'https://www.etsi.org/standards#version=1&collection=RED&historical=0&sort=3',
            'EMC': 'https://www.etsi.org/standards#version=1&collection=EMC&historical=0&sort=3',
            'LVD': 'https://www.etsi.org/standards#version=1&collection=LVD&historical=0&sort=3'
        };

        if (etsiUrls[directive]) {
            const etsiUrl = etsiUrls[directive];
            
            console.log(`Redirecting to ETSI portal for ${directive} standards:`, etsiUrl);
            window.open(etsiUrl, '_blank');
            
            const directiveNames = {
                'RED': 'Radio Equipment Directive',
                'EMC': 'Electromagnetic Compatibility Directive',
                'LVD': 'Low Voltage Directive'
            };
            
            showSuccess(`Opening ETSI portal for ${directiveNames[directive]} (${directive}) standards in a new tab`);
            return;
        }
    } else if (fetchMethod === 'excel') {
        // Excel file parsing method - supported for EMC, RED, and LVD
        if (!['EMC', 'RED', 'LVD'].includes(directive)) {
            showError('Excel Parse is only supported for EMC, RED, and LVD directives');
            return;
        }
        
        try {
            console.log('Fetching standards from Excel file for directive:', directive);
            
            const response = await apiCall(`/standards?directive=${directive}`);
            
            if (response && response.success) {
                displayStandards(response.data);
                // Show download button for Excel file
                addDownloadButton(directive);
                
                // Build success message with filename if available
                let successMessage = `Successfully fetched ${response.data.count} standards from Excel file for ${response.data.directive_name}`;
                if (response.data.excel_filename) {
                    successMessage += ` (File: ${response.data.excel_filename})`;
                }
                showSuccess(successMessage);
            } else {
                throw new Error(response?.error || 'Failed to fetch standards from Excel file');
            }
        } catch (error) {
            console.error('Failed to fetch Excel standards:', error);
            showError(`Failed to fetch Excel standards: ${error.message}`);
        }
        return;
    }

    showError('Please select a valid fetch method');
}

// 新着 OJ 整合規格バナー。一度閉じたら同じ更新内容の間は出さない（リロードで復活してよい軽量な記憶）
let dismissedBannerKey = null;

function updateNewStandardsBanner(data) {
    const banner = document.getElementById('standards-new-banner');
    const textEl = document.getElementById('standards-new-banner-text');
    if (!banner || !textEl) return;

    const key = `${data.directive}:${data.last_updated || ''}`;
    if (!data.show_banner || !(data.last_added || []).length || dismissedBannerKey === key) {
        banner.classList.add('hidden');
        return;
    }

    const max = 3;
    const added = data.last_added;
    const shown = added.slice(0, max).join(', ');
    const list = added.length > max
        ? shown + (currentLanguage === 'ja' ? ` 他${added.length - max}件` : ` and ${added.length - max} more`)
        : shown;

    textEl.textContent = t('standards.new_banner', { list, days: data.banner_days_left });
    banner.dataset.bannerKey = key;
    banner.classList.remove('hidden');
}

async function displayStandards(data) {
    // Store current data for sorting/filtering
    currentStandardsData = data;
    updateNewStandardsBanner(data);

    const resultsSection = document.getElementById('standards-results');
    const countElement = document.getElementById('standards-count');
    const listElement = document.getElementById('standards-list');

    countElement.textContent = `${data.count} standards`;
    
    listElement.innerHTML = '';
    
    // Check scope matching for all standards (with caching)
    let scopeMatches = getScopeMatchesFromCache(data.standards);
    
    if (!scopeMatches) {
        try {
            const response = await apiCall('/scope-matcher', {
                method: 'POST',
                body: JSON.stringify({
                    oj_standards: data.standards.map(s => s.number || s.full_number)
                })
            });
            
            if (response.success) {
                scopeMatches = response.data.matches;
                // Cache the results
                setScopeMatchesInCache(data.standards, scopeMatches);
                
                console.log('Scope matching results (from API):', {
                    total_standards: response.data.total_standards,
                    a2la_matches: response.data.a2la_matches,
                    jab_matches: response.data.jab_matches,
                    debug: response.data.debug
                });
                
                if (response.data.debug) {
                    console.log('Debug info:', response.data.debug);
                    
                    // Display server logs
                    if (response.data.debug.server_logs && response.data.debug.server_logs.length > 0) {
                        console.log('=== SERVER LOGS ===');
                        response.data.debug.server_logs.forEach(log => console.log(log));
                        console.log('=== END SERVER LOGS ===');
                    }
                }
            }
        } catch (error) {
            console.error('Scope matching failed:', error);
            console.error('Error details:', error.message);
            if (error.response) {
                console.error('Server response:', error.response);
            }
            // Continue without scope matching - don't show error to user
        }
    } else {
        console.log('Scope matching results (from cache):', {
            cached_matches: scopeMatches.length
        });
    }
    
    data.standards.forEach((standard, index) => {
        const matchData = scopeMatches ? scopeMatches[index] : null;
        const item = createStandardItem(standard, data.directive, matchData);
        listElement.appendChild(item);
    });

    resultsSection.classList.remove('hidden');
}

// Apply sorting and filtering to standards
function applySortAndFilter() {
    if (!currentStandardsData) {
        showError('No standards data to sort/filter');
        return;
    }
    
    const sortBy = document.getElementById('sort-standards').value;
    const filterStatus = document.getElementById('filter-status').value;
    
    console.log(`Applying sort: ${sortBy}, filter: ${filterStatus}`);
    
    // Filter standards based on Excel OJ requirements
    let filteredStandards = [...currentStandardsData.standards];
    
    if (filterStatus === 'valid') {
        // Valid: Has OJ reference for publication (column 2) or restriction (column 5), but no withdrawal (column 7)
        filteredStandards = filteredStandards.filter(standard => {
            return isStandardValid(standard);
        });
    } else if (filterStatus === 'invalid') {
        // Invalid: Has withdrawal reference (column 7)
        filteredStandards = filteredStandards.filter(standard => {
            return isStandardWithdrawn(standard);
        });
    }
    
    // Sort standards based on Excel requirements
    filteredStandards.sort((a, b) => {
        switch (sortBy) {
            case 'standard_number_asc':
                return compareStandardNumbersSimple(a.number || a.full_number, b.number || b.full_number, false);
            case 'standard_number_desc':
                return compareStandardNumbersSimple(a.number || a.full_number, b.number || b.full_number, true);
            case 'oj_date_desc':
                return compareOJDatesExcel(a, b, true);
            case 'oj_date_asc':
                return compareOJDatesExcel(a, b, false);
            default:
                return 0;
        }
    });
    
    // Update display with filtered/sorted data
    const modifiedData = {
        ...currentStandardsData,
        standards: filteredStandards,
        count: filteredStandards.length
    };
    
    // Update count display
    const countElement = document.getElementById('standards-count');
    countElement.textContent = `${filteredStandards.length} standards`;
    if (filteredStandards.length !== currentStandardsData.standards.length) {
        countElement.textContent += ` (filtered from ${currentStandardsData.standards.length})`;
    }
    
    // Re-render standards list
    renderStandardsList(modifiedData);
}

// Reset sorting and filtering to default state
function resetSortAndFilter() {
    if (!currentStandardsData) {
        showError('No standards data to reset');
        return;
    }
    
    // Reset form controls to default values
    document.getElementById('sort-standards').value = 'standard_number_asc';
    document.getElementById('filter-status').value = 'all';
    
    // Update count display to original
    const countElement = document.getElementById('standards-count');
    countElement.textContent = `${currentStandardsData.count} standards`;
    
    // Re-render with original data
    renderStandardsList(currentStandardsData);
    
    console.log('Sort and filter controls reset to default');
}

// Helper function to check if standard is withdrawn (has data in column 7)
function isStandardWithdrawn(standard) {
    const withdrawalRef = standard.withdrawal_reference || standard.withdrawal_date || '';
    return withdrawalRef && 
           withdrawalRef !== '-' && 
           withdrawalRef.trim() !== '' && 
           withdrawalRef.toLowerCase() !== 'n/a';
}

// Helper function to check if standard is valid (Excel requirements)
function isStandardValid(standard) {
    // Must have publication OJ reference (column 2) or restriction reference (column 5)
    const hasPublication = standard.oj_reference && standard.oj_reference !== '-' && standard.oj_reference.trim() !== '';
    const hasRestriction = standard.restriction && standard.restriction !== '-' && standard.restriction.trim() !== '';
    
    // Must NOT have withdrawal reference (column 7)
    const isNotWithdrawn = !isStandardWithdrawn(standard);
    
    return (hasPublication || hasRestriction) && isNotWithdrawn;
}

// Simple standard number comparison (Excel style - ignore prefix)
function compareStandardNumbersSimple(a, b, descending = false) {
    if (!a && !b) return 0;
    if (!a) return descending ? -1 : 1;
    if (!b) return descending ? 1 : -1;
    
    // Simple string comparison without considering prefix
    const result = a.localeCompare(b);
    return descending ? -result : result;
}

// Excel-style OJ date comparison using latest date from multiple sources
function compareOJDatesExcel(standardA, standardB, newestFirst = true) {
    // Use same logic as getLatestOJDateForDisplay() to get latest date from Excel columns E, H, J (4, 7, 9)
    const getLatestOJDateValue = (standard) => {
        const validDates = [];
        
        // Only check the specific Excel columns E, H, J (4, 7, 9) for RED directive  
        const dateFields = [
            standard.date_of_start_presumption,     // Excel Column E (4): Date of start of presumption of conformity
            standard.restriction_date,              // Excel Column H (7): Date of start of presumption of conformity with restriction
            standard.withdrawal_date_col_j          // Excel Column J (9): Date of withdrawal from OJ
        ];
        
        dateFields.forEach(field => {
            if (field && field !== '-' && field.trim() !== '') {
                // Check if it's a valid date in YYYY-MM-DD format
                const dateMatch = field.match(/^(\d{4})-(\d{2})-(\d{2})$/);
                if (dateMatch) {
                    const year = parseInt(dateMatch[1]);
                    const month = parseInt(dateMatch[2]);
                    const day = parseInt(dateMatch[3]);
                    
                    // Convert to comparable number (YYYYMMDD format)
                    const dateValue = year * 10000 + month * 100 + day;
                    validDates.push(dateValue);
                }
            }
        });
        
        
        // Return the latest (newest) date value
        return validDates.length > 0 ? Math.max(...validDates) : 0;
    };
    
    const dateA = getLatestOJDateValue(standardA);
    const dateB = getLatestOJDateValue(standardB);
    
    if (dateA === 0 && dateB === 0) return 0;
    if (dateA === 0) return 1;
    if (dateB === 0) return -1;
    
    const result = dateB - dateA; // Newest first by default
    return newestFirst ? result : -result;
}

// Extract date from OJ string like "OJ L 289, 31/10/2023, p. 7"
function extractDateFromOJString(ojString) {
    if (!ojString || ojString === '-') return 0;
    
    // Look for dd/mm/yyyy pattern
    const dateMatch = ojString.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
    if (dateMatch) {
        const day = parseInt(dateMatch[1]);
        const month = parseInt(dateMatch[2]);
        const year = parseInt(dateMatch[3]);
        
        // Convert to comparable number (YYYYMMDD format)
        return year * 10000 + month * 100 + day;
    }
    
    return 0;
}

// Parse Excel serial date and convert to comparable format
function parseExcelSerialDate(dateValue) {
    if (!dateValue || dateValue === '-') return 0;
    
    const dateStr = String(dateValue).trim();
    
    // Check if it's an Excel serial date number
    if (dateStr.match(/^\d{4,5}$/)) {
        const excelSerialDate = parseInt(dateStr);
        if (excelSerialDate > 40000 && excelSerialDate < 50000) {
            // Convert Excel serial date to actual date for comparison
            const excelEpoch = new Date(1899, 11, 30);
            const actualDate = new Date(excelEpoch.getTime() + excelSerialDate * 24 * 60 * 60 * 1000);
            
            // Convert to comparable number (YYYYMMDD format)
            return actualDate.getFullYear() * 10000 + (actualDate.getMonth() + 1) * 100 + actualDate.getDate();
        }
    }
    
    return 0;
}

// Format Excel serial date for display
function formatExcelSerialDateToDisplay(dateValue) {
    if (!dateValue || dateValue === '-') return '';
    
    const dateStr = String(dateValue).trim();
    
    // Check if it's an Excel serial date number
    if (dateStr.match(/^\d{4,5}$/)) {
        const excelSerialDate = parseInt(dateStr);
        if (excelSerialDate > 40000 && excelSerialDate < 50000) {
            const excelEpoch = new Date(1899, 11, 30);
            const actualDate = new Date(excelEpoch.getTime() + excelSerialDate * 24 * 60 * 60 * 1000);
            
            // Format as dd/mm/yyyy
            const day = String(actualDate.getDate()).padStart(2, '0');
            const month = String(actualDate.getMonth() + 1).padStart(2, '0');
            const year = actualDate.getFullYear();
            
            return `${day}/${month}/${year}`;
        }
    }
    
    return dateValue;
}

// Get latest OJ date for display - check all available date fields and find the most recent
function getLatestOJDateForDisplay(standard) {
    const validDates = [];
    
    // Check all available date fields to find valid YYYY-MM-DD format dates
    const dateFields = [
        { value: standard.date, name: 'date' },                              // Original date field
        { value: standard.withdrawal_date, name: 'withdrawal_date' },        // Withdrawal date (working correctly for EN 50360:2017)
        { value: standard.date_of_start_presumption, name: 'date_of_start_presumption' },
        { value: standard.restriction_date, name: 'restriction_date' },
        { value: standard.withdrawal_date_col_j, name: 'withdrawal_date_col_j' }
    ];
    
    // Also check OJ reference strings for embedded dates
    const ojFields = [
        { value: standard.oj_reference, name: 'oj_reference' },
        { value: standard.restriction, name: 'restriction' },
        { value: standard.withdrawal_reference, name: 'withdrawal_reference' }
    ];
    
    // Process YYYY-MM-DD format dates
    dateFields.forEach(field => {
        if (field.value && field.value !== '-' && field.value.trim() !== '') {
            const dateMatch = field.value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
            if (dateMatch) {
                const year = parseInt(dateMatch[1]);
                const month = parseInt(dateMatch[2]);
                const day = parseInt(dateMatch[3]);
                
                // Convert to comparable number (YYYYMMDD format)
                const dateValue = year * 10000 + month * 100 + day;
                
                validDates.push({
                    value: dateValue,
                    original: field.value,
                    name: field.name,
                    type: 'date'
                });
            }
        }
    });
    
    // Process OJ reference strings for dd/mm/yyyy dates
    ojFields.forEach(field => {
        if (field.value && field.value !== '-' && field.value.trim() !== '') {
            const dateValue = extractDateFromOJString(field.value);
            if (dateValue > 0) {
                validDates.push({
                    value: dateValue,
                    original: field.value,
                    name: field.name,
                    type: 'oj_string'
                });
            }
        }
    });
    
    if (validDates.length === 0) {
        return ''; // No valid dates found
    }
    
    // Find the latest (newest) date
    const latestDate = validDates.reduce((latest, current) => {
        return current.value > latest.value ? current : latest;
    });
    
    // Format based on type
    if (latestDate.type === 'date') {
        return formatDateToDisplay(latestDate.original);
    } else {
        return formatOJDateForDisplay(latestDate.original);
    }
}

// Helper function to format YYYY-MM-DD to dd/mm/yyyy
function formatDateToDisplay(dateStr) {
    if (!dateStr || dateStr === '-') return '';
    
    const dateMatch = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (dateMatch) {
        const year = dateMatch[1];
        const month = dateMatch[2];
        const day = dateMatch[3];
        return `${day}/${month}/${year}`;
    }
    
    return dateStr;
}

// Format OJ date for display (extract and format dd/mm/yyyy)
function formatOJDateForDisplay(ojString) {
    if (!ojString || ojString === '-') return '';
    
    const dateMatch = ojString.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
    if (dateMatch) {
        return `${dateMatch[1]}/${dateMatch[2]}/${dateMatch[3]}`;
    }
    
    // If no dd/mm/yyyy found, return original for fallback
    return ojString;
}

// Get latest OJ reference for display based on latest date column (RED directive: E+1=F, H+1=I, J+1=K)
function getLatestOJReferenceForDisplay(standard) {
    // For RED directive, check date columns E, H, J (4, 7, 9) and use corresponding OJ reference columns F, I, K (5, 8, 10)
    const dateFieldsWithReferences = [
        {
            date: standard.date_of_start_presumption,  // Column E (4): Date
            reference: standard.oj_reference_col_f,    // Column F (5): OJ Reference
            name: 'date_of_start_presumption'
        },
        {
            date: standard.restriction_date,           // Column H (7): Date
            reference: standard.oj_reference_col_i,    // Column I (8): OJ Reference
            name: 'restriction_date'
        },
        {
            date: standard.withdrawal_date_col_j,      // Column J (9): Date
            reference: standard.oj_reference_col_k,    // Column K (10): OJ Reference
            name: 'withdrawal_date_col_j'
        }
    ];
    
    let latestDate = 0;
    let latestOJReference = '';
    
    // Find which date column has the latest date
    dateFieldsWithReferences.forEach(field => {
        if (field.date && field.date !== '-' && field.date.trim() !== '') {
            // Check if it's a valid date in YYYY-MM-DD format
            const dateMatch = field.date.match(/^(\d{4})-(\d{2})-(\d{2})$/);
            if (dateMatch) {
                const year = parseInt(dateMatch[1]);
                const month = parseInt(dateMatch[2]);
                const day = parseInt(dateMatch[3]);
                
                // Convert to comparable number (YYYYMMDD format)
                const dateValue = year * 10000 + month * 100 + day;
                
                // If this date is later than current latest, update latest
                if (dateValue > latestDate) {
                    latestDate = dateValue;
                    latestOJReference = field.reference || '';
                }
            }
        }
    });
    
    // If no valid date found in E, H, J columns, fall back to original logic
    if (latestDate === 0) {
        return standard.oj_reference || standard.restriction || standard.withdrawal_reference || '';
    }
    
    return latestOJReference;
}

// Render standards list (separated from displayStandards for reuse)
async function renderStandardsList(data) {
    const listElement = document.getElementById('standards-list');
    listElement.innerHTML = '';
    
    // Check scope matching for all standards (with caching)
    let scopeMatches = getScopeMatchesFromCache(data.standards);
    
    if (!scopeMatches) {
        try {
            const response = await apiCall('/scope-matcher', {
                method: 'POST',
                body: JSON.stringify({
                    oj_standards: data.standards.map(s => s.number || s.full_number)
                })
            });
            
            if (response.success) {
                scopeMatches = response.data.matches;
                // Cache the results
                setScopeMatchesInCache(data.standards, scopeMatches);
                
                console.log('Scope matching results (from API):', {
                    total_standards: response.data.total_standards,
                    a2la_matches: response.data.a2la_matches,
                    jab_matches: response.data.jab_matches,
                    debug: response.data.debug
                });
            
            if (response.data.debug) {
                console.log('Debug info:', response.data.debug);
                
                // Display server logs
                if (response.data.debug.server_logs && response.data.debug.server_logs.length > 0) {
                    console.log('=== SERVER LOGS ===');
                    response.data.debug.server_logs.forEach(log => console.log(log));
                    console.log('=== END SERVER LOGS ===');
                }
            }
        }
    } catch (error) {
        console.error('Scope matching failed:', error);
        console.error('Error details:', error.message);
        if (error.response) {
            console.error('Server response:', error.response);
        }
        // Continue without scope matching - don't show error to user
    }
    } else {
        console.log('Scope matching results (from cache):', {
            cached_matches: scopeMatches.length
        });
    }
    
    data.standards.forEach((standard, index) => {
        const matchData = scopeMatches ? scopeMatches[index] : null;
        const item = createStandardItem(standard, data.directive, matchData);
        listElement.appendChild(item);
    });
}

function addDownloadButton(directive) {
    const resultsSection = document.getElementById('standards-results');
    
    // Remove existing download button if present
    const existingButton = resultsSection.querySelector('.download-excel-btn');
    if (existingButton) {
        existingButton.remove();
    }
    
    // Add download button for Excel file
    const downloadButton = document.createElement('button');
    downloadButton.className = 'btn btn-secondary download-excel-btn';
    downloadButton.innerHTML = '<i class="fas fa-download"></i> Download Excel File';
    downloadButton.style.marginTop = '10px';
    downloadButton.onclick = () => downloadExcelFile(directive);
    
    const countElement = document.getElementById('standards-count');
    countElement.parentNode.insertBefore(downloadButton, countElement.nextSibling);
}

async function downloadExcelFile(directive) {
    try {
        showLoading();
        console.log(`Downloading Excel file for ${directive} directive`);
        
        const response = await fetch(`${API_BASE}/download-excel?directive=${directive}`);
        
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || `HTTP ${response.status}: ${response.statusText}`);
        }
        
        // Get filename from Content-Disposition header
        const contentDisposition = response.headers.get('Content-Disposition');
        let filename = `EU_Harmonised_Standards_${directive}_${new Date().toISOString().split('T')[0]}.xlsx`;
        
        if (contentDisposition) {
            const filenameMatch = contentDisposition.match(/filename="(.+)"/);
            if (filenameMatch) {
                filename = filenameMatch[1];
            }
        }
        
        const blob = await response.blob();
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
        
        showSuccess(`Excel file downloaded: ${filename}`);
    } catch (error) {
        console.error('Excel download failed:', error);
        showError(`Excel download failed: ${error.message}`);
    } finally {
        hideLoading();
    }
}

function createStandardItem(standard, directive = null, scopeMatch = null) {
    const item = document.createElement('div');
    item.className = 'standard-item';

    const directiveBadge = directive ? 
        `<span class="standard-directive">${directive}</span>` : '';

    // Excel-style display with all relevant information
    const displayNumber = standard.number || standard.full_number;
    const dateInfo = getLatestOJDateForDisplay(standard);
    const standardsLink = generateStandardLink(standard.number, standard.eso);
    const description = standard.description || standard.title || '';
    
    // Excel specific information
    const esoInfo = standard.eso || '';
    const ojReference = getLatestOJReferenceForDisplay(standard);
    const restriction = standard.restriction || '';
    const withdrawalDate = standard.withdrawal_date || '';
    const withdrawalRef = standard.withdrawal_reference || '';
    
    // Status determination
    const isWithdrawn = withdrawalDate && withdrawalDate !== '-' && withdrawalDate.trim() !== '';
    const statusClass = isWithdrawn ? 'withdrawn' : 'current';
    const statusText = isWithdrawn ? 'Withdrawn' : 'Current';
    const statusIcon = isWithdrawn ? 'fa-times-circle' : 'fa-check-circle';

    // Scope matching information
    const scopeMatchingInfo = createScopeMatchingInfo(scopeMatch);

    item.innerHTML = `
        <div class="standard-header">
            <div class="standard-number-container">
                <strong class="standard-number-bold">${displayNumber}</strong>
                ${dateInfo ? `<span class="standard-date">${dateInfo}</span>` : ''}
                ${directiveBadge}
                ${esoInfo ? `<span class="standard-eso">${esoInfo}</span>` : ''}
            </div>
            ${scopeMatchingInfo}
        </div>
        <div class="standard-description">${description}</div>
        <div class="standard-excel-info">
            ${ojReference ? `<div class="excel-field"><strong>OJ Reference:</strong> ${ojReference}</div>` : ''}
            ${restriction && restriction !== '-' ? `<div class="excel-field"><strong>Restriction:</strong> ${restriction}</div>` : ''}
            ${isWithdrawn ? `<div class="excel-field withdrawal"><strong>Withdrawal Date:</strong> ${formatExcelDate(withdrawalDate)} <strong>Ref:</strong> ${withdrawalRef}</div>` : ''}
        </div>
        <div class="standard-meta">
            <span class="standard-type"><i class="fas fa-bookmark"></i> Harmonised Standard</span>
            <span class="standard-status ${statusClass}"><i class="fas ${statusIcon}"></i> ${statusText}</span>
            ${standardsLink}
        </div>
    `;

    return item;
}

// Create scope matching information display
function createScopeMatchingInfo(scopeMatch) {
    if (!scopeMatch || !scopeMatch.scope_matches) {
        return '';
    }

    const { a2la, jab } = scopeMatch.scope_matches;
    
    let matchingInfo = '<div class="scope-matching-info">';
    matchingInfo += '<div class="scope-title">ISO17025 Certificate Scope:</div>';
    matchingInfo += '<div class="scope-badges">';
    
    // A2LA Badge
    const a2laBadge = createScopeBadge('A2LA', a2la);
    matchingInfo += a2laBadge;
    
    // JAB Badge
    const jabBadge = createScopeBadge('JAB', jab);
    matchingInfo += jabBadge;
    
    matchingInfo += '</div>';
    matchingInfo += '</div>';
    
    return matchingInfo;
}

// Create individual scope badge
function createScopeBadge(certType, matchData) {
    if (!matchData || matchData.status === 'no_match') {
        const noMatchTitle = getTranslation('scope.no_match');
        return `<span class="scope-badge no-match" title="${noMatchTitle}">
            <i class="fas fa-times-circle"></i> ${certType} ⚫
        </span>`;
    }
    
    let badgeClass = 'scope-badge ';
    let icon = '';
    let statusSymbol = '';
    let title = '';
    
    switch (matchData.status) {
        case 'exact_match':
            badgeClass += 'exact-match';
            icon = 'fa-check-circle';
            statusSymbol = '🟢';
            title = `${getTranslation('scope.exact_match')}: ${matchData.matched_standard}`;
            break;
        case 'comprehensive_match':
            badgeClass += 'comprehensive-match';
            icon = 'fa-check-circle';
            statusSymbol = '🟢';
            title = matchData.note ? `${translateScopeNote(matchData.note)}: ${matchData.matched_standard}` : `${getTranslation('scope.comprehensive_match')}: ${matchData.matched_standard}`;
            break;
        case 'version_tolerant_match':
            badgeClass += 'version-tolerant-match';
            icon = 'fa-check-circle';
            statusSymbol = '🟢';
            title = matchData.note ? `${translateScopeNote(matchData.note)}: ${matchData.matched_standard}` : `${getTranslation('scope.version_tolerant_match')}: ${matchData.matched_standard}`;
            break;
        case 'prefix_mismatch':
            badgeClass += 'prefix-mismatch';
            icon = 'fa-check-circle';
            statusSymbol = '🟢';
            title = matchData.note ? `${translateScopeNote(matchData.note)}: ${matchData.matched_standard}` : `${getTranslation('scope.prefix_mismatch')}: ${matchData.matched_standard}`;
            break;
        case 'version_mismatch':
            badgeClass += 'version-mismatch';
            icon = 'fa-check-circle';
            statusSymbol = '🟢';
            title = matchData.note ? `${translateScopeNote(matchData.note)}: ${matchData.matched_standard}` : `${getTranslation('scope.version_mismatch')}: ${matchData.matched_standard}`;
            break;
        default:
            return createScopeBadge(certType, { status: 'no_match' });
    }
    
    const facilityInfo = matchData.facility ? ` (${matchData.facility})` : '';
    const clickHandler = matchData.anchor ? 
        `onclick="openScopeDetails('${certType.toLowerCase()}', '${matchData.anchor}')"` : '';
    
    // Translate the note if it exists
    const translatedNote = matchData.note ? translateScopeNote(matchData.note) : '';
    
    return `<span class="${badgeClass}" title="${title}${facilityInfo}" ${clickHandler}>
        <i class="fas ${icon}"></i> ${certType} ${statusSymbol}
        ${translatedNote ? `<span class="scope-note">⚠️ ${translatedNote}</span>` : ''}
    </span>`;
}

// Open scope details in MD file
async function openScopeDetails(certType, anchor) {
    try {
        const response = await apiCall(`/scope-detail?cert_type=${certType}&anchor=${encodeURIComponent(anchor)}`);
        if (!response.success) throw new Error(response.error || 'Scope detail not found');
        renderScopeDetailModal(certType, response.data);
    } catch (error) {
        console.error('Failed to load scope detail:', error);
        showError(`Failed to load scope detail: ${error.message}`);
    }
}

function renderScopeDetailModal(certType, data) {
    document.getElementById('scope-detail-title').textContent = data.category || `${certType.toUpperCase()} scope`;

    const facility = data.facility
        ? `<p class="muted">${esc(data.facility.name)}${data.facility.location ? `（${esc(data.facility.location)}）` : ''}</p>`
        : '';

    const rows = data.items.map(it => `
        <li><strong>${esc(it.standard)}</strong>${it.description ? ` <span class="muted">— ${esc(it.description)}</span>` : ''}</li>
    `).join('');

    const certNo = data.certificate_info?.certificate_number || '-';
    const certUntil = data.certificate_info?.valid_until || '-';
    const sourceLabel = data.source === 'd1' ? t('quick.detail_source_db') : t('quick.detail_source_md');
    const pdfUrl = `/certificates/${certType}.pdf`;

    document.getElementById('scope-detail-body').innerHTML = `
        ${facility}
        <ul class="scope-detail-list">${rows}</ul>
        <div class="scope-detail-footer">
            <span class="muted">${esc(certType.toUpperCase())} ${esc(certNo)} ・ ${esc(t('quick.detail_valid_until'))} ${esc(certUntil)} ・ ${esc(sourceLabel)}</span>
            <a href="${esc(pdfUrl)}" target="_blank" rel="noopener noreferrer" class="btn btn-small btn-outline">
                <i class="fas fa-file-pdf"></i> ${esc(t('quick.detail_open_pdf'))}
            </a>
        </div>
    `;
    scopeDetailModal.classList.remove('hidden');
}

// Add click handler for CEN/CENELEC links to copy standard number to clipboard
document.addEventListener('click', function(e) {
    if (e.target.closest('.cen-cenelec-link')) {
        const link = e.target.closest('.cen-cenelec-link');
        const standardNumber = link.getAttribute('data-standard');
        
        if (standardNumber) {
            // Clean standard number - remove EN, ETSI, CEN, CENELEC prefixes and keep only the number part
            const cleanedNumber = cleanStandardNumber(standardNumber);
            
            // Copy cleaned number to clipboard
            navigator.clipboard.writeText(cleanedNumber).then(() => {
                // Show brief notification
                showBriefNotification(`Copied "${cleanedNumber}" to clipboard. Paste it in the Standard Reference field.`);
            }).catch(() => {
                // Fallback for older browsers
                console.log(`Standard number: ${cleanedNumber}`);
            });
        }
    }
});

function showBriefNotification(message) {
    // Create notification element
    const notification = document.createElement('div');
    notification.className = 'copy-notification';
    notification.textContent = message;
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: #4caf50;
        color: white;
        padding: 12px 20px;
        border-radius: 6px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        z-index: 10000;
        font-size: 14px;
        max-width: 300px;
        opacity: 0;
        transform: translateX(100px);
        transition: all 0.3s ease;
    `;
    
    document.body.appendChild(notification);
    
    // Animate in
    setTimeout(() => {
        notification.style.opacity = '1';
        notification.style.transform = 'translateX(0)';
    }, 10);
    
    // Remove after 3 seconds
    setTimeout(() => {
        notification.style.opacity = '0';
        notification.style.transform = 'translateX(100px)';
        setTimeout(() => {
            if (notification.parentNode) {
                notification.parentNode.removeChild(notification);
            }
        }, 300);
    }, 3000);
}

function cleanStandardNumber(standardNumber) {
    // Remove common prefixes and clean up the standard number
    let cleaned = standardNumber;
    
    // Remove EN prefix
    cleaned = cleaned.replace(/^EN\s+/i, '');
    
    // Remove ETSI prefix (if any)
    cleaned = cleaned.replace(/^ETSI\s+/i, '');
    
    // Remove EN IEC, EN ISO patterns
    cleaned = cleaned.replace(/^EN\s+(IEC|ISO)\s+/i, '');
    
    // Remove any remaining leading/trailing whitespace
    cleaned = cleaned.trim();
    
    return cleaned;
}

function formatExcelDate(dateValue) {
    if (!dateValue || dateValue === '-' || dateValue.trim() === '') return '';
    
    // Handle Excel serial date numbers
    if (dateValue.match(/^\d{4,5}$/)) {
        const excelSerialDate = parseInt(dateValue);
        if (excelSerialDate > 40000 && excelSerialDate < 50000) {
            const excelEpoch = new Date(1899, 11, 30);
            const actualDate = new Date(excelEpoch.getTime() + excelSerialDate * 24 * 60 * 60 * 1000);
            return actualDate.toLocaleDateString('en-GB', { 
                day: '2-digit', 
                month: '2-digit', 
                year: 'numeric' 
            });
        }
    }
    
    // If already formatted date
    if (dateValue.includes('/') || dateValue.includes('-')) {
        try {
            const date = new Date(dateValue);
            if (!isNaN(date.getTime())) {
                return date.toLocaleDateString('en-GB', { 
                    day: '2-digit', 
                    month: '2-digit', 
                    year: 'numeric' 
                });
            }
        } catch (e) {
            // Return as-is if can't parse
            return dateValue;
        }
    }
    
    return dateValue;
}

function formatETSIStandardNumber(standard) {
    // ETSI format: EN [series]-[part] V[version] or EN [series] V[version]
    let number = standard.number || '';
    let version = standard.version || '';
    
    // Clean up version format to match ETSI style
    if (version && !version.startsWith('V') && !version.startsWith('(')) {
        if (version.match(/^\d+\.\d+\.\d+$/)) {
            version = `V${version}`;
        }
    }
    
    // Combine number and version in ETSI style
    if (version && version.startsWith('V')) {
        return `${number} ${version}`;
    } else if (version && version.startsWith('(')) {
        return `${number} ${version}`;
    }
    
    return number;
}

function formatETSIDate(dateValue) {
    if (!dateValue) return '';
    
    // Convert various date formats to ETSI (YYYY-MM) format
    if (dateValue.length === 4) {
        // Year only format
        return `(${dateValue})`;
    } else if (dateValue.match(/^\d{4}-\d{2}$/)) {
        // Already in YYYY-MM format
        return `(${dateValue})`;
    } else if (dateValue.match(/^\d{4}-\d{2}-\d{2}$/)) {
        // Convert YYYY-MM-DD to YYYY-MM
        return `(${dateValue.substring(0, 7)})`;
    }
    
    return `(${dateValue})`;
}

function formatETSITitle(title) {
    if (!title) return '';
    
    // Clean up title formatting to match ETSI style
    return title
        .replace(/^[-–—]\s*/, '') // Remove leading dashes
        .replace(/\s+/g, ' ')     // Normalize spaces
        .trim();
}

function generateStandardLink(standardNumber, eso) {
    // Generate appropriate portal link based on ESO (European Standards Organization)
    const searchTerm = encodeURIComponent(standardNumber);
    
    if (eso && (eso.toUpperCase() === 'CEN' || eso.toUpperCase() === 'CENELEC')) {
        // CEN-CENELEC portal for CEN and CENELEC standards - go to search page
        const cenUrl = 'https://standards.cencenelec.eu/dyn/www/f?p=CEN:105::RESET::::';
        const portalName = eso.toUpperCase() === 'CEN' ? 'CEN Portal' : 'CENELEC Portal';
        
        return `<a href="${cenUrl}" target="_blank" class="standards-portal-link cen-cenelec-link" 
                    title="Search for ${standardNumber} in ${portalName}" 
                    data-standard="${standardNumber}">
            <i class="fas fa-external-link-alt"></i> ${portalName}
        </a>`;
    } else {
        // ETSI portal for ETSI standards and fallback
        const today = new Date().toISOString().split('T')[0];
        const etsiUrl = `https://www.etsi.org/standards#page=1&search=${searchTerm}&title=0&etsiNumber=1&content=0&version=0&onApproval=1&published=1&withdrawn=1&historical=1&isCurrent=1&superseded=1&startDate=1988-01-15&endDate=${today}&harmonized=0&keyword=&TB=&stdType=&frequency=&mandate=&collection=&sort=1`;
        
        return `<a href="${etsiUrl}" target="_blank" class="standards-portal-link etsi-link">
            <i class="fas fa-external-link-alt"></i> ETSI Portal
        </a>`;
    }
}

async function searchStandards(portal = 'etsi') {
    const query = document.getElementById('search-input').value.trim();
    
    if (!query) {
        showError('Please enter a search query');
        return;
    }

    if (portal === 'etsi') {
        // Redirect to ETSI Portal search
        const searchTerm = encodeURIComponent(query);
        const today = new Date().toISOString().split('T')[0];
        const etsiSearchUrl = `https://www.etsi.org/standards#page=1&search=${searchTerm}&title=0&etsiNumber=1&content=0&version=0&onApproval=1&published=1&withdrawn=1&historical=1&isCurrent=1&superseded=1&startDate=1988-01-15&endDate=${today}&harmonized=0&keyword=&TB=&stdType=&frequency=&mandate=&collection=&sort=1`;
        
        console.log(`Redirecting to ETSI portal search for: ${query}`);
        window.open(etsiSearchUrl, '_blank');
        
        showSuccess(`Opening ETSI portal search for "${query}" in a new tab`);
    } else if (portal === 'cen') {
        // Clean the search term and copy to clipboard, then open CEN-CENELEC portal
        const cleanedQuery = cleanStandardNumber(query);
        const cenUrl = 'https://standards.cencenelec.eu/dyn/www/f?p=CEN:105::RESET::::';
        
        // Copy cleaned search term to clipboard
        try {
            await navigator.clipboard.writeText(cleanedQuery);
            showBriefNotification(`Copied "${cleanedQuery}" to clipboard. Paste it in the Standard Reference field.`);
        } catch (err) {
            console.log(`Search term: ${cleanedQuery}`);
        }
        
        console.log(`Redirecting to CEN-CENELEC portal for: ${query} (cleaned: ${cleanedQuery})`);
        window.open(cenUrl, '_blank');
        
        showSuccess(`Opening CEN-CENELEC portal for "${query}" in a new tab. Search term copied to clipboard.`);
    }
}

function displaySearchResults(data) {
    const resultsSection = document.getElementById('search-results');
    const countElement = document.getElementById('search-count');
    const listElement = document.getElementById('search-list');

    countElement.textContent = `${data.count} results`;
    
    listElement.innerHTML = '';
    
    if (data.results.length === 0) {
        listElement.innerHTML = '<p class="text-center">No standards found matching your query.</p>';
    } else {
        data.results.forEach(standard => {
            const item = createStandardItem(standard, standard.directive);
            listElement.appendChild(item);
        });
    }

    resultsSection.classList.remove('hidden');
}

function exportStandards() {
    const standardItems = document.querySelectorAll('#standards-list .standard-item');
    
    if (standardItems.length === 0) {
        showError('No standards to export');
        return;
    }

    // Get directive from current standards data instead of DOM scraping
    const directive = currentStandardsData?.directive || 'Unknown';

    const standards = [];
    standardItems.forEach(item => {
        const numberElement = item.querySelector('.standard-number-bold');
        const descriptionElement = item.querySelector('.standard-description');
        
        if (numberElement && descriptionElement) {
            const number = numberElement.textContent;
            const description = descriptionElement.textContent;
            
            standards.push({
                directive,
                number: number.trim(),
                title: description.trim()
            });
        }
    });

    const csvContent = generateCSV(standards);
    downloadFile(csvContent, 'eu-harmonized-standards.csv', 'text/csv');
    
    showSuccess(`Exported ${standards.length} standards to CSV file`);
}

function generateCSV(data) {
    const headers = ['Directive', 'Standard Number', 'Title'];
    const rows = data.map(item => [
        item.directive,
        item.number,
        item.title.replace(/"/g, '""') // Escape quotes
    ]);

    const csvContent = [headers, ...rows]
        .map(row => row.map(field => `"${field}"`).join(','))
        .join('\n');

    return csvContent;
}

function downloadFile(content, filename, mimeType) {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
}

// Certificate selection functions
function handleCertificateTypeChange(e) {
    const selectedType = e.target.value;
    const loadBtn = document.getElementById('load-certificate-btn');
    
    if (selectedType) {
        loadBtn.disabled = false;
        const buttonKey = selectedType === 'a2la' ? 'certificate.load_a2la' : 'certificate.load_jab';
        loadBtn.innerHTML = `<i class="fas fa-download"></i> ${t(buttonKey)}`;
    } else {
        loadBtn.disabled = true;
        loadBtn.innerHTML = `<i class="fas fa-download"></i> ${t('certificate.load_btn')}`;
    }
}

async function loadCertificateData() {
    const selectedType = document.getElementById('certificate-type-select').value;
    
    if (!selectedType) {
        showError('Please select a valid certificate type');
        return;
    }
    
    showLoading();
    
    try {
        console.log(`Loading certificate data for: ${selectedType}`);
        
        // Load certificate data from MD files via API
        const response = await apiCall(`/certificate-data?cert_type=${selectedType}`, {
            method: 'GET'
        });

        if (response.success) {
            const certificateData = response.data;
            
            // Set global variable
            uploadedCertificateData = certificateData;
            
            // Display the results
            displayCertificateResults(certificateData, selectedType);
            
            const src = certificateData.source === 'd1' ? 'D1 database' : 'MD file';
            showSuccess(`${selectedType.toUpperCase()} certificate data loaded successfully! (${certificateData.total_standards ?? certificateData.test_standards.length} standards from ${src})`);
        } else {
            throw new Error(response.error || 'Certificate data loading failed');
        }
        
    } catch (error) {
        console.error('Error loading certificate data:', error);
        showError(`Failed to load certificate data: ${error.message}`);
    } finally {
        hideLoading();
    }
}

// categorizeStandards function removed - categories now come from MD files via API

/** カテゴリ/施設一覧の1規格分。anchor があれば「詳細を見る」（D1詳細モーダル → 認定書PDF）を添える */
function standardLine(std, certType) {
    if (typeof std === 'string') return `<li>${esc(std)}</li>`;
    const link = std.anchor
        ? ` <button class="btn-link" onclick="openScopeDetails('${certType}', '${esc(std.anchor)}')" title="Scope detail"><i class="fas fa-circle-info"></i> ${esc(t('quick.detail_link'))}</button>`
        : '';
    return `<li><strong>${esc(std.standard || std)}</strong>${std.description ? ' - ' + esc(std.description) : ''}${link}</li>`;
}

function displayCertificateResults(data, certType) {
    const resultsSection = document.getElementById('certificate-results');

    // Update certificate info
    document.getElementById('cert-number').textContent = data.certificate_info.certificate_number || '-';
    document.getElementById('cert-organization').textContent = data.certificate_info.organization || '-';
    document.getElementById('cert-valid-until').textContent = data.certificate_info.valid_until || '-';

    const pdfWrap = document.getElementById('cert-pdf-link-wrap');
    if (pdfWrap) {
        pdfWrap.innerHTML = `<a href="/certificates/${certType}.pdf" target="_blank" rel="noopener noreferrer" class="btn btn-small btn-outline"><i class="fas fa-file-pdf"></i> ${esc(t('quick.detail_open_pdf'))}</a>`;
    }

    // Display categories or facilities based on certificate type
    const categoriesElement = document.getElementById('standards-categories');
    categoriesElement.innerHTML = '';

    if (data.certificate_type === 'JAB_MD_Dynamic' && data.facilities) {
        // JAB style display with facilities
        data.facilities.forEach(facility => {
            const facilityItem = document.createElement('div');
            facilityItem.className = 'facility-item';
            
            // Standards are already included in facility object from API
            const facilityStandards = facility.standards || [];
            
            // Group standards by category for this facility
            const facilityCategories = {};
            facilityStandards.forEach(standard => {
                const category = standard.category;
                if (!facilityCategories[category]) {
                    facilityCategories[category] = [];
                }
                facilityCategories[category].push(standard);
            });

            facilityItem.innerHTML = `
                <div class="facility-header">
                    <h4>【施設${facility.facility_number}】${facility.name}（${facility.location}）</h4>
                </div>
                <div class="facility-categories">
                    ${Object.entries(facilityCategories).map(([category, standards]) => `
                        <div class="category-item">
                            <div class="category-header" onclick="toggleCategory(this)">
                                <span class="category-name">${category}</span>
                                <span class="category-count">${standards.length}</span>
                            </div>
                            <div class="category-standards">
                                <ul>
                                    ${standards.map(std => standardLine(std, certType)).join('')}
                                </ul>
                            </div>
                        </div>
                    `).join('')}
                </div>
            `;

            categoriesElement.appendChild(facilityItem);
        });
    } else {
        // A2LA style display with categories
        Object.entries(data.categories).forEach(([category, standards]) => {
            const categoryItem = document.createElement('div');
            categoryItem.className = 'category-item';

            categoryItem.innerHTML = `
                <div class="category-header" onclick="toggleCategory(this)">
                    <span class="category-name">${category}</span>
                    <span class="category-count">${standards.length}</span>
                </div>
                <div class="category-standards">
                    <ul>
                        ${standards.map(std => standardLine(std, certType)).join('')}
                    </ul>
                </div>
            `;

            categoriesElement.appendChild(categoryItem);
        });
    }

    resultsSection.classList.remove('hidden');
}

function toggleCategory(header) {
    const standards = header.nextElementSibling;
    standards.classList.toggle('active');
}

// Scope search functions
async function performScopeSearch() {
    const searchQuery = document.getElementById('scope-search-input').value.trim();
    
    if (!searchQuery) {
        showError('Please enter a standard number to search');
        return;
    }

    try {
        showLoading();
        console.log('Searching scopes for:', searchQuery);
        
        const response = await apiCall('/scope-search', {
            method: 'POST',
            body: JSON.stringify({
                search_query: searchQuery
            })
        });

        if (response.success) {
            displayScopeSearchResults(response.data, searchQuery);
            showSuccess(`Found ${response.data.total_matches} matches for "${searchQuery}"`);
        } else {
            throw new Error(response.error || 'Scope search failed');
        }
    } catch (error) {
        console.error('Scope search failed:', error);
        showError(`Scope search failed: ${error.message}`);
    } finally {
        hideLoading();
    }
}

function clearScopeSearch() {
    document.getElementById('scope-search-input').value = '';
    document.getElementById('scope-search-results').classList.add('hidden');
}

function displayScopeSearchResults(data, searchQuery) {
    const resultsSection = document.getElementById('scope-search-results');
    const contentElement = document.getElementById('scope-search-content');
    
    contentElement.innerHTML = '';
    
    if (data.total_matches === 0) {
        contentElement.innerHTML = `
            <div class="no-results">
                <p><i class="fas fa-search"></i> No matches found for "${searchQuery}"</p>
                <p class="search-tip">Try searching with partial standard numbers (e.g., "55032", "61000-4-2")</p>
            </div>
        `;
        resultsSection.classList.remove('hidden');
        return;
    }
    
    // A2LA Results
    if (data.a2la_matches && data.a2la_matches.length > 0) {
        const a2laSection = document.createElement('div');
        a2laSection.className = 'search-results-section';
        a2laSection.innerHTML = `
            <h6><i class="fas fa-certificate"></i> A2LA Certificate (${data.a2la_matches.length} matches)</h6>
            <div class="search-matches">
                ${data.a2la_matches.map(match => createScopeSearchResult(match, 'a2la')).join('')}
            </div>
        `;
        contentElement.appendChild(a2laSection);
    }
    
    // JAB Results
    if (data.jab_matches && data.jab_matches.length > 0) {
        const jabSection = document.createElement('div');
        jabSection.className = 'search-results-section';
        jabSection.innerHTML = `
            <h6><i class="fas fa-certificate"></i> JAB Certificate (${data.jab_matches.length} matches)</h6>
            <div class="search-matches">
                ${data.jab_matches.map(match => createScopeSearchResult(match, 'jab')).join('')}
            </div>
        `;
        contentElement.appendChild(jabSection);
    }
    
    resultsSection.classList.remove('hidden');
}

function createScopeSearchResult(match, certType) {
    const matchTypeIcon = match.match_type === 'exact' ? 'fa-check-circle' : 
                         match.match_type === 'prefix_mismatch' ? 'fa-check-circle' :
                         match.match_type === 'version_mismatch' ? 'fa-check-circle' : 'fa-search';
    
    const matchTypeClass = match.match_type === 'exact' ? 'exact-match' :
                          match.match_type === 'prefix_mismatch' ? 'prefix-mismatch' :
                          match.match_type === 'version_mismatch' ? 'version-mismatch' : 'partial-match';
    
    const facilityInfo = match.facility ? `<span class="facility-info">${match.facility}</span>` : '';
    const translatedNote = match.note ? translateScopeNote(match.note) : '';
    const noteInfo = translatedNote ? `<span class="match-note">⚠️ ${translatedNote}</span>` : '';
    
    return `
        <div class="scope-search-match ${matchTypeClass}">
            <div class="match-header">
                <i class="fas ${matchTypeIcon}"></i>
                <strong class="standard-number">${match.standard}</strong>
                ${facilityInfo}
            </div>
            <div class="match-description">${match.description || ''}</div>
            ${noteInfo}
            <div class="match-actions">
                <button class="btn-link" onclick="openScopeDetails('${certType}', '${match.anchor}')">
                    <i class="fas fa-external-link-alt"></i> View Details
                </button>
            </div>
        </div>
    `;
}

// Utility functions
function showLoading() {
    loadingOverlay.classList.remove('hidden');
}

function hideLoading() {
    loadingOverlay.classList.add('hidden');
}

function showError(message) {
    document.getElementById('error-message').textContent = message;
    errorModal.classList.remove('hidden');
}

function showSuccess(message) {
    document.getElementById('success-message').textContent = message;
    successModal.classList.remove('hidden');
}

function closeModals() {
    errorModal.classList.add('hidden');
    successModal.classList.add('hidden');
    scopeDetailModal.classList.add('hidden');
}

// Standards search in fetched results
function performStandardsSearch() {
    const searchQuery = document.getElementById('standards-search-input').value.trim().toLowerCase();
    
    if (!searchQuery) {
        clearStandardsSearch();
        return;
    }
    
    if (!currentStandardsData) {
        showError('No standards data to search');
        return;
    }
    
    // Filter standards based on search query (space-insensitive)
    const searchQueryNoSpaces = searchQuery.replace(/\s+/g, '');
    
    const filteredStandards = currentStandardsData.standards.filter(standard => {
        const searchFields = [
            standard.number || '',
            standard.full_number || '',
            standard.title || '',
            standard.description || ''
        ].join(' ').toLowerCase();
        
        // Check both normal search and space-insensitive search
        const normalMatch = searchFields.includes(searchQuery);
        const spaceInsensitiveMatch = searchFields.replace(/\s+/g, '').includes(searchQueryNoSpaces);
        
        return normalMatch || spaceInsensitiveMatch;
    });
    
    // Create filtered data object
    const filteredData = {
        ...currentStandardsData,
        standards: filteredStandards,
        count: filteredStandards.length
    };
    
    // Update display with filtered results
    displayFilteredStandards(filteredData, searchQuery);
}

function clearStandardsSearch() {
    document.getElementById('standards-search-input').value = '';
    
    if (currentStandardsData) {
        // Restore original display
        displayFilteredStandards(currentStandardsData, '');
    }
}

async function displayFilteredStandards(data, searchQuery) {
    const resultsSection = document.getElementById('standards-results');
    const countElement = document.getElementById('standards-count');
    const listElement = document.getElementById('standards-list');

    // Update count with search info
    if (searchQuery) {
        countElement.innerHTML = `
            <span>${data.count} standards</span>
            <small class="search-indicator">
                <i class="fas fa-search"></i> Filtered by: "${searchQuery}"
            </small>
        `;
    } else {
        countElement.textContent = `${data.count} standards`;
    }
    
    listElement.innerHTML = '';
    
    if (data.count === 0) {
        if (searchQuery) {
            listElement.innerHTML = `
                <div class="no-results search-no-results">
                    <i class="fas fa-search"></i>
                    <h4>No standards found</h4>
                    <p>No standards match your search term: "${searchQuery}"</p>
                    <button onclick="clearStandardsSearch()" class="btn btn-small btn-outline">
                        <i class="fas fa-times"></i> Clear Search
                    </button>
                </div>
            `;
        } else {
            listElement.innerHTML = '<div class="no-results"><p>No standards found</p></div>';
        }
        return;
    }
    
    // Render filtered standards (scope matching is handled inside renderStandardsList)
    renderStandardsList(data);
}

// Keyboard shortcuts
document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape') {
        closeModals();
    }
});

// Handle errors globally
window.addEventListener('error', function(e) {
    console.error('Global error:', e.error);
    showError('An unexpected error occurred. Please try again.');
});

window.addEventListener('unhandledrejection', function(e) {
    console.error('Unhandled promise rejection:', e.reason);
    showError('An unexpected error occurred. Please try again.');
});

// Service Worker registration (optional, for PWA features)
if ('serviceWorker' in navigator) {
    window.addEventListener('load', function() {
        // Uncomment to register service worker
        // navigator.serviceWorker.register('/sw.js')
        //     .then(function(registration) {
        //         console.log('SW registered: ', registration);
        //     })
        //     .catch(function(registrationError) {
        //         console.log('SW registration failed: ', registrationError);
        //     });
    });
}

// ===========================================================================
// Identity (Cloudflare Access) & runtime info
// ===========================================================================
async function loadIdentity() {
    try {
        const res = await fetch(`${API_BASE}/me`);
        if (!res.ok) return;
        const json = await res.json();
        if (json.success && json.data.email) {
            document.getElementById('user-email').textContent = json.data.email;
            document.getElementById('user-badge').classList.remove('hidden');
        }
        const rt = document.getElementById('app-runtime');
        if (rt) rt.textContent = 'Cloudflare Workers';
    } catch (e) {
        console.debug('identity not available', e);
    }
}

// ===========================================================================
// Quick Check（営業向け）
// ===========================================================================
let lastQuickResult = null;

const esc = (v) => String(v ?? '').replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));

function verdictLabel(v) {
    return v === 'ok' ? 'OK' : v === 'check' ? 'CHECK' : 'NG';
}

/** 同じ規格・同じ施設の alternatives（試験区分違いだけ）をまとめて件数表示にする */
function summarizeAlternatives(alternatives) {
    const order = [];
    const counts = new Map();
    for (const a of alternatives) {
        const facilityShort = a.facility ? a.facility.replace(/:.*$/, '') : '';
        const key = `${a.matched_standard}|${facilityShort}`;
        if (!counts.has(key)) { counts.set(key, 0); order.push({ key, standard: a.matched_standard, facility: facilityShort }); }
        counts.set(key, counts.get(key) + 1);
    }
    return order.map(o => {
        const label = o.standard + (o.facility ? ` (${o.facility})` : '');
        const n = counts.get(o.key);
        return n > 1 ? `${label} ×${n}` : label;
    });
}

function scopeCell(certType, m) {
    if (!m || m.status === 'no_match') {
        return `<span class="verdict-badge verdict-ng small">NG</span> <span class="muted">${esc(t('quick.no_scope'))}</span>`;
    }
    const note = m.note ? `<span class="scope-note">${esc(translateScopeNote(m.note))}</span>` : '';
    const facility = m.facility ? `<span class="facility-info">${esc(m.facility)}</span>` : '';
    const link = m.anchor ? `<button class="btn-link" onclick="openScopeDetails('${certType}', '${esc(m.anchor)}')" title="Scope detail"><i class="fas fa-circle-info"></i> ${esc(t('quick.detail_link'))}</button>` : '';
    const alts = (m.alternatives || []).length
        ? `<div class="quick-alts">${esc(t('quick.also'))}: ${summarizeAlternatives(m.alternatives).map(esc).join(' / ')}</div>`
        : '';
    return `<span class="verdict-badge verdict-${m.verdict} small">${verdictLabel(m.verdict)}</span> <strong>${esc(m.matched_standard)}</strong> ${link}<br>${facility} ${note}${alts}`;
}

function ojCell(item) {
    if (item.oj_status === 'not_listed') return `<span class="oj-pill oj-none">${esc(t('quick.oj_not_listed'))}</span>`;
    const pillClass = item.oj_status === 'harmonised' ? 'oj-listed' : 'oj-withdrawn';
    const label = item.oj_status === 'harmonised' ? t('quick.oj_harmonised') : t('quick.oj_withdrawn');
    const edition = item.core && !item.oj_version_match && /\d{4}|V\d/.test(item.input) ? ` <span class="muted">(${esc(t('quick.oj_other_edition'))})</span>` : '';
    const rows = item.oj.slice(0, 4).map(o => {
        const wd = o.withdrawal_date ? ` <span class="muted">→ ${esc(o.withdrawal_date)}</span>` : '';
        return `<div class="oj-row"><span class="oj-directive">${esc(o.directive)}</span> ${esc(o.number)}${wd}</div>`;
    }).join('');
    const more = item.oj.length > 4 ? `<div class="muted">+${item.oj.length - 4}</div>` : '';
    return `<span class="oj-pill ${pillClass}">${esc(label)}</span>${edition}${rows}${more}`;
}

async function runQuickCheck() {
    const text = document.getElementById('quick-input').value.trim();
    if (!text) { showError(t('quick.empty')); return; }
    try {
        const response = await apiCall('/quick-check', { method: 'POST', body: JSON.stringify({ text }) });
        if (!response.success) throw new Error(response.error || 'Quick check failed');
        lastQuickResult = response.data;
        renderQuickResults(response.data);
    } catch (error) {
        console.error('Quick check failed:', error);
        showError(`Quick check failed: ${error.message}`);
    }
}

function renderQuickResults(data) {
    const tbody = document.getElementById('quick-tbody');
    tbody.innerHTML = data.items.map(item => `
        <tr class="row-${item.verdict}">
            <td class="quick-std"><strong>${esc(item.input)}</strong></td>
            <td class="quick-verdict"><span class="verdict-badge verdict-${item.verdict}">${verdictLabel(item.verdict)}</span></td>
            <td>${scopeCell('jab', item.jab)}</td>
            <td>${scopeCell('a2la', item.a2la)}</td>
            <td class="quick-oj">${ojCell(item)}</td>
        </tr>`).join('');

    const s = data.summary;
    document.getElementById('quick-summary').textContent = t('quick.summary', { total: data.input_count, ok: s.ok, check: s.check, ng: s.ng });

    const ojSrc = Object.entries(data.sources.oj || {}).map(([d, v]) => `${d} ${v.count ?? '?'}${v.source ? ` (${v.source})` : ''}`).join(', ');
    document.getElementById('quick-sources').textContent = t('quick.sources', {
        jab_no: data.sources.jab.certificate_number || '-', jab_until: data.sources.jab.valid_until || '-',
        a2la_no: data.sources.a2la.certificate_number || '-', a2la_until: data.sources.a2la.valid_until || '-',
        oj: ojSrc, at: new Date(data.checked_at).toLocaleString(),
    });

    const results = document.getElementById('quick-results');
    results.classList.remove('hidden');
    results.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function quickRowsForExport() {
    if (!lastQuickResult) return [];
    const scopeText = m => (!m || m.status === 'no_match') ? 'NG' : `${verdictLabel(m.verdict)}: ${m.matched_standard}${m.facility ? ` (${m.facility})` : ''}${m.note ? ` [${translateScopeNote(m.note)}]` : ''}`;
    const ojText = it => it.oj_status === 'not_listed' ? t('quick.oj_not_listed') : `${it.oj_status === 'harmonised' ? t('quick.oj_harmonised') : t('quick.oj_withdrawn')}: ${it.oj.map(o => `${o.directive} ${o.number}${o.withdrawal_date ? ` (→${o.withdrawal_date})` : ''}`).join('; ')}`;
    const header = [t('quick.col_standard'), t('quick.col_verdict'), 'JAB', 'A2LA', t('quick.col_oj')];
    return [header, ...lastQuickResult.items.map(it => [it.input, verdictLabel(it.verdict), scopeText(it.jab), scopeText(it.a2la), ojText(it)])];
}

async function copyQuickResults() {
    const rows = quickRowsForExport();
    if (!rows.length) return;
    const tsv = rows.map(r => r.map(v => String(v).replace(/\t/g, ' ')).join('\t')).join('\n');
    try {
        await navigator.clipboard.writeText(tsv);
        showBriefNotification(t('quick.copied', { n: rows.length - 1 }));
    } catch (e) {
        showError('Clipboard not available');
    }
}

function downloadQuickCsv() {
    const rows = quickRowsForExport();
    if (!rows.length) return;
    const csv = '﻿' + rows.map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\r\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `quick-check_${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(a.href);
}
