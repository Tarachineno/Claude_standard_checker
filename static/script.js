// EU Harmonized Standards Checker - Frontend JavaScript
// Pure JavaScript implementation for Netlify deployment

// Global variables
let uploadedCertificateData = null;

// API configuration - Netlify Functions
const API_BASE = '/.netlify/functions';

// Predefined Certificate Data
const PREDEFINED_CERTIFICATES = {
    a2la: {
        certificate_info: {
            certificate_number: 'A2LA-2022-01',
            organization: 'A2LA Accredited Testing Laboratory',
            valid_until: '2025-12-31',
            accreditation_body: 'A2LA',
            revision_date: '2024-01-01'
        },
        test_standards: [
            // Radiated & Conducted
            { standard_number: 'CFR 47 FCC Part 15B (ANSI C63.4:2014)', category: 'Radiated & Conducted', description: 'Unintentional Radiators' },
            { standard_number: 'FCC Part 18 (MP-5:1986)', category: 'Radiated & Conducted', description: 'Industrial, Scientific, and Medical Equipment' },
            { standard_number: 'FCC Parts 15C (ANSI C63.10:2013)', category: 'Radiated & Conducted', description: 'Intentional Radiators' },
            { standard_number: 'FCC Part 15E (ANSI C63.10:2013 & FCC KDB 905462 D02 v02)', category: 'Radiated & Conducted', description: 'U-NII Equipment' },
            { standard_number: 'FCC Parts 15F (ANSI C63.10:2013)', category: 'Radiated & Conducted', description: 'Ultra-Wideband Operation' },
            { standard_number: 'UNII-MP', category: 'Radiated & Conducted', description: 'Unlicensed National Information Infrastructure' },
            { standard_number: 'CISPR 11', category: 'Radiated & Conducted', description: 'Industrial, scientific and medical equipment' },
            { standard_number: 'EN 55011', category: 'Radiated & Conducted', description: 'Industrial, scientific and medical equipment' },
            { standard_number: 'KS C 9811', category: 'Radiated & Conducted', description: 'Korean EMC Standard' },
            { standard_number: 'IEC 61000-6-4', category: 'Radiated & Conducted', description: 'Generic emission standard for industrial environments' },
            { standard_number: 'EN 61000-6-4', category: 'Radiated & Conducted', description: 'Generic emission standard for industrial environments' },
            { standard_number: 'KS C 9610-6-4', category: 'Radiated & Conducted', description: 'Korean generic emission standard' },
            
            // United States Radio
            { standard_number: 'CFR 47 FCC Parts 25, 30, 74, 90 (>3 GHz), 95 (>3 GHz), 97 (>3 GHz) & 101 (ANSI C63.26:2015)', category: 'United States Radio', description: 'Radio Service Rules' },
            
            // Canada Radio
            { standard_number: 'ICES-Gen', category: 'Canada Radio', description: 'General EMC requirements' },
            { standard_number: 'ICES-003', category: 'Canada Radio', description: 'Information Technology Equipment' },
            { standard_number: 'RSS-GEN', category: 'Canada Radio', description: 'General Requirements for Radio Equipment' },
            { standard_number: 'RSS-210', category: 'Canada Radio', description: 'Low-power Licence-exempt Radio Communication Devices' },
            { standard_number: 'RSS-215', category: 'Canada Radio', description: 'Wireless Microphones' },
            { standard_number: 'RSS-220', category: 'Canada Radio', description: 'Devices Using Ultra-Wideband Technology' },
            { standard_number: 'RSS-247', category: 'Canada Radio', description: '2.4 GHz Band Spread Spectrum Equipment' },
            { standard_number: 'RSS-248', category: 'Canada Radio', description: '5 GHz Band Equipment' },
            { standard_number: 'RSS-251', category: 'Canada Radio', description: 'Fixed Wireless Access Equipment' },
            
            // European Radio
            { standard_number: 'ETSI EN 301 091-1/-2/-3', category: 'European Radio', description: 'Electromagnetic compatibility and Radio spectrum Matters (ERM)' },
            { standard_number: 'EN 301 783', category: 'European Radio', description: 'Land Mobile Service' },
            { standard_number: 'EN 301 893', category: 'European Radio', description: '5 GHz high performance RLAN' },
            { standard_number: 'EN 302 065-1/-2/-3/-4', category: 'European Radio', description: 'Short Range Devices' },
            { standard_number: 'EN 302 264', category: 'European Radio', description: 'Meteor Burst Communications' },
            { standard_number: 'EN 305 550-1/-2', category: 'European Radio', description: 'Direct Sequence Spread Spectrum (DSSS)' },
            { standard_number: 'EN 300 328', category: 'European Radio', description: '2,4 GHz wideband transmission systems' },
            { standard_number: 'EN 300 330', category: 'European Radio', description: 'Short Range Devices' },
            { standard_number: 'EN 300 220-1/-2', category: 'European Radio', description: 'Short Range Devices' },
            { standard_number: 'EN 303 413', category: 'European Radio', description: 'Satellite Earth Stations and Systems' },
            
            // Australia / New Zealand Radio
            { standard_number: 'AS/NZS 4268', category: 'Australia / New Zealand Radio', description: 'Radio equipment and systems' },
            
            // Emissions for Ports
            { standard_number: 'CISPR 32', category: 'Emissions for Ports', description: 'Electromagnetic compatibility of multimedia equipment' },
            { standard_number: 'EN 55032', category: 'Emissions for Ports', description: 'Electromagnetic compatibility of multimedia equipment' },
            
            // Harmonic Current Emissions
            { standard_number: 'IEC 61000-3-2', category: 'Harmonic Current Emissions', description: 'Limits for harmonic current emissions' },
            { standard_number: 'EN 61000-3-2', category: 'Harmonic Current Emissions', description: 'Limits for harmonic current emissions' },
            
            // Voltage Fluctuations & Flicker
            { standard_number: 'IEC 61000-3-3', category: 'Voltage Fluctuations & Flicker', description: 'Voltage fluctuations and flicker' },
            { standard_number: 'EN 61000-3-3', category: 'Voltage Fluctuations & Flicker', description: 'Voltage fluctuations and flicker' },
            { standard_number: 'IEC 61000-3-11', category: 'Voltage Fluctuations & Flicker', description: 'Voltage fluctuations and flicker' },
            { standard_number: 'EN 61000-3-11', category: 'Voltage Fluctuations & Flicker', description: 'Voltage fluctuations and flicker' },
            
            // Electrostatic Discharge (ESD)
            { standard_number: 'IEC 61000-4-2', category: 'Electrostatic Discharge (ESD)', description: 'Electrostatic discharge immunity test' },
            { standard_number: 'EN 61000-4-2', category: 'Electrostatic Discharge (ESD)', description: 'Electrostatic discharge immunity test' },
            { standard_number: 'KS C 9610-4-2', category: 'Electrostatic Discharge (ESD)', description: 'Korean ESD immunity test' },
            
            // RF Radiated EM Field Immunity
            { standard_number: 'IEC 61000-4-3', category: 'RF Radiated EM Field Immunity', description: 'Radiated electromagnetic field immunity test' },
            { standard_number: 'EN 61000-4-3', category: 'RF Radiated EM Field Immunity', description: 'Radiated electromagnetic field immunity test' },
            { standard_number: 'KS C 9610-4-3', category: 'RF Radiated EM Field Immunity', description: 'Korean RF radiated immunity test' },
            
            // Electrical Fast/Transient Burst (EFT)
            { standard_number: 'IEC 61000-4-4', category: 'Electrical Fast/Transient Burst (EFT)', description: 'Electrical fast transient immunity test' },
            { standard_number: 'EN 61000-4-4', category: 'Electrical Fast/Transient Burst (EFT)', description: 'Electrical fast transient immunity test' },
            { standard_number: 'KS C 9610-4-4', category: 'Electrical Fast/Transient Burst (EFT)', description: 'Korean electrical fast transient immunity test' },
            
            // Surge
            { standard_number: 'IEC 61000-4-5', category: 'Surge', description: 'Surge immunity test' },
            { standard_number: 'EN 61000-4-5', category: 'Surge', description: 'Surge immunity test' },
            { standard_number: 'KS C 9610-4-5', category: 'Surge', description: 'Korean surge immunity test' },
            
            // Conducted Immunity
            { standard_number: 'IEC 61000-4-6', category: 'Conducted Immunity', description: 'Conducted RF immunity test' },
            { standard_number: 'EN 61000-4-6', category: 'Conducted Immunity', description: 'Conducted RF immunity test' },
            { standard_number: 'KS C 9610-4-6', category: 'Conducted Immunity', description: 'Korean conducted RF immunity test' },
            
            // Transients & Surges (Vehicle)
            { standard_number: 'ISO 7637-2', category: 'Transients & Surges (Vehicle)', description: 'Road vehicles electrical disturbances' },
            
            // Magnetic Field Immunity
            { standard_number: 'IEC 61000-4-8', category: 'Magnetic Field Immunity', description: 'Power frequency magnetic field immunity test' },
            { standard_number: 'EN 61000-4-8', category: 'Magnetic Field Immunity', description: 'Power frequency magnetic field immunity test' },
            { standard_number: 'KS C 9610-4-8', category: 'Magnetic Field Immunity', description: 'Korean magnetic field immunity test' },
            
            // Voltage Dips/Interruptions/Variations
            { standard_number: 'IEC 61000-4-11', category: 'Voltage Dips/Interruptions/Variations', description: 'Voltage dips, short interruptions and voltage variations immunity test' },
            { standard_number: 'EN 61000-4-11', category: 'Voltage Dips/Interruptions/Variations', description: 'Voltage dips, short interruptions and voltage variations immunity test' },
            { standard_number: 'KS C 9610-4-11', category: 'Voltage Dips/Interruptions/Variations', description: 'Korean voltage dips immunity test' },
            { standard_number: 'KS C IEC 61000-4-34', category: 'Voltage Dips/Interruptions/Variations', description: 'Korean voltage dips and interruptions test' },
            { standard_number: 'IEC 61000-4-34', category: 'Voltage Dips/Interruptions/Variations', description: 'Voltage dips, short interruptions and voltage variations test' },
            { standard_number: 'EN 61000-4-34', category: 'Voltage Dips/Interruptions/Variations', description: 'Voltage dips, short interruptions and voltage variations test' },
            
            // Semiconductor Equipment Voltage Sag Immunity
            { standard_number: 'SEMI F47', category: 'Semiconductor Equipment Voltage Sag Immunity', description: 'Specification for semiconductor processing equipment voltage sag immunity' },
            
            // Common Technical Standards (Machines & Mechanisms)
            { standard_number: 'S2-W-5', category: 'Common Technical Standards (Machines & Mechanisms)', description: 'Common technical standards for machines and mechanisms' },
            
            // Documentation for Semiconductor Equipment Installation
            { standard_number: 'SEMI E6', category: 'Documentation for Semiconductor Equipment Installation', description: 'Guide for semiconductor equipment installation documentation' },
            
            // Generic Immunity – Industrial Environments
            { standard_number: 'IEC 61000-6-2', category: 'Generic Immunity – Industrial Environments', description: 'Generic immunity standard for industrial environments' },
            { standard_number: 'EN 61000-6-2', category: 'Generic Immunity – Industrial Environments', description: 'Generic immunity standard for industrial environments' },
            { standard_number: 'KS C 9610-6-2', category: 'Generic Immunity – Industrial Environments', description: 'Korean generic immunity standard for industrial environments' },
            
            // Product Family Standards
            { standard_number: 'EN 50370-11', category: 'Product Family Standards', description: 'Product family standard for machine tools' },
            { standard_number: 'EN 50370-21', category: 'Product Family Standards', description: 'Product family standard for lifts, escalators and moving walks' },
            { standard_number: 'EN 301 489-1/-3/-7/-9/-15/-17/-19/-24/-51/-52', category: 'Product Family Standards', description: 'Product family standards for radio equipment and services' },
            
            // Wi-Fi Devices Interoperability
            { standard_number: 'Wi-Fi CERTIFIED n', category: 'Wi-Fi Devices Interoperability', description: 'Wi-Fi n certification' },
            { standard_number: 'Wi-Fi Protected Setup', category: 'Wi-Fi Devices Interoperability', description: 'Wi-Fi Protected Setup certification' },
            { standard_number: 'WMM Power Save', category: 'Wi-Fi Devices Interoperability', description: 'Wi-Fi Multimedia Power Save certification' },
            { standard_number: 'Protected Management Frames', category: 'Wi-Fi Devices Interoperability', description: 'Protected Management Frames certification' },
            { standard_number: 'Miracast', category: 'Wi-Fi Devices Interoperability', description: 'Miracast wireless display certification' },
            { standard_number: 'Wi-Fi Direct', category: 'Wi-Fi Devices Interoperability', description: 'Wi-Fi Direct certification' },
            { standard_number: 'Wi-Fi CERTIFIED ac Test Plans', category: 'Wi-Fi Devices Interoperability', description: 'Wi-Fi ac certification test plans' },
            
            // Unintentional Radiators (FCC Part 15B)
            { standard_number: 'ANSI C63.4:2014', category: 'Unintentional Radiators (FCC Part 15B)', description: 'American National Standard for Methods of Measurement of Radio-Noise Emissions' },
            
            // ISM Equipment (FCC Part 18)
            { standard_number: 'FCC MP-5 (Feb 1986)', category: 'ISM Equipment (FCC Part 18)', description: 'Measurement procedures for ISM equipment' },
            
            // Intentional Radiators (FCC Part 15C)
            { standard_number: 'ANSI C63.10:2013', category: 'Intentional Radiators (FCC Part 15C)', description: 'American National Standard for Testing Unlicensed Wireless Devices' },
            
            // U-NII without DFS (FCC Part 15E)
            { standard_number: 'ANSI C63.10:2013', category: 'U-NII without DFS (FCC Part 15E)', description: 'American National Standard for Testing Unlicensed Wireless Devices' },
            
            // U-NII with DFS (FCC Part 15E)
            { standard_number: 'FCC KDB 905462 D02 (v02)', category: 'U-NII with DFS (FCC Part 15E)', description: 'Dynamic Frequency Selection test procedures' },
            
            // UWB Radiators (FCC Part 15F)
            { standard_number: 'ANSI C63.10:2013', category: 'UWB Radiators (FCC Part 15F)', description: 'American National Standard for Testing Unlicensed Wireless Devices' },
            
            // Microwave & Millimeter Radio Services
            { standard_number: 'CFR 47 FCC Parts 25/30/74/90/95/97/101 (ANSI C63.26:2015)', category: 'Microwave & Millimeter Radio Services', description: 'Microwave and millimeter wave radio services' }
        ],
        categories: {},
        total_standards: 0,
        extraction_date: new Date().toISOString(),
        pdf_source: 'A2LA Predefined Certificate',
        certificate_type: 'A2LA_Predefined'
    },
    
    jab: {
        certificate_info: {
            certificate_number: 'JAB-2023-01',
            organization: 'JAB Accredited Testing Facilities',
            valid_until: '2025-12-31',
            accreditation_body: 'JAB',
            revision_date: '2024-01-01'
        },
        test_standards: [
            // Facility 1: SGS Japan Inc. Kitayamata Laboratory
            { standard_number: 'EN 55011', category: 'Continuous Disturbance Tests', description: 'Industrial, scientific and medical equipment', facility: '施設1: SGS Japan Inc. Kitayamata Laboratory' },
            { standard_number: 'EN 55022:2010', category: 'Continuous Disturbance Tests', description: 'Information technology equipment', facility: '施設1: SGS Japan Inc. Kitayamata Laboratory' },
            { standard_number: 'IEC 60945', category: 'Continuous Disturbance Tests', description: 'Maritime navigation and radiocommunication equipment', facility: '施設1: SGS Japan Inc. Kitayamata Laboratory' },
            { standard_number: 'EN 60945', category: 'Continuous Disturbance Tests', description: 'Maritime navigation and radiocommunication equipment', facility: '施設1: SGS Japan Inc. Kitayamata Laboratory' },
            { standard_number: 'EN 61326-1', category: 'Continuous Disturbance Tests', description: 'Electrical equipment for measurement', facility: '施設1: SGS Japan Inc. Kitayamata Laboratory' },
            { standard_number: 'IEC 61326-1', category: 'Continuous Disturbance Tests', description: 'Electrical equipment for measurement', facility: '施設1: SGS Japan Inc. Kitayamata Laboratory' },
            { standard_number: 'IEC 61000-6-3', category: 'Continuous Disturbance Tests', description: 'Generic emission standard for residential environments', facility: '施設1: SGS Japan Inc. Kitayamata Laboratory' },
            { standard_number: 'EN 61000-6-3', category: 'Continuous Disturbance Tests', description: 'Generic emission standard for residential environments', facility: '施設1: SGS Japan Inc. Kitayamata Laboratory' },
            { standard_number: 'IEC 61000-6-4', category: 'Continuous Disturbance Tests', description: 'Generic emission standard for industrial environments', facility: '施設1: SGS Japan Inc. Kitayamata Laboratory' },
            { standard_number: 'EN 61000-6-4', category: 'Continuous Disturbance Tests', description: 'Generic emission standard for industrial environments', facility: '施設1: SGS Japan Inc. Kitayamata Laboratory' },
            { standard_number: 'CISPR11', category: 'Continuous Disturbance Tests', description: 'Industrial, scientific and medical equipment', facility: '施設1: SGS Japan Inc. Kitayamata Laboratory' },
            { standard_number: 'VCCI rule V-3', category: 'Continuous Disturbance Tests', description: 'VCCI technical conditions', facility: '施設1: SGS Japan Inc. Kitayamata Laboratory' },
            { standard_number: 'VCCI-CISPR 32', category: 'Continuous Disturbance Tests', description: 'Multimedia equipment EMC', facility: '施設1: SGS Japan Inc. Kitayamata Laboratory' },
            { standard_number: 'CISPR32', category: 'Continuous Disturbance Tests', description: 'Electromagnetic compatibility of multimedia equipment', facility: '施設1: SGS Japan Inc. Kitayamata Laboratory' },
            { standard_number: 'EN55032', category: 'Continuous Disturbance Tests', description: 'Electromagnetic compatibility of multimedia equipment', facility: '施設1: SGS Japan Inc. Kitayamata Laboratory' },
            
            // Vehicle EMC Tests
            { standard_number: 'CISPR 25', category: 'Vehicle EMC Tests', description: 'Vehicles, boats and internal combustion engines', facility: '施設1: SGS Japan Inc. Kitayamata Laboratory' },
            { standard_number: 'EN 55025', category: 'Vehicle EMC Tests', description: 'Vehicles, boats and internal combustion engines', facility: '施設1: SGS Japan Inc. Kitayamata Laboratory' },
            { standard_number: 'ISO 13766-1', category: 'Vehicle EMC Tests', description: 'Earth-moving machinery EMC', facility: '施設1: SGS Japan Inc. Kitayamata Laboratory' },
            { standard_number: 'ISO 7637-2', category: 'Vehicle EMC Tests', description: 'Road vehicles electrical disturbances', facility: '施設1: SGS Japan Inc. Kitayamata Laboratory' },
            
            // Harmonic Current Emission Tests
            { standard_number: 'IEC 61000-3-2', category: 'Harmonic Current Emission Tests', description: 'Limits for harmonic current emissions', facility: '施設1: SGS Japan Inc. Kitayamata Laboratory' },
            { standard_number: 'EN 61000-3-2', category: 'Harmonic Current Emission Tests', description: 'Limits for harmonic current emissions', facility: '施設1: SGS Japan Inc. Kitayamata Laboratory' },
            
            // Voltage Fluctuation & Flicker Tests
            { standard_number: 'IEC 61000-3-3', category: 'Voltage Fluctuation & Flicker Tests', description: 'Voltage fluctuations and flicker', facility: '施設1: SGS Japan Inc. Kitayamata Laboratory' },
            { standard_number: 'EN 61000-3-3', category: 'Voltage Fluctuation & Flicker Tests', description: 'Voltage fluctuations and flicker', facility: '施設1: SGS Japan Inc. Kitayamata Laboratory' },
            
            // ESD Tests
            { standard_number: 'IEC 61000-4-2', category: 'Electrostatic Discharge (ESD) Tests', description: 'Electrostatic discharge immunity test', facility: '施設1: SGS Japan Inc. Kitayamata Laboratory' },
            { standard_number: 'EN 61000-4-2', category: 'Electrostatic Discharge (ESD) Tests', description: 'Electrostatic discharge immunity test', facility: '施設1: SGS Japan Inc. Kitayamata Laboratory' },
            { standard_number: 'JIS C 61000-4-2', category: 'Electrostatic Discharge (ESD) Tests', description: 'Japanese ESD immunity test', facility: '施設1: SGS Japan Inc. Kitayamata Laboratory' },
            
            // RF Radiated Electromagnetic Field Immunity
            { standard_number: 'IEC 61000-4-3', category: 'RF Radiated Electromagnetic Field Immunity', description: 'Radiated electromagnetic field immunity test', facility: '施設1: SGS Japan Inc. Kitayamata Laboratory' },
            { standard_number: 'EN 61000-4-3', category: 'RF Radiated Electromagnetic Field Immunity', description: 'Radiated electromagnetic field immunity test', facility: '施設1: SGS Japan Inc. Kitayamata Laboratory' },
            { standard_number: 'JIS C 61000-4-3', category: 'RF Radiated Electromagnetic Field Immunity', description: 'Japanese RF radiated immunity test', facility: '施設1: SGS Japan Inc. Kitayamata Laboratory' },
            
            // Facility 2: TDK Corporation Nikaho Factory
            { standard_number: 'EN 12015', category: 'EMC Standards for Specific Equipment', description: 'Electromagnetic compatibility for lifts', facility: '施設2: TDK Corporation Nikaho Factory' },
            { standard_number: 'EN 12016', category: 'EMC Immunity Standards', description: 'Electromagnetic compatibility for lifts', facility: '施設2: TDK Corporation Nikaho Factory' },
            { standard_number: 'EN 300 330', category: 'Radio Transmitter Tests', description: 'Short Range Devices (SRD)', facility: '施設2: TDK Corporation Nikaho Factory' }
        ],
        categories: {},
        total_standards: 0,
        extraction_date: new Date().toISOString(),
        pdf_source: 'JAB Predefined Certificate',
        certificate_type: 'JAB_Predefined',
        facilities: [
            {
                facility_number: '1',
                name: 'SGS Japan Inc. Kitayamata Laboratory',
                location: '神奈川県横浜市',
                standards_count: 45
            },
            {
                facility_number: '2',
                name: 'TDK Corporation Nikaho Factory (North site)',
                location: '秋田県にかほ市',
                standards_count: 15
            }
        ]
    }
};

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
    document.getElementById('directive-select').addEventListener('change', updateFetchMethodOptions);

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

