// EU Harmonized Standards Checker - Frontend JavaScript
// Pure JavaScript implementation for Netlify deployment

// Global variables
let uploadedCertificateData = null;

// API configuration - Netlify Functions
const API_BASE = '/.netlify/functions';

// DOM elements
const loadingOverlay = document.getElementById('loading-overlay');
const errorModal = document.getElementById('error-modal');
const successModal = document.getElementById('success-modal');

// Initialize the application
document.addEventListener('DOMContentLoaded', function() {
    initializeApp();
});

async function initializeApp() {
    setupEventListeners();
    await loadDirectives();
    console.log('EU Harmonized Standards Checker initialized');
}

function setupEventListeners() {
    // Tab navigation
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', () => switchTab(btn.dataset.tab));
    });

    // Standards tab
    document.getElementById('fetch-standards-btn').addEventListener('click', fetchStandards);
    document.getElementById('export-standards-btn').addEventListener('click', exportStandards);

    // Search tab
    document.getElementById('search-btn').addEventListener('click', searchStandards);
    document.getElementById('search-input').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') searchStandards();
    });

    // Certificate tab
    const uploadArea = document.getElementById('upload-area');
    const fileInput = document.getElementById('file-input');

    uploadArea.addEventListener('click', () => fileInput.click());
    uploadArea.addEventListener('dragover', handleDragOver);
    uploadArea.addEventListener('dragleave', handleDragLeave);
    uploadArea.addEventListener('drop', handleDrop);
    fileInput.addEventListener('change', handleFileSelect);

    // Compare tab
    document.getElementById('single-compare-btn').addEventListener('click', singleCompare);
    document.getElementById('batch-compare-btn').addEventListener('click', batchCompare);

    // Modals
    document.querySelectorAll('.close').forEach(closeBtn => {
        closeBtn.addEventListener('click', closeModals);
    });

    // Close modals on outside click
    [errorModal, successModal].forEach(modal => {
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

    // Special handling for compare tab
    if (tabName === 'compare') {
        updateCompareTabState();
    }
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
        const selects = ['directive-select', 'compare-directive-select'];
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
    } catch (error) {
        console.error('Failed to load directives:', error);
        showError(`Failed to load directives: ${error.message}`);
    }
}

// Standards functions
async function fetchStandards() {
    const directive = document.getElementById('directive-select').value;
    
    if (!directive) {
        showError('Please select a directive');
        return;
    }

    try {
        console.log('Fetching standards for directive:', directive);
        
        const response = await apiCall(`/standards?directive=${directive}`);
        
        if (response && response.success) {
            displayStandards(response.data);
            showSuccess(`Successfully fetched ${response.data.count} standards for ${response.data.directive_name}`);
        } else {
            throw new Error(response?.error || 'Failed to fetch standards');
        }
    } catch (error) {
        console.error('Failed to fetch standards:', error);
        showError(`Failed to fetch standards: ${error.message}`);
    }
}

function displayStandards(data) {
    const resultsSection = document.getElementById('standards-results');
    const countElement = document.getElementById('standards-count');
    const listElement = document.getElementById('standards-list');

    countElement.textContent = `${data.count} standards`;
    
    listElement.innerHTML = '';
    
    data.standards.forEach(standard => {
        const item = createStandardItem(standard, data.directive);
        listElement.appendChild(item);
    });

    resultsSection.classList.remove('hidden');
}

function createStandardItem(standard, directive = null) {
    const item = document.createElement('div');
    item.className = 'standard-item';

    const directiveBadge = directive ? 
        `<span class="standard-directive">${directive}</span>` : '';

    const version = standard.version ? 
        `<span><i class="fas fa-tag"></i> ${standard.version}</span>` : '';
    
    const date = standard.date ? 
        `<span><i class="fas fa-calendar"></i> ${standard.date}</span>` : '';

    const etsiLink = generateETSILink(standard.number);

    item.innerHTML = `
        <div class="standard-header">
            <span class="standard-number">${standard.number}</span>
            ${directiveBadge}
        </div>
        <div class="standard-title">${standard.title || 'No title available'}</div>
        <div class="standard-meta">
            ${version}
            ${date}
            <span><i class="fas fa-bookmark"></i> ${standard.type || 'Standard'}</span>
            ${etsiLink}
        </div>
    `;

    return item;
}

