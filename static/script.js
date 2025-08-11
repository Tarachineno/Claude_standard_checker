// EU Harmonized Standards Checker - Frontend JavaScript
// Pure JavaScript implementation for Netlify deployment

// Global variables
let uploadedCertificateData = null;
let currentStandardsData = null; // Store current standards for sorting/filtering

// API configuration - Netlify Functions
const API_BASE = '/.netlify/functions';
// GitHub repository for viewing scope details

const GITHUB_REPO_URL = 'https://github.com/Tarachineno/Claude_standard_checker';

// Certificate data is now loaded dynamically from MD files via API
// No more hardcoded certificate data - all data comes from:
// - /static/data/a2la-scopes.md
// - /static/data/jab-scopes.md

// DOM elements (will be initialized after DOM load)
let loadingOverlay, errorModal, successModal;

// Initialize the application
document.addEventListener('DOMContentLoaded', function() {
    initializeApp();
});

async function initializeApp() {
    // Initialize DOM elements
    loadingOverlay = document.getElementById('loading-overlay');
    errorModal = document.getElementById('error-modal');
    successModal = document.getElementById('success-modal');
    
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
                showSuccess(`Successfully fetched ${response.data.count} standards from Excel file for ${response.data.directive_name}`);
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

async function displayStandards(data) {
    // Store current data for sorting/filtering
    currentStandardsData = data;
    
    const resultsSection = document.getElementById('standards-results');
    const countElement = document.getElementById('standards-count');
    const listElement = document.getElementById('standards-list');

    countElement.textContent = `${data.count} standards`;
    
    listElement.innerHTML = '';
    
    // Check scope matching for all standards
    let scopeMatches = null;
    try {
        const response = await apiCall('/scope-matcher', {
            method: 'POST',
            body: JSON.stringify({
                oj_standards: data.standards.map(s => s.number || s.full_number)
            })
        });
        
        if (response.success) {
            scopeMatches = response.data.matches;
        }
    } catch (error) {
        console.warn('Scope matching failed:', error);
        // Continue without scope matching
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
    
    // Check scope matching for all standards
    let scopeMatches = null;
    try {
        const response = await apiCall('/scope-matcher', {
            method: 'POST',
            body: JSON.stringify({
                oj_standards: data.standards.map(s => s.number || s.full_number)
            })
        });
        
        if (response.success) {
            scopeMatches = response.data.matches;
        }
    } catch (error) {
        console.warn('Scope matching failed:', error);
        // Continue without scope matching
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
        return `<span class="scope-badge no-match" title="対応スコープなし">
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
            title = `完全一致: ${matchData.matched_standard}`;
            break;
        case 'comprehensive_match':
            badgeClass += 'comprehensive-match';
            icon = 'fa-check-circle';
            statusSymbol = '🟢';
            title = `${matchData.note}: ${matchData.matched_standard}`;
            break;
        case 'prefix_mismatch':
            badgeClass += 'prefix-mismatch';
            icon = 'fa-exclamation-circle';
            statusSymbol = '🟡';
            title = `${matchData.note}: ${matchData.matched_standard}`;
            break;
        case 'version_mismatch':
            badgeClass += 'version-mismatch';
            icon = 'fa-exclamation-triangle';
            statusSymbol = '🟠';
            title = `${matchData.note}: ${matchData.matched_standard}`;
            break;
        default:
            return createScopeBadge(certType, { status: 'no_match' });
    }
    
    const facilityInfo = matchData.facility ? ` (${matchData.facility})` : '';
    const clickHandler = matchData.anchor ? 
        `onclick="openScopeDetails('${certType.toLowerCase()}', '${matchData.anchor}')"` : '';
    
    return `<span class="${badgeClass}" title="${title}${facilityInfo}" ${clickHandler}>
        <i class="fas ${icon}"></i> ${certType} ${statusSymbol}
        ${matchData.note ? `<span class="scope-note">⚠️ ${matchData.note}</span>` : ''}
    </span>`;
}

// Open scope details in MD file
function openScopeDetails(certType, anchor) {
    const githubUrl = `${GITHUB_REPO_URL}/blob/main/static/data/${certType}-scopes.md${anchor}`;
    window.open(githubUrl, '_blank');
    showBriefNotification(`Opening ${certType.toUpperCase()} certificate scope information on GitHub`);
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

// Certificate selection functions
function handleCertificateTypeChange(e) {
    const selectedType = e.target.value;
    const loadBtn = document.getElementById('load-certificate-btn');
    
    if (selectedType) {
        loadBtn.disabled = false;
        loadBtn.innerHTML = `<i class="fas fa-download"></i> Load ${selectedType.toUpperCase()} Certificate Data`;
    } else {
        loadBtn.disabled = true;
        loadBtn.innerHTML = '<i class="fas fa-download"></i> Load Certificate Data';
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
            displayCertificateResults(certificateData);
            
            showSuccess(`${selectedType.toUpperCase()} certificate data loaded successfully! (${certificateData.total_standards} standards loaded from MD file)`);
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

function displayCertificateResults(data) {
    const resultsSection = document.getElementById('certificate-results');
    
    // Update certificate info
    document.getElementById('cert-number').textContent = data.certificate_info.certificate_number || '-';
    document.getElementById('cert-organization').textContent = data.certificate_info.organization || '-';
    document.getElementById('cert-valid-until').textContent = data.certificate_info.valid_until || '-';
    document.getElementById('cert-standards-count').textContent = data.total_standards;

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
                facilityCategories[category].push(standard.standard_number);
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
                                    ${standards.map(std => `<li>${std}</li>`).join('')}
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
                        ${standards.map(std => `<li>${std}</li>`).join('')}
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
                         match.match_type === 'prefix_mismatch' ? 'fa-exclamation-circle' :
                         match.match_type === 'version_mismatch' ? 'fa-exclamation-triangle' : 'fa-search';
    
    const matchTypeClass = match.match_type === 'exact' ? 'exact-match' :
                          match.match_type === 'prefix_mismatch' ? 'prefix-mismatch' :
                          match.match_type === 'version_mismatch' ? 'version-mismatch' : 'partial-match';
    
    const facilityInfo = match.facility ? `<span class="facility-info">${match.facility}</span>` : '';
    const noteInfo = match.note ? `<span class="match-note">⚠️ ${match.note}</span>` : '';
    
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