function createStandardItem(standard, directive = null) {
    const item = document.createElement('div');
    item.className = 'standard-item';

    const directiveBadge = directive ? 
        `<span class="standard-directive">${directive}</span>` : '';

    // Excel-style display with all relevant information
    const displayNumber = standard.number || standard.full_number;
    const dateInfo = formatExcelDate(standard.date);
    const standardsLink = generateStandardLink(standard.number, standard.eso);
    const description = standard.description || standard.title || '';
    
    // Excel specific information
    const esoInfo = standard.eso || '';
    const ojReference = standard.oj_reference || '';
    const restriction = standard.restriction || '';
    const withdrawalDate = standard.withdrawal_date || '';
    const withdrawalRef = standard.withdrawal_reference || '';
    
    // Status determination
    const isWithdrawn = withdrawalDate && withdrawalDate !== '-' && withdrawalDate.trim() !== '';
    const statusClass = isWithdrawn ? 'withdrawn' : 'current';
    const statusText = isWithdrawn ? 'Withdrawn' : 'Current';
    const statusIcon = isWithdrawn ? 'fa-times-circle' : 'fa-check-circle';

    item.innerHTML = `
        <div class="standard-header">
            <div class="standard-number-container">
                <strong class="standard-number-bold">${displayNumber}</strong>
                ${dateInfo ? `<span class="standard-date">${dateInfo}</span>` : ''}
                ${directiveBadge}
                ${esoInfo ? `<span class="standard-eso">${esoInfo}</span>` : ''}
            </div>
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

function loadCertificateData() {
    const selectedType = document.getElementById('certificate-type-select').value;
    
    if (!selectedType || !PREDEFINED_CERTIFICATES[selectedType]) {
        showError('Please select a valid certificate type');
        return;
    }
    
    showLoading();
    
    try {
        // Get the predefined certificate data
        const certificateData = JSON.parse(JSON.stringify(PREDEFINED_CERTIFICATES[selectedType]));
        
        // Calculate categories and totals
        certificateData.categories = categorizeStandards(certificateData.test_standards);
        certificateData.total_standards = certificateData.test_standards.length;
        
        // Set global variable
        uploadedCertificateData = certificateData;
        
        // Display the results
        displayCertificateResults(certificateData);
        updateCompareTabState();
        
        showSuccess(`${selectedType.toUpperCase()} certificate data loaded successfully!`);
    } catch (error) {
        console.error('Error loading certificate data:', error);
        showError(`Failed to load certificate data: ${error.message}`);
    } finally {
        hideLoading();
    }
}

// Helper function to categorize standards
function categorizeStandards(testStandards) {
    const categories = {};
    
    testStandards.forEach(standard => {
        const category = standard.category;
        if (!categories[category]) {
            categories[category] = [];
        }
        categories[category].push(standard.standard_number);
    });
    
    return categories;
}

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

    if (data.certificate_type === 'JAB_Predefined' && data.facilities) {
        // JAB style display with facilities
        data.facilities.forEach(facility => {
            const facilityItem = document.createElement('div');
            facilityItem.className = 'facility-item';
            
            // Get standards for this facility
            const facilityStandards = data.test_standards.filter(std => 
                std.facility && std.facility.includes(facility.name)
            );
            
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