function generateETSILink(standardNumber) {
    // Generate ETSI portal search link
    const searchTerm = encodeURIComponent(standardNumber);
    const etsiUrl = `https://www.etsi.org/standards-search?search=${searchTerm}`;
    
    return `<a href="${etsiUrl}" target="_blank" class="etsi-link">
        <i class="fas fa-external-link-alt"></i> ETSI Portal
    </a>`;
}

async function searchStandards() {
    const query = document.getElementById('search-input').value.trim();
    
    if (!query) {
        showError('Please enter a search query');
        return;
    }

    try {
        console.log('Searching for:', query);
        const response = await apiCall(`/search?q=${encodeURIComponent(query)}`);
        
        if (response.success) {
            displaySearchResults(response.data);
        } else {
            throw new Error(response.error || 'Search failed');
        }
    } catch (error) {
        console.error('Search failed:', error);
        showError(`Search failed: ${error.message}`);
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

    const standards = [];
    standardItems.forEach(item => {
        const number = item.querySelector('.standard-number').textContent;
        const title = item.querySelector('.standard-title').textContent;
        const directive = item.querySelector('.standard-directive')?.textContent || '';
        
        standards.push({
            directive,
            number,
            title
        });
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

// File upload functions
function handleDragOver(e) {
    e.preventDefault();
    e.currentTarget.classList.add('drag-over');
}

function handleDragLeave(e) {
    e.preventDefault();
    e.currentTarget.classList.remove('drag-over');
}

function handleDrop(e) {
    e.preventDefault();
    e.currentTarget.classList.remove('drag-over');
    
    const files = e.dataTransfer.files;
    if (files.length > 0) {
        handleFile(files[0]);
    }
}

function handleFileSelect(e) {
    const file = e.target.files[0];
    if (file) {
        handleFile(file);
    }
}

async function handleFile(file) {
    if (file.type !== 'application/pdf') {
        showError('Please select a PDF file');
        return;
    }

    if (file.size > 16 * 1024 * 1024) {
        showError('File size must be less than 16MB');
        return;
    }

    const formData = new FormData();
    formData.append('file', file);

    try {
        showLoading();
        const response = await fetch(`${API_BASE}/certificate`, {
            method: 'POST',
            body: formData
        });

        const data = await response.json();
        
        if (!response.ok) {
            throw new Error(data.error || `HTTP ${response.status}`);
        }

        uploadedCertificateData = data.data;
        displayCertificateResults(data.data);
        updateCompareTabState();
        
        const message = data.note ? 
            `Certificate processed (demo mode): ${data.note}` : 
            'Certificate processed successfully!';
        showSuccess(message);
    } catch (error) {
        console.error('File upload failed:', error);
        showError(`Certificate processing failed: ${error.message}`);
    } finally {
        hideLoading();
    }
}

function displayCertificateResults(data) {
    const resultsSection = document.getElementById('certificate-results');
    
    // Update certificate info
    document.getElementById('cert-number').textContent = data.certificate_info.certificate_number || '-';
    document.getElementById('cert-organization').textContent = data.certificate_info.organization || '-';
    document.getElementById('cert-valid-until').textContent = data.certificate_info.valid_until || '-';
    document.getElementById('cert-standards-count').textContent = data.total_standards;

    // Display categories
    const categoriesElement = document.getElementById('standards-categories');
    categoriesElement.innerHTML = '';

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
                    ${standards.map(std => `<li>${std}</li>`).join('')}
                </ul>
            </div>
        `;

        categoriesElement.appendChild(categoryItem);
    });

    resultsSection.classList.remove('hidden');
}

function toggleCategory(header) {
    const standards = header.nextElementSibling;
    standards.classList.toggle('active');
}

// Compare functions
function updateCompareTabState() {
    const compareControls = document.getElementById('compare-controls');
    const compareInfo = document.querySelector('.compare-info');

    if (uploadedCertificateData) {
        compareControls.classList.remove('hidden');
        compareInfo.textContent = `Certificate loaded: ${uploadedCertificateData.certificate_info.certificate_number}. Select a directive to compare.`;
    } else {
        compareControls.classList.add('hidden');
        compareInfo.textContent = 'First upload an ISO17025 certificate in the Certificate tab, then select a directive to compare.';
    }
}

async function singleCompare() {
    const directive = document.getElementById('compare-directive-select').value;
    
    if (!directive) {
        showError('Please select a directive');
        return;
    }

    if (!uploadedCertificateData) {
        showError('Please upload a certificate first');
        return;
    }

    try {
        console.log('Comparing with directive:', directive);
        
        const response = await apiCall('/compare', {
            method: 'POST',
            body: JSON.stringify({
                directive: directive,
                iso_standards: uploadedCertificateData.test_standards
            })
        });

        if (response.success) {
            displayComparisonResults([response.data], false);
            showSuccess(`Comparison completed: ${response.data.coverage_percentage.toFixed(1)}% coverage`);
        } else {
            throw new Error(response.error || 'Comparison failed');
        }
    } catch (error) {
        console.error('Comparison failed:', error);
        showError(`Comparison failed: ${error.message}`);
    }
}

async function batchCompare() {
    if (!uploadedCertificateData) {
        showError('Please upload a certificate first');
        return;
    }

    try {
        console.log('Starting batch comparison...');
        
        const response = await apiCall('/batch-compare', {
            method: 'POST',
            body: JSON.stringify({
                iso_standards: uploadedCertificateData.test_standards
            })
        });

        if (response.success) {
            const resultsArray = Object.entries(response.data.results).map(([directive, result]) => ({
                directive: directive,
                directive_name: result.directive_name,
                ...result
            }));

            displayComparisonResults(resultsArray, true, response.data.best_directive);
            showSuccess(`Batch comparison completed. Best match: ${response.data.best_directive} (${response.data.best_coverage.toFixed(1)}%)`);
        } else {
            throw new Error(response.error || 'Batch comparison failed');
        }
    } catch (error) {
        console.error('Batch comparison failed:', error);
        showError(`Batch comparison failed: ${error.message}`);
    }
}

function displayComparisonResults(results, isBatch = false, bestDirective = null) {
    const resultsSection = document.getElementById('comparison-results');
    const contentElement = document.getElementById('comparison-content');

    contentElement.innerHTML = '';

    if (isBatch && bestDirective) {
        const bestMatch = results.find(r => r.directive === bestDirective);
        if (bestMatch) {
            const bestMatchElement = document.createElement('div');
            bestMatchElement.className = 'card';
            bestMatchElement.style.border = '2px solid #28a745';
            bestMatchElement.innerHTML = `
                <h3><i class="fas fa-trophy"></i> Best Match: ${bestMatch.directive_name}</h3>
                <p>This directive has the highest coverage (${bestMatch.coverage_percentage.toFixed(1)}%) for your certificate.</p>
            `;
            contentElement.appendChild(bestMatchElement);
        }
    }

    results.forEach(result => {
        const resultElement = createComparisonResultElement(result);
        contentElement.appendChild(resultElement);
    });

    resultsSection.classList.remove('hidden');
}

function createComparisonResultElement(result) {
    const element = document.createElement('div');
    element.className = 'comparison-summary';

    const matchedStandardsHtml = result.matched_standards
        .map(match => `
            <div class="matched-item">
                <i class="fas fa-check-circle match-icon"></i>
                <div class="match-details">
                    <span class="oj-standard">${match.oj_standard.number}</span>
                    <span class="match-arrow">↔</span>
                    <span class="iso-standard">${match.iso_standard.standard_number}</span>
                </div>
            </div>
        `).join('');

    element.innerHTML = `
        <h3>${result.directive_name || result.directive}</h3>
        
        <div class="comparison-stats">
            <div class="stat-item">
                <div class="stat-number">${result.coverage_percentage.toFixed(1)}%</div>
                <div class="stat-label">Coverage</div>
            </div>
            <div class="stat-item">
                <div class="stat-number">${result.matched_count}</div>
                <div class="stat-label">Matched</div>
            </div>
            <div class="stat-item">
                <div class="stat-number">${result.oj_count || 0}</div>
                <div class="stat-label">OJ Standards</div>
            </div>
            <div class="stat-item">
                <div class="stat-number">${uploadedCertificateData.total_standards}</div>
                <div class="stat-label">ISO Standards</div>
            </div>
        </div>

        <div class="coverage-bar">
            <div class="coverage-fill" style="width: ${result.coverage_percentage}%"></div>
        </div>
        <div class="coverage-text">${result.coverage_percentage.toFixed(1)}% Coverage</div>

        ${result.matched_standards.length > 0 ? `
            <div class="matched-standards">
                <h4><i class="fas fa-check"></i> Matched Standards (${result.matched_count})</h4>
                ${matchedStandardsHtml}
            </div>
        ` : '<p>No matching standards found.</p>'}
    `;

    return element;
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