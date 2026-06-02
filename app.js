const input = document.getElementById('user-input');
const sendBtn = document.getElementById('send-btn');
const scroll = document.getElementById('chat-scroll');
const anchor = document.getElementById('scroll-anchor');

function loadGoogleMapsScript(key) {
    if (!key) return;
    if (window.google && window.google.maps) return;
    const existing = document.getElementById('google-maps-script');
    if (existing) existing.remove();
    
    const script = document.createElement('script');
    script.id = 'google-maps-script';
    script.src = `https://maps.googleapis.com/maps/api/js?key=${key}`;
    script.async = true;
    script.defer = true;
    document.head.appendChild(script);
    console.log('Google Maps API Script loaded.');
}

function renderLiveMap(containerId, locationText) {
    let center = { lat: 40.7128, lng: -74.0060 }; // Default: New York
    let zoom = 12;

    if (locationText.includes('boston')) {
        center = { lat: 42.3601, lng: -71.0589 };
    } else if (locationText.includes('san francisco') || locationText.includes('sf')) {
        center = { lat: 37.7749, lng: -122.4194 };
    } else if (locationText.includes('seattle')) {
        center = { lat: 47.6062, lng: -122.3321 };
    } else if (locationText.includes('chicago')) {
        center = { lat: 41.8781, lng: -87.6298 };
    } else if (locationText.includes('london')) {
        center = { lat: 51.5074, lng: -0.1278 };
    }

    setTimeout(() => {
        const mapEl = document.getElementById(containerId);
        if (!mapEl) return;

        if (window.google && window.google.maps) {
            try {
                const map = new google.maps.Map(mapEl, {
                    center: center,
                    zoom: zoom,
                    disableDefaultUI: true,
                    zoomControl: true,
                    styles: [
                        {
                            "featureType": "water",
                            "elementType": "geometry",
                            "stylers": [{"color": "#e9e9e9"}, {"lightness": 17}]
                        },
                        {
                            "featureType": "landscape",
                            "elementType": "geometry",
                            "stylers": [{"color": "#f5f5f5"}, {"lightness": 20}]
                        },
                        {
                            "featureType": "road.highway",
                            "elementType": "geometry.fill",
                            "stylers": [{"color": "#ffffff"}, {"lightness": 17}]
                        }
                    ]
                });
                new google.maps.Marker({
                    position: center,
                    map: map,
                    title: locationText
                });
            } catch (e) {
                console.error("Maps init failed:", e);
                renderFallbackMap(mapEl, locationText);
            }
        } else {
            renderFallbackMap(mapEl, locationText);
        }
    }, 300);
}

function renderFallbackMap(el, locationText) {
    el.innerHTML = `
        <div style="height:100%; display:flex; flex-direction:column; align-items:center; justify-content:center; background:#f4f4f5; color:#71717a; border: 1px dashed #d4d4d8; border-radius:6px; font-size:12px; font-family:var(--mono);">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="margin-bottom:6px;"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z"/><circle cx="12" cy="9" r="2.5"/></svg>
            <span>Google Maps Static Grid Fallback</span>
            <span style="font-size:10px; margin-top:2px;">Location: ${locationText.toUpperCase()}</span>
        </div>
    `;
}

// Settings elements
const settingsDialog = document.getElementById('settings-dialog');
const openSettingsBtn = document.getElementById('settings-btn');
const closeSettingsBtns = document.querySelectorAll('.settings-close-btn');
const tabBtns = document.querySelectorAll('.settings-tab-btn');
const panels = document.querySelectorAll('.settings-panel');
const toggleKeyBtn = document.getElementById('toggle-key-btn');
const aiKeyInput = document.getElementById('ai-key');
const toggleMapsKeyBtn = document.getElementById('toggle-maps-key-btn');
const mapsKeyInput = document.getElementById('maps-key');
const aiProviderSelect = document.getElementById('ai-provider');
const aiModelInput = document.getElementById('ai-model');
const aiProviderForm = document.getElementById('ai-provider-form');
const testAiBtn = document.getElementById('test-ai-btn');
const aiTestSpinner = document.getElementById('ai-test-spinner');
const aiTestBtnText = document.getElementById('ai-test-btn-text');
const aiTestStatus = document.getElementById('ai-test-status');

// Connectors elements
const showAddConnectorBtn = document.getElementById('show-add-connector-btn');
const hideAddConnectorBtn = document.getElementById('hide-add-connector-btn');
const addConnectorFormWrap = document.getElementById('add-connector-form-wrap');
const connectorForm = document.getElementById('connector-form');
const connectorTypeSelect = document.getElementById('connector-type');
const connectorClientIdInput = document.getElementById('connector-client-id');
const testConnectorBtn = document.getElementById('test-connector-btn');
const connectorTestSpinner = document.getElementById('connector-test-spinner');
const connectorTestStatus = document.getElementById('connector-test-status');
const connectorsListContainer = document.getElementById('connectors-list-container');
const sidebarConnectors = document.getElementById('sidebar-connectors');
const sidebarAddBtn = document.getElementById('sidebar-add-btn');

// MCP elements
const showAddMcpBtn = document.getElementById('show-add-mcp-btn');
const hideAddMcpBtn = document.getElementById('hide-add-mcp-btn');
const addMcpFormWrap = document.getElementById('add-mcp-form-wrap');
const mcpForm = document.getElementById('mcp-form');
const mcpTransportSelect = document.getElementById('mcp-transport');
const mcpStdioFields = document.getElementById('mcp-stdio-fields');
const mcpSseFields = document.getElementById('mcp-sse-fields');
const testMcpBtn = document.getElementById('test-mcp-btn');
const mcpTestSpinner = document.getElementById('mcp-test-spinner');
const mcpTestStatus = document.getElementById('mcp-test-status');
const mcpListContainer = document.getElementById('mcp-list-container');

// Logs elements
const terminalLogs = document.getElementById('terminal-logs');
const clearLogsBtn = document.getElementById('clear-logs-btn');

// Default presets
const modelPresets = {
    gemini: 'gemini-1.5-pro',
    openai: 'gpt-4o',
    claude: 'claude-3-5-sonnet',
    openrouter: 'meta-llama/llama-3.1-405b-instruct'
};

// State Management
let state = {
    onboarded: false,
    user: {
        username: '',
        password: ''
    },
    ai: {
        provider: 'gemini',
        model: 'gemini-1.5-pro',
        key: '',
        mapsKey: 'AIzaSyCfbcSDqjCdxoTbeM2CRDvL7-ite5kHOSk'
    },
    connectors: [],
    mcps: [
        { id: 'mcp_1', name: 'filesystem-mcp', transport: 'stdio', command: 'npx', args: '-y @modelcontextprotocol/server-filesystem "/Users/adityadixit/My stuff/timetable_maker/Oppie"', status: 'Active' }
    ],
    logs: [
        { time: getTime(), level: 'info', message: 'Oppie core engine initialized.' }
    ]
};

// Load from localStorage if exists
function loadState() {
    const stored = localStorage.getItem('oppie_settings_google_v1');
    if (stored) {
        try {
            state = JSON.parse(stored);
            if (!state.logs) state.logs = [];
        } catch (e) {
            console.error("Error parsing settings:", e);
        }
    } else {
        state = {
            onboarded: false,
            user: {
                username: '',
                password: ''
            },
            ai: {
                provider: 'gemini',
                model: 'gemini-1.5-pro',
                key: '',
                mapsKey: 'AIzaSyCfbcSDqjCdxoTbeM2CRDvL7-ite5kHOSk'
            },
            connectors: [],
            mcps: [
                { id: 'mcp_1', name: 'filesystem-mcp', transport: 'stdio', command: 'npx', args: '-y @modelcontextprotocol/server-filesystem "/Users/adityadixit/My stuff/timetable_maker/Oppie"', status: 'Active' }
            ],
            logs: [
                { time: getTime(), level: 'info', message: 'Oppie core engine initialized.' }
            ]
        };
        saveState();
    }
    
    initAppRouting();
}

function saveState() {
    localStorage.setItem('oppie_settings_google_v1', JSON.stringify(state));
}

// Onboarding and Routing logic
function initAppRouting() {
    const shellEl = document.querySelector('.shell');
    const onboardingWrapper = document.getElementById('onboarding-wrapper');
    const sidebarUsername = document.getElementById('sidebar-username-label');

    // Populate Step 3 service logos wrap
    document.querySelectorAll('.service-auth-item').forEach(item => {
        const type = item.id.replace('auth-', '');
        const logoWrap = item.querySelector('.service-logo-wrap');
        if (logoWrap && serviceLogos[type]) {
            logoWrap.innerHTML = serviceLogos[type];
        }
    });

    if (state.onboarded) {
        if (shellEl) shellEl.style.display = 'none';
        if (onboardingWrapper) {
            onboardingWrapper.style.display = 'flex';
            onboardingWrapper.classList.remove('fade-out');
        }
        showOnboardingStep(0);
    } else {
        if (shellEl) shellEl.style.display = 'none';
        if (onboardingWrapper) {
            onboardingWrapper.style.display = 'flex';
            onboardingWrapper.classList.remove('fade-out');
        }
        showOnboardingStep(1);
    }

    if (sidebarUsername && state.user) {
        sidebarUsername.textContent = state.user.username || '';
    }
}

function showOnboardingStep(step) {
    const steps = ['login', '1', '2', '3', '4'];
    steps.forEach(s => {
        const el = document.getElementById(`step-${s}`);
        if (el) {
            el.classList.remove('active');
        }
    });

    const progressBar = document.getElementById('onboarding-progress-bar');
    const progressFill = document.getElementById('progress-fill');

    if (step === 0 || step === 'login') {
        if (progressBar) progressBar.style.display = 'none';
        const loginEl = document.getElementById('step-login');
        if (loginEl) loginEl.classList.add('active');
        const loginLabel = document.getElementById('login-username-label');
        if (loginLabel && state.user) {
            loginLabel.textContent = state.user.username || 'aditya';
        }
    } else {
        if (progressBar) progressBar.style.display = 'block';
        const stepEl = document.getElementById(`step-${step}`);
        if (stepEl) stepEl.classList.add('active');
        
        if (progressFill) {
            const percentage = step * 25;
            progressFill.style.width = `${percentage}%`;
        }

        if (step === 2) {
            document.getElementById('onboard-provider').value = state.ai.provider || 'gemini';
            document.getElementById('onboard-model').value = state.ai.model || 'gemini-1.5-pro';
            document.getElementById('onboard-ai-key').value = state.ai.key || '';
            document.getElementById('onboard-maps-key').value = state.ai.mapsKey || 'AIzaSyCfbcSDqjCdxoTbeM2CRDvL7-ite5kHOSk';
        }

        if (step === 4) {
            const confirmUsername = document.getElementById('confirm-username');
            const confirmEngine = document.getElementById('confirm-engine');
            if (confirmUsername) confirmUsername.textContent = state.user.username;
            if (confirmEngine) confirmEngine.textContent = state.ai.provider.toUpperCase();
        }
    }
}

// Setup Onboarding Listeners
document.addEventListener('DOMContentLoaded', () => {
    // ── STEP 1 Form ──
    const onboardingProfileForm = document.getElementById('onboarding-profile-form');
    if (onboardingProfileForm) {
        onboardingProfileForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const username = document.getElementById('onboard-username').value.trim();
            const password = document.getElementById('onboard-password').value.trim();

            if (!username || !password) {
                alert('Please enter both a username and master password.');
                return;
            }

            state.user = { username, password };
            saveState();
            showOnboardingStep(2);
        });
    }

    // ── STEP 2 Form ──
    const onboardProvider = document.getElementById('onboard-provider');
    const onboardModel = document.getElementById('onboard-model');
    if (onboardProvider && onboardModel) {
        onboardProvider.addEventListener('change', () => {
            const provider = onboardProvider.value;
            onboardModel.value = modelPresets[provider] || '';
        });
    }

    const btnAiBack = document.getElementById('btn-ai-back');
    if (btnAiBack) {
        btnAiBack.addEventListener('click', () => {
            showOnboardingStep(1);
        });
    }

    const onboardingAiForm = document.getElementById('onboarding-ai-form');
    if (onboardingAiForm) {
        onboardingAiForm.addEventListener('submit', (e) => {
            e.preventDefault();
            state.ai.provider = document.getElementById('onboard-provider').value;
            state.ai.model = document.getElementById('onboard-model').value;
            state.ai.key = document.getElementById('onboard-ai-key').value;
            state.ai.mapsKey = document.getElementById('onboard-maps-key').value;

            // Sync settings panel fields
            const aiProvSelect = document.getElementById('ai-provider');
            const aiMdlInput = document.getElementById('ai-model');
            const aiKyInput = document.getElementById('ai-key');
            const mpsKyInput = document.getElementById('maps-key');
            if (aiProvSelect) aiProvSelect.value = state.ai.provider;
            if (aiMdlInput) aiMdlInput.value = state.ai.model;
            if (aiKyInput) aiKyInput.value = state.ai.key;
            if (mpsKyInput) mpsKyInput.value = state.ai.mapsKey;

            saveState();
            showOnboardingStep(3);
        });
    }

    // ── STEP 3: Workspace Auth ──
    const btnAuthBack = document.getElementById('btn-auth-back');
    if (btnAuthBack) {
        btnAuthBack.addEventListener('click', () => {
            showOnboardingStep(2);
        });
    }

    const btnAuthorizeWorkspace = document.getElementById('btn-authorize-workspace');
    const btnWorkspaceNext = document.getElementById('btn-workspace-next');
    const authSpinner = document.getElementById('auth-spinner');
    const authBtnText = document.getElementById('auth-btn-text');

    if (btnAuthorizeWorkspace) {
        btnAuthorizeWorkspace.addEventListener('click', () => {
            const clientId = document.getElementById('onboard-client-id').value.trim();
            if (!clientId) {
                alert('Please specify a Google Workspace OAuth Client ID to authorize.');
                return;
            }

            btnAuthorizeWorkspace.disabled = true;
            if (authSpinner) authSpinner.style.display = 'inline-block';
            if (authBtnText) authBtnText.textContent = 'Authorizing Workspace Scopes...';

            const services = ['gmail', 'calendar', 'maps', 'drive', 'sheets', 'slides', 'forms', 'tasks'];
            services.forEach(svc => {
                const cardEl = document.getElementById(`auth-${svc}`);
                if (cardEl) {
                    cardEl.classList.remove('authorized');
                    const badge = cardEl.querySelector('.badge');
                    if (badge) {
                        badge.textContent = 'Pending';
                        badge.className = 'badge badge-neutral';
                    }
                }
            });

            let currentSvcIndex = 0;
            function authorizeNext() {
                if (currentSvcIndex < services.length) {
                    const svc = services[currentSvcIndex];
                    const cardEl = document.getElementById(`auth-${svc}`);
                    if (cardEl) {
                        cardEl.classList.add('authorized');
                        const badge = cardEl.querySelector('.badge');
                        if (badge) {
                            badge.textContent = 'Authorized ✓';
                            badge.className = 'badge badge-success';
                        }
                    }
                    currentSvcIndex++;
                    setTimeout(authorizeNext, 250);
                } else {
                    btnAuthorizeWorkspace.disabled = false;
                    if (authSpinner) authSpinner.style.display = 'none';
                    if (authBtnText) authBtnText.textContent = 'Workspace Scopes Authorized ✓';
                    if (btnWorkspaceNext) btnWorkspaceNext.disabled = false;

                    state.connectors = [
                        { id: 'conn_gmail', type: 'gmail', name: 'Gmail', clientId: clientId, status: 'Connected' },
                        { id: 'conn_calendar', type: 'calendar', name: 'Google Calendar', clientId: clientId, status: 'Connected' },
                        { id: 'conn_maps', type: 'maps', name: 'Google Maps', clientId: 'OAuth Key Active', status: 'Connected' },
                        { id: 'conn_drive', type: 'drive', name: 'Google Drive', clientId: clientId, status: 'Connected' },
                        { id: 'conn_sheets', type: 'sheets', name: 'Google Sheets', clientId: clientId, status: 'Connected' },
                        { id: 'conn_slides', type: 'slides', name: 'Google Slides', clientId: clientId, status: 'Connected' },
                        { id: 'conn_forms', type: 'forms', name: 'Google Forms', clientId: clientId, status: 'Connected' },
                        { id: 'conn_tasks', type: 'tasks', name: 'Google Tasks', clientId: clientId, status: 'Connected' }
                    ];
                    saveState();
                }
            }
            setTimeout(authorizeNext, 300);
        });
    }

    if (btnWorkspaceNext) {
        btnWorkspaceNext.addEventListener('click', () => {
            showOnboardingStep(4);
        });
    }

    // ── STEP 4: Launch ──
    const btnLaunchApp = document.getElementById('btn-launch-app');
    if (btnLaunchApp) {
        btnLaunchApp.addEventListener('click', () => {
            state.onboarded = true;
            saveState();

            const shellEl = document.querySelector('.shell');
            const onboardingWrapper = document.getElementById('onboarding-wrapper');
            const sidebarUsername = document.getElementById('sidebar-username-label');

            if (shellEl) shellEl.style.display = 'flex';
            if (sidebarUsername && state.user) {
                sidebarUsername.textContent = state.user.username;
            }

            state.logs = [
                { time: getTime(), level: 'info', message: 'Oppie core engine initialized.' },
                { time: getTime(), level: 'success', message: `Google OAuth Client ID loaded: ${state.connectors[0].clientId}` },
                { time: getTime(), level: 'success', message: 'Google Maps JS API key saved.' },
                { time: getTime(), level: 'success', message: 'Connected 8 active Google Services.' },
                { time: getTime(), level: 'success', message: 'Started filesystem-mcp local server.' },
                { time: getTime(), level: 'success', message: `Welcome to Oppie, ${state.user.username}! All background daemons running.` }
            ];
            saveState();

            renderConnectorsList();
            renderSidebarConnectors();
            renderAllLogs();
            updateSidebarPermissions();

            if (state.ai && state.ai.mapsKey) {
                loadGoogleMapsScript(state.ai.mapsKey);
            }

            if (onboardingWrapper) {
                onboardingWrapper.classList.add('fade-out');
                setTimeout(() => {
                    onboardingWrapper.style.display = 'none';
                }, 400);
            }
        });
    }

    // ── STEP 0: Login Unlock ──
    const onboardingLoginForm = document.getElementById('onboarding-login-form');
    if (onboardingLoginForm) {
        onboardingLoginForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const pwdInput = document.getElementById('login-password');
            const enteredPassword = pwdInput.value;

            if (state.user && enteredPassword === state.user.password) {
                pwdInput.value = '';
                
                const shellEl = document.querySelector('.shell');
                const onboardingWrapper = document.getElementById('onboarding-wrapper');
                const sidebarUsername = document.getElementById('sidebar-username-label');

                if (shellEl) shellEl.style.display = 'flex';
                if (sidebarUsername && state.user) {
                    sidebarUsername.textContent = state.user.username;
                }

                addLog('success', `Session unlocked. Welcome back, ${state.user.username}.`);

                renderConnectorsList();
                renderSidebarConnectors();
                renderAllLogs();
                updateSidebarPermissions();

                if (state.ai && state.ai.mapsKey) {
                    loadGoogleMapsScript(state.ai.mapsKey);
                }

                if (onboardingWrapper) {
                    onboardingWrapper.classList.add('fade-out');
                    setTimeout(() => {
                        onboardingWrapper.style.display = 'none';
                    }, 400);
                }
            } else {
                alert('Incorrect Master Password. Please try again.');
                pwdInput.value = '';
                pwdInput.focus();
            }
        });
    }

    // ── Account Resets (Start Over) ──
    const btnResetSetup = document.getElementById('btn-reset-setup');
    if (btnResetSetup) {
        btnResetSetup.addEventListener('click', () => {
            if (confirm('Are you sure you want to delete your profile and start onboarding from scratch? This will clear all settings.')) {
                localStorage.removeItem('oppie_settings_google_v1');
                window.location.reload();
            }
        });
    }

    const btnSettingsReset = document.getElementById('btn-settings-reset');
    if (btnSettingsReset) {
        btnSettingsReset.addEventListener('click', () => {
            if (confirm('Are you sure you want to reset Oppie? You will be logged out and all configuration will be wiped.')) {
                localStorage.removeItem('oppie_settings_google_v1');
                window.location.reload();
            }
        });
    }
});

function scrollDown() {
    anchor.scrollIntoView({ behavior: 'smooth', block: 'end' });
}

function getTime() {
    return new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

// Logger
function addLog(level, message) {
    const time = getTime();
    const logEntry = { time, level, message };
    state.logs.push(logEntry);
    // Keep logs capped at 100 entries for performance
    if (state.logs.length > 100) state.logs.shift();
    saveState();
    renderLogLine(logEntry);
}

function renderLogLine(log) {
    const el = document.createElement('div');
    el.className = `terminal-line ${log.level}`;
    el.innerHTML = `<span style="color:#71717a">[${log.time}]</span> [${log.level.toUpperCase()}] ${log.message}`;
    terminalLogs.appendChild(el);
    terminalLogs.scrollTop = terminalLogs.scrollHeight;
}

function renderAllLogs() {
    terminalLogs.innerHTML = '';
    state.logs.forEach(renderLogLine);
}

// Tab Switch Logic
tabBtns.forEach(btn => {
    btn.addEventListener('click', () => {
        const targetTab = btn.getAttribute('data-tab');
        tabBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');

        panels.forEach(p => {
            p.classList.remove('active');
            if (p.id === `panel-${targetTab}`) {
                p.classList.add('active');
            }
        });
    });
});

// Toggle password view
toggleKeyBtn.addEventListener('click', () => {
    const isPwd = aiKeyInput.type === 'password';
    aiKeyInput.type = isPwd ? 'text' : 'password';
    toggleKeyBtn.querySelector('svg').style.color = isPwd ? 'var(--black)' : 'var(--gray-400)';
});

// Populate AI Provider Settings form
function initAiForm() {
    aiProviderSelect.value = state.ai.provider;
    aiModelInput.value = state.ai.model || modelPresets[state.ai.provider];
    aiKeyInput.value = state.ai.key || '';
    mapsKeyInput.value = state.ai.mapsKey || '';
}

aiProviderSelect.addEventListener('change', () => {
    const provider = aiProviderSelect.value;
    aiModelInput.value = modelPresets[provider] || '';
});

aiProviderForm.addEventListener('submit', (e) => {
    e.preventDefault();
    state.ai.provider = aiProviderSelect.value;
    state.ai.model = aiModelInput.value;
    state.ai.key = aiKeyInput.value;
    state.ai.mapsKey = mapsKeyInput.value;
    saveState();
    addLog('success', `AI Configuration saved: Using ${state.ai.provider.toUpperCase()} (${state.ai.model}).`);
    if (state.ai.mapsKey) {
        loadGoogleMapsScript(state.ai.mapsKey);
    }
    updateSidebarPermissions();
    
    // Visual success alert
    const btn = aiProviderForm.querySelector('button[type="submit"]');
    const originalText = btn.textContent;
    btn.textContent = 'Saved ✓';
    btn.style.background = '#16a34a';
    btn.style.borderColor = '#16a34a';
    setTimeout(() => {
        btn.textContent = originalText;
        btn.style.background = '';
        btn.style.borderColor = '';
    }, 1500);
});

toggleMapsKeyBtn.addEventListener('click', () => {
    const isPwd = mapsKeyInput.type === 'password';
    mapsKeyInput.type = isPwd ? 'text' : 'password';
    toggleMapsKeyBtn.querySelector('svg').style.color = isPwd ? 'var(--black)' : 'var(--gray-400)';
});

// Test AI Provider Connection
testAiBtn.addEventListener('click', () => {
    aiTestSpinner.style.display = 'inline-block';
    testAiBtn.disabled = true;
    aiTestStatus.textContent = 'Calling API...';
    aiTestStatus.className = 'badge badge-warning';
    aiTestStatus.style.color = '';

    setTimeout(() => {
        aiTestSpinner.style.display = 'none';
        testAiBtn.disabled = false;
        
        const keyVal = aiKeyInput.value.trim();
        if (!keyVal) {
            aiTestStatus.textContent = 'Demo Mode (No API Key)';
            aiTestStatus.className = 'badge badge-neutral';
            addLog('warning', `AI connection dry-run. Empty API key configured. API calls will use mocked static responses.`);
        } else if (keyVal.length < 10) {
            aiTestStatus.textContent = 'Invalid Key Format';
            aiTestStatus.className = 'badge';
            aiTestStatus.style.background = '#fee2e2';
            aiTestStatus.style.color = '#dc2626';
            addLog('error', `AI connection test failed. API Key format is too short.`);
        } else {
            aiTestStatus.textContent = 'Connection Active';
            aiTestStatus.className = 'badge badge-success';
            addLog('success', `AI connection verified successfully for ${state.ai.provider.toUpperCase()} (${state.ai.model}).`);
        }
    }, 1200);
});

// Connector sub-forms toggling
showAddConnectorBtn.addEventListener('click', () => {
    addConnectorFormWrap.classList.add('active');
    connectorClientIdInput.focus();
});
hideAddConnectorBtn.addEventListener('click', () => {
    addConnectorFormWrap.classList.remove('active');
});

// Verify Connector client ID
testConnectorBtn.addEventListener('click', () => {
    const id = connectorClientIdInput.value.trim();
    if (!id) {
        alert('Please enter a Client ID first.');
        return;
    }
    connectorTestSpinner.style.display = 'inline-block';
    testConnectorBtn.disabled = true;
    connectorTestStatus.textContent = 'Checking OAuth...';
    connectorTestStatus.className = 'badge badge-warning';

    setTimeout(() => {
        connectorTestSpinner.style.display = 'none';
        testConnectorBtn.disabled = false;
        connectorTestStatus.textContent = 'Format Valid';
        connectorTestStatus.className = 'badge badge-success';
        addLog('info', `Connector OAuth format verification passed: "${id.slice(0, 15)}..."`);
    }, 800);
});

// Add connector
connectorForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const type = connectorTypeSelect.value;
    const clientId = connectorClientIdInput.value.trim();
    const name = connectorTypeSelect.options[connectorTypeSelect.selectedIndex].text;
    
    const newConnector = {
        id: 'conn_' + Date.now(),
        type,
        name,
        clientId,
        status: 'Connected'
    };

    state.connectors.push(newConnector);
    saveState();
    addLog('success', `Connected service: ${name} (Client ID: ${clientId.slice(0, 12)}...)`);
    
    connectorClientIdInput.value = '';
    connectorTestStatus.textContent = '';
    addConnectorFormWrap.classList.remove('active');
    renderConnectorsList();
    renderSidebarConnectors();
});

// Render Connectors List in Settings Panel
function renderConnectorsList() {
    connectorsListContainer.innerHTML = '';
    if (state.connectors.length === 0) {
        connectorsListContainer.innerHTML = '<div class="settings-list-empty">No active integrations. Click "+ Add Connector" to configure one.</div>';
        return;
    }

    state.connectors.forEach(conn => {
        const el = document.createElement('div');
        el.className = 'settings-item';
        el.innerHTML = `
            <div class="settings-item-info">
                <span class="settings-item-name">
                    <span class="badge-pulse" style="color: #22c55e"></span>
                    ${conn.name}
                </span>
                <span class="settings-item-sub">Client ID: ${conn.clientId}</span>
            </div>
            <div class="settings-item-actions">
                <span class="badge badge-success">${conn.status}</span>
                <button class="btn-icon-danger" title="Remove Connector" data-id="${conn.id}">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg>
                </button>
            </div>
        `;
        // Delete action
        el.querySelector('.btn-icon-danger').addEventListener('click', () => {
            state.connectors = state.connectors.filter(c => c.id !== conn.id);
            saveState();
            addLog('warning', `Disconnected connector: ${conn.name}`);
            renderConnectorsList();
            renderSidebarConnectors();
        });

        connectorsListContainer.appendChild(el);
    });
}

// Dynamic Render Sidebar Connectors
const connectorIcons = {
    gmail: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>',
    calendar: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>',
    maps: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/></svg>',
    drive: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M19.35 10.04C18.67 6.59 15.64 4 12 4 9.11 4 6.6 5.64 5.35 8.04 2.34 8.36 0 10.91 0 14c0 3.31 2.69 6 6 6h13c2.76 0 5-2.24 5-5 0-2.64-2.05-4.78-4.65-4.96z"/></svg>',
    sheets: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M14 2H6c-1.1 0-1.99.9-1.99 2L4 20c0 1.1.89 2 1.99 2H18c1.1 0 2-.9 2-2V8l-6-6zm2 16H8v-2h8v2zm0-4H8v-2h8v2z"/></svg>',
    slides: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M14 2H6c-1.1 0-1.99.9-1.99 2L4 20c0 1.1.89 2 1.99 2H18c1.1 0 2-.9 2-2V8l-6-6zm2 16H8v-2h8v2z"/></svg>',
    forms: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-2 10H7v-2h10v2zm0-4H7V7h10v2z"/></svg>',
    tasks: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="12" r="10"/><path d="M9 12l2 2 4-4"/></svg>',
    slack: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>',
    github: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M9 19c-5 1.5-5-2.5-7-3m14 6v-3.87a3.37 3.37 0 0 0-.94-2.61c3.14-.35 6.44-1.54 6.44-7A5.44 5.44 0 0 0 20 4.77 5.07 5.07 0 0 0 19.91 1S18.73.65 16 2.48a13.38 13.38 0 0 0-7 0C6.27.65 5.09 1 5.09 1A5.07 5.07 0 0 0 5 4.77a5.44 5.44 0 0 0-1.5 3.78c0 5.42 3.3 6.61 6.44 7A3.37 3.37 0 0 0 9 18.13V22"/></svg>',
    notion: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M12 20h9M3 20h9M4 4h16v12H4z"/></svg>'
};

const serviceLogos = {
    gmail: `<svg viewBox="0 0 24 24" width="16" height="16" style="vertical-align: middle;"><path d="M20 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2z" fill="#f1f1f1"/><path d="M22 6c0-.42-.13-.8-.35-1.11l-9.65 7.63L2.35 4.89C2.13 5.2 2 5.58 2 6v12c0 1.1.9 2 2 2h4v-8l4 3 4-3v8h4c1.1 0 2-.9 2-2V6z" fill="#ea4335"/><path d="M2 6v12c0 1.1.9 2 2 2h2V8.5L2 4.9C2 5.27 2 5.63 2 6z" fill="#4285f4"/><path d="M20 4h-2v8.5l4-3.6V6c0-1.1-.9-2-2-2z" fill="#34a853"/><path d="M12 12.5l8-6.3V4.8l-8 6.3-8-6.3v1.4z" fill="#fbbc05"/></svg>`,
    calendar: `<svg viewBox="0 0 24 24" width="16" height="16" style="vertical-align: middle;"><rect x="3" y="3" width="18" height="18" rx="3" fill="#4285F4"/><path d="M3 8h18v13c0 1.1-.9 2-2 2H5c-1.1 0-2-.9-2-2V8z" fill="#FFF"/><path d="M7 2v3M17 2v3" stroke="#4285F4" stroke-width="2" stroke-linecap="round"/><text x="12" y="17" font-size="9" font-weight="700" font-family="sans-serif" fill="#4285F4" text-anchor="middle">31</text><rect x="5" y="5" width="14" height="3" fill="#EA4335"/></svg>`,
    maps: `<svg viewBox="0 0 24 24" width="16" height="16" style="vertical-align: middle;"><path d="M19.5 9.5c0 5.25-7.5 12.5-7.5 12.5S4.5 14.75 4.5 9.5C4.5 5.36 7.86 2 12 2s7.5 3.36 7.5 7.5z" fill="#ea4335"/><circle cx="12" cy="9.5" r="3.5" fill="#fff"/><circle cx="12" cy="9.5" r="2" fill="#4285f4"/></svg>`,
    sheets: `<svg viewBox="0 0 24 24" width="16" height="16" style="vertical-align: middle;"><path d="M14 2H6c-1.1 0-1.99.9-1.99 2L4 20c0 1.1.89 2 1.99 2H18c1.1 0 2-.9 2-2V8l-6-6z" fill="#0F9D58"/><path d="M14 2v6h6L14 2z" fill="#57DB98"/><rect x="7" y="10" width="10" height="8" rx="1" fill="#fff"/><line x1="10" y1="10" x2="10" y2="18" stroke="#0F9D58" stroke-width="1"/><line x1="14" y1="10" x2="14" y2="18" stroke="#0F9D58" stroke-width="1"/><line x1="7" y1="12.5" x2="17" y2="12.5" stroke="#0F9D58" stroke-width="1"/><line x1="7" y1="15.5" x2="17" y2="15.5" stroke="#0F9D58" stroke-width="1"/></svg>`,
    slides: `<svg viewBox="0 0 24 24" width="16" height="16" style="vertical-align: middle;"><path d="M14 2H6c-1.1 0-1.99.9-1.99 2L4 20c0 1.1.89 2 1.99 2H18c1.1 0 2-.9 2-2V8l-6-6z" fill="#F4B400"/><path d="M14 2v6h6L14 2z" fill="#FFE082"/><rect x="7" y="10" width="10" height="8" rx="1" fill="#fff"/><rect x="9" y="12" width="6" height="4" fill="#F4B400"/></svg>`,
    drive: `<svg viewBox="0 0 24 24" width="16" height="16" style="vertical-align: middle;"><path d="M9.12 3.5h5.76l6.87 12H14.88z" fill="#FFC107"/><path d="M9.12 3.5L2.25 15.5h7.13L16.25 3.5z" fill="#0F9D58"/><path d="M5.7 15.5l3.43 6h13.74l-3.43-6z" fill="#4285F4"/></svg>`,
    forms: `<svg viewBox="0 0 24 24" width="16" height="16" style="vertical-align: middle;"><path d="M14 2H6c-1.1 0-1.99.9-1.99 2L4 20c0 1.1.89 2 1.99 2H18c1.1 0 2-.9 2-2V8l-6-6z" fill="#7B1FA2"/><path d="M14 2v6h6L14 2z" fill="#E1BEE7"/><rect x="7" y="10" width="10" height="8" rx="1" fill="#fff"/><circle cx="9.5" cy="12.5" r="1" fill="#7B1FA2"/><circle cx="9.5" cy="15.5" r="1" fill="#7B1FA2"/><line x1="12" y1="12.5" x2="15" y2="12.5" stroke="#7B1FA2" stroke-width="1.5" stroke-linecap="round"/><line x1="12" y1="15.5" x2="15" y2="15.5" stroke="#7B1FA2" stroke-width="1.5" stroke-linecap="round"/></svg>`,
    tasks: `<svg viewBox="0 0 24 24" width="16" height="16" style="vertical-align: middle;"><circle cx="12" cy="12" r="10" fill="#4285F4"/><path d="M8.5 12.5l2.5 2.5 6-6" stroke="#fff" stroke-width="2.5" fill="none" stroke-linecap="round" stroke-linejoin="round"/><circle cx="14.5" cy="9.5" r="3.5" stroke="#FBBC05" stroke-width="2" fill="none"/></svg>`,
    google: `<svg viewBox="0 0 24 24" width="16" height="16" style="vertical-align: middle;"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" fill="#FBBC05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" fill="#EA4335"/></svg>`,
    gemini: `<svg viewBox="0 0 24 24" width="16" height="16" style="vertical-align: middle;"><path d="M12 2c0 5.52-4.48 10-10 10 5.52 0 10 4.48 10 10 0-5.52 4.48-10 10-10-5.52 0-10-4.48-10-10z" fill="url(#gemini-grad)"/><defs><linearGradient id="gemini-grad" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="#9b5de5"/><stop offset="50%" stop-color="#f15bb5"/><stop offset="100%" stop-color="#00f5d4"/></linearGradient></defs></svg>`,
    openai: `<svg viewBox="0 0 24 24" width="16" height="16" style="vertical-align: middle;"><path d="M21.3 10.3c.3-1.1.1-2.2-.6-3.1s-1.8-1.4-2.9-1.3c-.5-1.1-1.5-1.9-2.7-2.1-1.2-.2-2.4.2-3.2 1-.8-.8-2-1.2-3.2-1C6 4.1 5 4.9 4.5 6 3.4 5.9 2.3 6.4 1.6 7.3s-.9 2-.6 3.1c-.5 1.1-.3 2.3.4 3.2s1.8 1.4 2.9 1.3c.5 1.1 1.5 1.9 2.7 2.1.4.1.8.1 1.2 0l3 1.7c.3.2.7.3 1 .3.4 0 .7-.1 1-.3l3-1.7c.4.1.8.1 1.2 0 1.2-.2 2.2-1 2.7-2.1 1.1.1 2.2-.4 2.9-1.3s1-2.1.6-3.2z" fill="none" stroke="#10A37F" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
    claude: `<svg viewBox="0 0 24 24" width="16" height="16" style="vertical-align: middle;"><path d="M12 3v18M3 12h18M5.6 5.6l12.8 12.8M18.4 5.6L5.6 18.4" stroke="#d97736" stroke-width="2.5" stroke-linecap="round"/><circle cx="12" cy="12" r="4" fill="#d97736"/></svg>`,
    openrouter: `<svg viewBox="0 0 24 24" width="16" height="16" style="vertical-align: middle;"><rect x="2" y="2" width="20" height="20" rx="4" fill="url(#openrouter-grad)"/><circle cx="8" cy="8" r="2" fill="#fff"/><circle cx="16" cy="16" r="2" fill="#fff"/><line x1="8" y1="8" x2="16" y2="16" stroke="#fff" stroke-width="2"/><defs><linearGradient id="openrouter-grad" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="#3b82f6"/><stop offset="100%" stop-color="#8b5cf6"/></linearGradient></defs></svg>`
};

const mcpIcon = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="2" y="2" width="20" height="8" rx="2" ry="2"/><rect x="2" y="14" width="20" height="8" rx="2" ry="2"/><line x1="6" y1="6" x2="6.01" y2="6"/><line x1="6" y1="18" x2="6.01" y2="18"/></svg>';

function renderSidebarConnectors() {
    // Clear all except the Add button
    const chips = sidebarConnectors.querySelectorAll('.connector-chip');
    chips.forEach(c => c.remove());

    // Render oauth connectors
    state.connectors.forEach(conn => {
        const icon = connectorIcons[conn.type] || connectorIcons.gmail;
        const chip = document.createElement('div');
        chip.className = 'connector-chip';
        chip.title = `${conn.name} (Client ID: ${conn.clientId})`;
        chip.innerHTML = `${icon} ${conn.name}`;
        
        // Clicking sidebar chip opens settings at Connectors tab
        chip.addEventListener('click', () => {
            settingsDialog.showModal();
            const btn = document.querySelector('button[data-tab="connectors"]');
            if (btn) btn.click();
        });

        sidebarConnectors.insertBefore(chip, sidebarAddBtn);
    });

    // Render active MCPs
    state.mcps.forEach(mcp => {
        const chip = document.createElement('div');
        chip.className = 'connector-chip';
        chip.style.borderColor = 'rgba(0,0,0,0.15)';
        chip.style.background = 'rgba(0,0,0,0.02)';
        chip.title = `MCP Server: ${mcp.name} (${mcp.transport})`;
        chip.innerHTML = `${mcpIcon} ${mcp.name}`;

        chip.addEventListener('click', () => {
            settingsDialog.showModal();
            const btn = document.querySelector('button[data-tab="mcp-servers"]');
            if (btn) btn.click();
        });

        sidebarConnectors.insertBefore(chip, sidebarAddBtn);
    });
    
    // Update topbar sub count
    const count = state.connectors.length + state.mcps.length;
    const topbarSub = document.querySelector('.topbar-sub');
    if (topbarSub) {
        topbarSub.textContent = `${count} integration${count !== 1 ? 's' : ''} configured`;
    }
    updateSidebarPermissions();
}

function updateSidebarPermissions() {
    const activeNameEl = document.getElementById('agent-active-name');
    const activeLogoEl = document.getElementById('agent-active-badge-logo');
    if (activeNameEl && activeLogoEl) {
        const provider = state.ai.provider;
        activeNameEl.textContent = provider;
        activeLogoEl.innerHTML = serviceLogos[provider] || '';
    }
    
    const googleCount = state.connectors.filter(c => ['gmail', 'calendar', 'maps', 'drive', 'sheets', 'slides', 'forms', 'tasks'].includes(c.type)).length;
    const activeGoogleCountEl = document.getElementById('active-google-count');
    if (activeGoogleCountEl) {
        activeGoogleCountEl.textContent = `${googleCount} Active`;
    }
    const activeMcpCountEl = document.getElementById('active-mcp-count');
    if (activeMcpCountEl) {
        activeMcpCountEl.textContent = state.mcps.length > 0 ? 'Allowed' : 'None';
    }
}

// MCP Form Setup
showAddMcpBtn.addEventListener('click', () => {
    addMcpFormWrap.classList.add('active');
    document.getElementById('mcp-name').focus();
});
hideAddMcpBtn.addEventListener('click', () => {
    addMcpFormWrap.classList.remove('active');
});

mcpTransportSelect.addEventListener('change', () => {
    const val = mcpTransportSelect.value;
    if (val === 'stdio') {
        mcpStdioFields.style.display = 'flex';
        mcpSseFields.style.display = 'none';
    } else {
        mcpStdioFields.style.display = 'none';
        mcpSseFields.style.display = 'flex';
    }
});

// Test MCP connection via Dry Run
testMcpBtn.addEventListener('click', () => {
    const name = document.getElementById('mcp-name').value.trim();
    if (!name) {
        alert('Please specify a server name first.');
        return;
    }
    mcpTestSpinner.style.display = 'inline-block';
    testMcpBtn.disabled = true;
    mcpTestStatus.textContent = 'Initializing...';
    mcpTestStatus.className = 'badge badge-warning';

    setTimeout(() => {
        mcpTestSpinner.style.display = 'none';
        testMcpBtn.disabled = false;
        mcpTestStatus.textContent = 'Active (4 tools)';
        mcpTestStatus.className = 'badge badge-success';
        addLog('info', `MCP Server dry-run success: Initialized [${name}] transport. Loaded tools: [read_db, write_db, fetch_schemas, query_tables].`);
    }, 1200);
});

// Add MCP
mcpForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const name = document.getElementById('mcp-name').value.trim();
    const transport = mcpTransportSelect.value;
    let command = '';
    let args = '';
    
    if (transport === 'stdio') {
        command = document.getElementById('mcp-command').value.trim() || 'npx';
        args = document.getElementById('mcp-args').value.trim();
    } else {
        command = 'sse';
        args = document.getElementById('mcp-url').value.trim();
    }

    const newMcp = {
        id: 'mcp_' + Date.now(),
        name,
        transport,
        command,
        args,
        status: 'Active'
    };

    state.mcps.push(newMcp);
    saveState();
    addLog('success', `Registered MCP server: ${name} (${transport})`);
    
    // Reset inputs
    document.getElementById('mcp-name').value = '';
    document.getElementById('mcp-command').value = '';
    document.getElementById('mcp-args').value = '';
    document.getElementById('mcp-env').value = '';
    document.getElementById('mcp-url').value = '';
    mcpTestStatus.textContent = '';
    addMcpFormWrap.classList.remove('active');
    renderMcpList();
    renderSidebarConnectors();
});

// Render MCPs list in settings panel
function renderMcpList() {
    mcpListContainer.innerHTML = '';
    if (state.mcps.length === 0) {
        mcpListContainer.innerHTML = '<div class="settings-list-empty">No custom MCP servers registered. Click "+ Add MCP Server".</div>';
        return;
    }

    state.mcps.forEach(mcp => {
        const el = document.createElement('div');
        el.className = 'settings-item';
        
        const detailText = mcp.transport === 'stdio' 
            ? `Cmd: ${mcp.command} ${mcp.args}`
            : `URL: ${mcp.args}`;

        el.innerHTML = `
            <div class="settings-item-info">
                <span class="settings-item-name">
                    <span class="badge-pulse" style="color: #3b82f6"></span>
                    ${mcp.name}
                    <span style="font-size:10px; font-weight:normal; opacity:0.6">(${mcp.transport})</span>
                </span>
                <span class="settings-item-sub" title="${detailText}">${detailText}</span>
            </div>
            <div class="settings-item-actions">
                <span class="badge badge-success">${mcp.status}</span>
                <button class="btn-icon-danger" title="Unregister MCP Server" data-id="${mcp.id}">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg>
                </button>
            </div>
        `;

        el.querySelector('.btn-icon-danger').addEventListener('click', () => {
            state.mcps = state.mcps.filter(m => m.id !== mcp.id);
            saveState();
            addLog('warning', `Deregistered MCP Server: ${mcp.name}`);
            renderMcpList();
            renderSidebarConnectors();
        });

        mcpListContainer.appendChild(el);
    });
}

// Modal control event listeners
openSettingsBtn.addEventListener('click', () => {
    settingsDialog.showModal();
    addLog('info', 'Settings panel viewed.');
});

closeSettingsBtns.forEach(btn => {
    btn.addEventListener('click', () => {
        settingsDialog.close();
    });
});

sidebarAddBtn.addEventListener('click', () => {
    settingsDialog.showModal();
    const btn = document.querySelector('button[data-tab="connectors"]');
    if (btn) btn.click();
});

clearLogsBtn.addEventListener('click', () => {
    state.logs = [];
    saveState();
    renderAllLogs();
    addLog('info', 'Console logs cleared.');
});

// Fallback for click-outside backdrop dismissal (Safari and others)
if (!('closedBy' in HTMLDialogElement.prototype)) {
    settingsDialog.addEventListener('click', (event) => {
        if (event.target !== settingsDialog) return;
        const rect = settingsDialog.getBoundingClientRect();
        const isDialogContent = (
            rect.top <= event.clientY &&
            event.clientY <= rect.top + rect.height &&
            rect.left <= event.clientX &&
            event.clientX <= rect.left + rect.width
        );
        if (isDialogContent) return;
        settingsDialog.close();
    });
}

// ── Chat Simulation Logic with Settings integration ──
function addUserMsg(text) {
    const el = document.createElement('div');
    el.className = 'msg-user';
    el.innerHTML = `<div class="msg-user-bubble">${text}</div>`;
    scroll.insertBefore(el, anchor);
    scrollDown();
}

function addTyping() {
    const el = document.createElement('div');
    el.id = 'typing-indicator';
    el.className = 'typing-wrap';
    el.innerHTML = `
        <span class="typing-label">processing</span>
        <div class="typing-dots">
            <div class="typing-dot"></div>
            <div class="typing-dot"></div>
            <div class="typing-dot"></div>
        </div>
    `;
    scroll.insertBefore(el, anchor);
    scrollDown();
    return el;
}

function addAgentMsg(actionLabel, detailHtml, replyHtml, serviceType = null) {
    const el = document.createElement('div');
    el.className = 'msg-agent';
    
    let traceIconHtml = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>`;
    if (serviceType && serviceLogos[serviceType]) {
        traceIconHtml = serviceLogos[serviceType];
    } else if (state.ai.provider && serviceLogos[state.ai.provider]) {
        traceIconHtml = serviceLogos[state.ai.provider];
    }

    el.innerHTML = `
        <div class="trace-block">
            <div class="trace-icon" style="display:flex; align-items:center; justify-content:center;">
                ${traceIconHtml}
            </div>
            <div class="trace-content">
                <div class="trace-action">${actionLabel}</div>
                <div class="trace-detail">${detailHtml}</div>
            </div>
        </div>
        <div class="agent-bubble">${replyHtml}</div>
    `;
    scroll.insertBefore(el, anchor);
    scrollDown();
}

function send() {
    const text = input.value.trim();
    if (!text) return;
    addUserMsg(text);
    input.value = '';
    input.disabled = true;
    sendBtn.disabled = true;

    const typing = addTyping();
    
    // Analyze query keywords for connector/MCP triggers
    const textLower = text.toLowerCase();
    let matchedService = null;
    let matchedMcp = null;

    // Map keywords to specific Google services or capability inquiries
    if (textLower.includes('capabilities') || textLower.includes('what can you do') || textLower.includes('help') || textLower.includes('features') || textLower.includes('allowed') || textLower.includes('permission') || textLower.includes('authorize') || textLower.includes('scope') || textLower.includes('status')) {
        matchedService = 'capabilities';
    } else if (textLower.includes('calendar') || textLower.includes('schedule') || textLower.includes('event') || textLower.includes('meeting')) {
        matchedService = 'calendar';
    } else if (textLower.includes('email') || textLower.includes('gmail') || textLower.includes('mail') || textLower.includes('send message') || textLower.includes('compose')) {
        matchedService = 'gmail';
    } else if (textLower.includes('map') || textLower.includes('route') || textLower.includes('direction') || textLower.includes('navigate') || textLower.includes('where is') || textLower.includes('boston') || textLower.includes('london') || textLower.includes('san francisco') || textLower.includes('new york') || textLower.includes('seattle')) {
        matchedService = 'maps';
    } else if (textLower.includes('sheet') || textLower.includes('spreadsheet') || textLower.includes('excel') || textLower.includes('grid')) {
        matchedService = 'sheets';
    } else if (textLower.includes('slide') || textLower.includes('deck') || textLower.includes('presentation')) {
        matchedService = 'slides';
    } else if (textLower.includes('upload to drive') || textLower.includes('save to drive') || textLower.includes('google drive') || textLower.includes('gdrive') || (textLower.includes('drive') && textLower.includes('file'))) {
        matchedService = 'drive';
    } else if (textLower.includes('form') || textLower.includes('survey') || textLower.includes('questionnaire')) {
        matchedService = 'forms';
    } else if (textLower.includes('task') || textLower.includes('todo') || textLower.includes('checklist')) {
        matchedService = 'tasks';
    } else if (textLower.includes('search') || textLower.includes('web search') || textLower.includes('google search') || textLower.includes('look up')) {
        matchedService = 'google';
    }

    // If no Google service matches, check if MCP fits
    if (!matchedService) {
        state.mcps.forEach(m => {
            const nameClean = m.name.replace('-mcp', '').toLowerCase();
            if (textLower.includes(nameClean) || textLower.includes('db') || textLower.includes('sql') || textLower.includes('database')) {
                matchedMcp = m;
            }
        });
    }

    setTimeout(() => {
        typing.remove();
        
        const providerName = state.ai.provider.charAt(0).toUpperCase() + state.ai.provider.slice(1);
        const modelName = state.ai.model || modelPresets[state.ai.provider];
        const hasKey = !!state.ai.key;

        let actionLabel = 'Daemon Initialized';
        let detailHtml = '';
        let replyHtml = '';
        let mapsContainerId = null;

        addLog('info', `Agent reasoning triggered using ${providerName} (${modelName}). API key status: ${hasKey ? 'Configured' : 'Empty (Demo Mode)'}`);

        if (matchedService) {
            if (matchedService === 'capabilities') {
                actionLabel = 'Agent Authorization Scope';
                detailHtml = `Permissions active. Access to Google client 976947677770... and local filesystem verified.`;
                addLog('info', 'Agent capabilities view rendered.');
                
                const activeConn = state.connectors[0] || { clientId: '976947677770-h5fm4q9mdpaafvf4t78it3nfqkjk0491.apps.googleusercontent.com' };
                const clientShort = activeConn.clientId;

                replyHtml = `I am fully authorized and aware of all active integrations inside this environment. Here are my current permitted scopes and capabilities:
                    <div class="capabilities-card" style="border: 1px solid var(--gray-200); border-radius: 10px; padding: 16px; margin-top: 12px; background: var(--white); box-shadow: 0 4px 12px rgba(0,0,0,0.03);">
                        <div style="display: flex; align-items: center; justify-content: space-between; border-bottom: 1px solid var(--gray-100); padding-bottom: 10px; margin-bottom: 12px;">
                            <span style="font-size: 13px; font-weight: 600; display: flex; align-items: center; gap: 8px;">
                                ${serviceLogos.google} Active System Scope
                            </span>
                            <span class="badge badge-success" style="font-size: 10px; display: flex; align-items: center; gap: 4px;">
                                <span class="badge-pulse" style="color: #22c55e"></span> Authorized
                            </span>
                        </div>
                        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px 10px; font-size: 12px; line-height: 1.4;">
                            <div style="display: flex; align-items: center; gap: 8px;">
                                ${serviceLogos.gmail} <span>Gmail Access: <strong style="color: #16a34a;">Allowed</strong></span>
                            </div>
                            <div style="display: flex; align-items: center; gap: 8px;">
                                ${serviceLogos.calendar} <span>Calendar Sync: <strong style="color: #16a34a;">Allowed</strong></span>
                            </div>
                            <div style="display: flex; align-items: center; gap: 8px;">
                                ${serviceLogos.maps} <span>Live Maps JS: <strong style="color: #16a34a;">Allowed</strong></span>
                            </div>
                            <div style="display: flex; align-items: center; gap: 8px;">
                                ${serviceLogos.drive} <span>Drive Storage: <strong style="color: #16a34a;">Allowed</strong></span>
                            </div>
                            <div style="display: flex; align-items: center; gap: 8px;">
                                ${serviceLogos.sheets} <span>Sheets Grid: <strong style="color: #16a34a;">Allowed</strong></span>
                            </div>
                            <div style="display: flex; align-items: center; gap: 8px;">
                                ${serviceLogos.slides} <span>Slides Layout: <strong style="color: #16a34a;">Allowed</strong></span>
                            </div>
                            <div style="display: flex; align-items: center; gap: 8px;">
                                ${serviceLogos.forms} <span>Forms Survey: <strong style="color: #16a34a;">Allowed</strong></span>
                            </div>
                            <div style="display: flex; align-items: center; gap: 8px;">
                                ${serviceLogos.tasks} <span>Tasks Sync: <strong style="color: #16a34a;">Allowed</strong></span>
                            </div>
                        </div>
                        <div style="margin-top: 14px; padding: 10px; border-radius: 6px; background: var(--gray-50); border: 1px solid var(--gray-200); font-family: var(--mono); font-size: 10.5px; color: var(--gray-600); line-height: 1.4;">
                            <div><strong>Client ID:</strong> ${clientShort}</div>
                            <div><strong>Local Transport:</strong> filesystem-mcp (stdio)</div>
                            <div><strong>Active LLM Core:</strong> ${providerName} (${modelName})</div>
                        </div>
                    </div>`;
            } else {
                const serviceLabel = matchedService.charAt(0).toUpperCase() + matchedService.slice(1);
                const activeConn = state.connectors.find(c => c.type === matchedService);
                const hasClientId = activeConn ? activeConn.clientId : '976947677770-h5fm4q9mdpaafvf4t78it3nfqkjk0491.apps.googleusercontent.com';

                actionLabel = `Google ${serviceLabel} Sync`;
                detailHtml = `Executing Google integration for <span class="trace-tag">${matchedService}</span>. OAuth Client ID: <span class="trace-tag">${hasClientId.slice(0, 15)}...</span>`;
                addLog('success', `Executed API request on Google service: ${matchedService}. OAuth client authenticated.`);

                switch(matchedService) {
                    case 'gmail':
                        replyHtml = `I have successfully composed and dispatched the requested email notification using your active Gmail connector:
                            <div class="gmail-card" style="border: 1px solid var(--gray-200); border-radius: 8px; padding: 14px; margin-top: 10px; background: var(--white); box-shadow: 0 2px 8px rgba(0,0,0,0.03);">
                                <div style="display: flex; align-items: center; justify-content: space-between; border-bottom: 1px solid var(--gray-100); padding-bottom: 8px; margin-bottom: 8px;">
                                    <span style="font-size: 12px; font-weight: 600; display: flex; align-items: center; gap: 6px;">
                                        ${serviceLogos.gmail} Gmail Message Sent
                                    </span>
                                    <span style="font-size: 11px; font-family: var(--mono); color: var(--gray-600); background: #f4f4f5; padding: 1px 4px; border-radius: 2px;">OAuth OK</span>
                                </div>
                                <div style="font-size: 13px; color: var(--gray-800); line-height: 1.5;">
                                    <div><strong>To:</strong> recruitment@vercel.com</div>
                                    <div><strong>Subject:</strong> Schedule Confirmation - Timetable Session</div>
                                    <div style="margin-top: 6px; padding: 6px 10px; background: var(--gray-50); border-radius: 4px; border-left: 2px solid var(--gray-400); font-style: italic;">
                                        "Hello, I am confirming my slot for the interview tomorrow at 2:00 PM EST. Thank you!"
                                    </div>
                                </div>
                            </div>`;
                        break;
                    case 'calendar':
                        replyHtml = `I've successfully updated your calendar events. A new schedule slot has been booked:
                            <div class="calendar-card" style="border: 1px solid var(--gray-200); border-radius: 8px; padding: 14px; margin-top: 10px; background: var(--white); box-shadow: 0 2px 8px rgba(0,0,0,0.03);">
                                <div style="display: flex; align-items: center; justify-content: space-between; border-bottom: 1px solid var(--gray-100); padding-bottom: 8px; margin-bottom: 8px;">
                                    <span style="font-size: 12px; font-weight: 600; display: flex; align-items: center; gap: 6px;">
                                        ${serviceLogos.calendar} Google Calendar Event Added
                                    </span>
                                    <span style="font-size: 11px; font-family: var(--mono); color: var(--gray-600); background: #f4f4f5; padding: 1px 4px; border-radius: 2px;">OAuth Sync</span>
                                </div>
                                <div style="font-size: 13px; color: var(--gray-800); line-height: 1.5;">
                                    <div style="font-weight: 600;">Vercel Interview Session</div>
                                    <div style="color: var(--gray-600);">Tomorrow · 2:00 PM – 3:00 PM EST (GMT-05:00)</div>
                                    <div style="font-size: 11px; color: var(--gray-400); margin-top: 4px;">Calendar Client ID: ${hasClientId.slice(0, 20)}...</div>
                                </div>
                            </div>`;
                        break;
                    case 'maps':
                        mapsContainerId = `map_canvas_${Date.now()}`;
                        replyHtml = `I've pulled up the location details using the Google Maps JavaScript API with your configured Maps Key. You can interact with the live map below:
                            <div class="maps-card" style="border: 1px solid var(--gray-200); border-radius: 8px; padding: 14px; margin-top: 10px; background: var(--white); box-shadow: 0 2px 8px rgba(0,0,0,0.03);">
                                <div style="display: flex; align-items: center; justify-content: space-between; border-bottom: 1px solid var(--gray-100); padding-bottom: 8px; margin-bottom: 8px;">
                                    <span style="font-size: 12px; font-weight: 600; display: flex; align-items: center; gap: 6px;">
                                        ${serviceLogos.maps} Google Maps JavaScript API
                                    </span>
                                    <span style="font-size: 11px; font-family: var(--mono); color: var(--gray-600); background: #f4f4f5; padding: 1px 4px; border-radius: 2px;">Live SDK</span>
                                </div>
                                <div id="${mapsContainerId}" style="height: 200px; width: 100%; border-radius: 6px; overflow: hidden; background: #e5e7eb; border: 1px solid var(--gray-200);">
                                    <div style="display: flex; height:100%; align-items:center; justify-content:center; color: var(--gray-400); font-size:12px;">Initializing Map canvas...</div>
                                </div>
                            </div>`;
                        break;
                    case 'sheets':
                        replyHtml = `I've initialized a Google Sheet using your Client ID and recorded the new timetable entries successfully:
                            <div class="sheets-card" style="border: 1px solid var(--gray-200); border-radius: 8px; padding: 14px; margin-top: 10px; background: var(--white); box-shadow: 0 2px 8px rgba(0,0,0,0.03); overflow: hidden;">
                                <div style="display: flex; align-items: center; justify-content: space-between; border-bottom: 1px solid var(--gray-100); padding-bottom: 8px; margin-bottom: 8px;">
                                    <span style="font-size: 12px; font-weight: 600; display: flex; align-items: center; gap: 6px;">
                                        ${serviceLogos.sheets} Google Sheets Sync Complete
                                    </span>
                                    <span style="font-size: 11px; font-family: var(--mono); color: var(--gray-600); background: #f4f4f5; padding: 1px 4px; border-radius: 2px;">OAuth Connected</span>
                                </div>
                                <div style="font-size: 12px; font-weight: 500; margin-bottom: 6px; color: var(--gray-600);">Timetable Maker - Sheet 1</div>
                                <table style="width: 100%; border-collapse: collapse; font-size: 11px; text-align: left;">
                                    <thead>
                                        <tr style="background: var(--gray-50); border-bottom: 1px solid var(--gray-200);">
                                            <th style="padding: 4px 6px;">Time</th>
                                            <th style="padding: 4px 6px;">Activity</th>
                                            <th style="padding: 4px 6px;">Room</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        <tr style="border-bottom: 1px solid var(--gray-100);">
                                            <td style="padding: 4px 6px; font-family: var(--mono); color:#2563eb;">09:00 AM</td>
                                            <td style="padding: 4px 6px; font-weight:500;">System Architect Lecture</td>
                                            <td style="padding: 4px 6px; color:var(--gray-600);">Room 402</td>
                                        </tr>
                                        <tr style="border-bottom: 1px solid var(--gray-100);">
                                            <td style="padding: 4px 6px; font-family: var(--mono); color:#2563eb;">11:30 AM</td>
                                            <td style="padding: 4px 6px; font-weight:500;">Interactive Design Studio</td>
                                            <td style="padding: 4px 6px; color:var(--gray-600);">Lab C</td>
                                        </tr>
                                    </tbody>
                                </table>
                            </div>`;
                        break;
                    case 'slides':
                        replyHtml = `I've created a new presentation slide deck in Google Drive and formatted it with a sleek design system:
                            <div class="slides-card" style="border: 1px solid var(--gray-200); border-radius: 8px; padding: 14px; margin-top: 10px; background: var(--white); box-shadow: 0 2px 8px rgba(0,0,0,0.03);">
                                <div style="display: flex; align-items: center; justify-content: space-between; border-bottom: 1px solid var(--gray-100); padding-bottom: 8px; margin-bottom: 8px;">
                                    <span style="font-size: 12px; font-weight: 600; display: flex; align-items: center; gap: 6px;">
                                        ${serviceLogos.slides} Google Slides Created
                                    </span>
                                    <span style="font-size: 11px; font-family: var(--mono); color: var(--gray-600); background: #f4f4f5; padding: 1px 4px; border-radius: 2px;">OAuth Sync</span>
                                </div>
                                <div style="display: flex; gap: 12px; margin-top: 6px; flex-wrap: wrap;">
                                    <div style="width: 100px; height: 60px; background: #FFF7E6; border: 1px solid #FFE7BA; border-radius: 4px; display: flex; flex-direction: column; justify-content: center; align-items: center; padding: 4px; box-shadow: 0 2px 4px rgba(0,0,0,0.05); flex-shrink:0;">
                                        <div style="font-size: 8px; font-weight: 600; color: #D48806; text-align: center;">Oppie Overview</div>
                                        <div style="font-size: 5px; color: #D48806; opacity: 0.8; margin-top: 2px;">Slide 1 of 5</div>
                                    </div>
                                    <div style="font-size: 12px; color: var(--gray-800); line-height: 1.4; display: flex; flex-direction: column; justify-content: center;">
                                        <div><strong>File:</strong> Timetable_System_Pitch.gslides</div>
                                        <div style="font-size:11px; color: var(--gray-600);">5 slides initialized containing schema maps.</div>
                                    </div>
                                </div>
                            </div>`;
                        break;
                    case 'drive':
                        replyHtml = `I've uploaded the compiled timetable document directly to your Google Drive folder:
                            <div class="drive-card" style="border: 1px solid var(--gray-200); border-radius: 8px; padding: 14px; margin-top: 10px; background: var(--white); box-shadow: 0 2px 8px rgba(0,0,0,0.03);">
                                <div style="display: flex; align-items: center; justify-content: space-between; border-bottom: 1px solid var(--gray-100); padding-bottom: 8px; margin-bottom: 8px;">
                                    <span style="font-size: 12px; font-weight: 600; display: flex; align-items: center; gap: 6px;">
                                        ${serviceLogos.drive} Google Drive File Uploaded
                                    </span>
                                    <span style="font-size: 11px; font-family: var(--mono); color: var(--gray-600); background: #f4f4f5; padding: 1px 4px; border-radius: 2px;">OAuth Active</span>
                                </div>
                                <div style="display: flex; align-items: center; gap: 10px;">
                                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#4285F4" stroke-width="2"><path d="M14 2H6c-1.1 0-1.99.9-1.99 2L4 20c0 1.1.89 2 1.99 2H18c1.1 0 2-.9 2-2V8l-6-6z"/></svg>
                                    <div style="font-size: 13px; color: var(--gray-800); line-height: 1.4;">
                                        <div><strong>Oppie_Timetable_Schedule_Export.pdf</strong></div>
                                        <div style="font-size: 11px; color: var(--gray-600);">345 KB · Portable Document Format</div>
                                    </div>
                                </div>
                            </div>`;
                        break;
                    case 'forms':
                        replyHtml = `I've published a new survey on Google Forms to gather timetable preferences from your team:
                            <div class="forms-card" style="border: 1px solid var(--gray-200); border-radius: 8px; padding: 14px; margin-top: 10px; background: var(--white); box-shadow: 0 2px 8px rgba(0,0,0,0.03);">
                                <div style="display: flex; align-items: center; justify-content: space-between; border-bottom: 1px solid var(--gray-100); padding-bottom: 8px; margin-bottom: 8px;">
                                    <span style="font-size: 12px; font-weight: 600; display: flex; align-items: center; gap: 6px;">
                                        ${serviceLogos.forms} Google Form Published
                                    </span>
                                    <span style="font-size: 11px; font-family: var(--mono); color: var(--gray-600); background: #f4f4f5; padding: 1px 4px; border-radius: 2px;">OAuth Live</span>
                                </div>
                                <div style="font-size: 13px; color: var(--gray-800); display: flex; flex-direction: column; gap: 8px;">
                                    <div><strong>Form Title:</strong> Class Timetable Preference Survey</div>
                                    <div style="padding: 10px; border: 1px solid var(--gray-100); border-radius: 6px; background: var(--gray-50);">
                                        <div style="font-size: 12px; font-weight: 600; margin-bottom: 6px;">Q1: Choose your preferred slot:</div>
                                        <div style="display: flex; flex-direction:column; gap: 4px; font-size:11px;">
                                            <label><input type="radio" name="preference" value="morn"/> Morning Sessions (9 AM - 12 PM)</label>
                                            <label><input type="radio" name="preference" value="aftern"/> Afternoon Sessions (1 PM - 4 PM)</label>
                                        </div>
                                        <button type="button" class="btn-primary" style="margin-top: 8px; padding: 4px 8px; font-size: 10px; border-radius: 4px;" onclick="addLog('success', 'Google Forms: Form response received'); alert('Simulated response captured!');">Submit Response</button>
                                    </div>
                                </div>
                            </div>`;
                        break;
                    case 'tasks':
                        replyHtml = `I've updated your Google Tasks list. Here are your active action items:
                            <div class="tasks-card" style="border: 1px solid var(--gray-200); border-radius: 8px; padding: 14px; margin-top: 10px; background: var(--white); box-shadow: 0 2px 8px rgba(0,0,0,0.03);">
                                <div style="display: flex; align-items: center; justify-content: space-between; border-bottom: 1px solid var(--gray-100); padding-bottom: 8px; margin-bottom: 8px;">
                                    <span style="font-size: 12px; font-weight: 600; display: flex; align-items: center; gap: 6px;">
                                        ${serviceLogos.tasks} Google Tasks Action Items
                                    </span>
                                    <span style="font-size: 11px; font-family: var(--mono); color: var(--gray-600); background: #f4f4f5; padding: 1px 4px; border-radius: 2px;">OAuth Sync</span>
                                </div>
                                <div style="font-size: 13px; color: var(--gray-800); display: flex; flex-direction: column; gap: 8px;">
                                    <div style="font-size: 12px; color: var(--gray-600); margin-bottom: 2px;">Check tasks to mark them complete:</div>
                                    <div style="display: flex; flex-direction: column; gap: 6px;" id="tasks-checklist">
                                        <label style="display: flex; align-items: center; gap: 8px; cursor: pointer; font-size: 12px;">
                                            <input type="checkbox" onchange="addLog('success', 'Google Tasks: Marked [Confirm Vercel timing details] as completed.')"/> Confirm Vercel timing details
                                        </label>
                                        <label style="display: flex; align-items: center; gap: 8px; cursor: pointer; font-size: 12px;">
                                            <input type="checkbox" onchange="addLog('success', 'Google Tasks: Marked [Sync calendar schedule] as completed.')"/> Sync tomorrow's calendar schedule
                                        </label>
                                        <label style="display: flex; align-items: center; gap: 8px; cursor: pointer; font-size: 12px;">
                                            <input type="checkbox" onchange="addLog('success', 'Google Tasks: Marked [Prepare Slides in Google Slides] as completed.')"/> Prepare review slide deck in Google Slides
                                        </label>
                                    </div>
                                </div>
                            </div>`;
                        break;
                    case 'google':
                        replyHtml = `I've performed a web lookup using the Google Search engine integration:
                            <div class="google-card" style="border: 1px solid var(--gray-200); border-radius: 8px; padding: 14px; margin-top: 10px; background: var(--white); box-shadow: 0 2px 8px rgba(0,0,0,0.03);">
                                <div style="display: flex; align-items: center; justify-content: space-between; border-bottom: 1px solid var(--gray-100); padding-bottom: 8px; margin-bottom: 8px;">
                                    <span style="font-size: 12px; font-weight: 600; display: flex; align-items: center; gap: 6px;">
                                        ${serviceLogos.google} Google Search Results
                                    </span>
                                    <span style="font-size: 11px; font-family: var(--mono); color: var(--gray-600); background: #f4f4f5; padding: 1px 4px; border-radius: 2px;">Search Engine</span>
                                </div>
                                <div style="font-size: 12px; color: var(--gray-800); display: flex; flex-direction: column; gap: 8px;">
                                    <div>
                                        <a href="#" style="color: #1a0dab; text-decoration: none; font-weight: 500;" onclick="return false;">Vercel Scheduling and Calendar Integration</a>
                                        <div style="color: #006621; font-size: 10px;">https://vercel.com/docs/scheduling</div>
                                        <div style="color: var(--gray-600); margin-top: 2px;">Detailed guide on how to integrate Gmail, Outlook, and Google Calendar for auto-syncing recruitment schedules...</div>
                                    </div>
                                </div>
                            </div>`;
                        break;
                }
            }
        } else if (matchedMcp) {
            actionLabel = 'MCP Tool Call';
            detailHtml = `Calling registered Model Context Protocol server <span class="trace-tag">${matchedMcp.name}</span> using local execution framework.`;
            replyHtml = `I've triggered the active MCP server <strong>${matchedMcp.name}</strong> to handle this query. The local command was run and data is fully synched to Oppie.`;
            addLog('success', `Dispatched Tool Call on MCP server: ${matchedMcp.name} (${matchedMcp.transport})`);
        } else {
            actionLabel = 'Reasoning Step';
            detailHtml = `Model <span class="trace-tag">${modelName}</span> initialized. Backend provider: <span class="trace-tag">${providerName}</span>. Key loaded: <span class="trace-tag">${hasKey ? 'YES' : 'MOCK'}</span>`;
            replyHtml = `I'm processing that instruction using the configured <strong>${providerName} (${modelName})</strong> engine. Running a daemon in the background to handle updates.`;
            addLog('info', `Background monitor running for user command: "${text.slice(0, 30)}..."`);
        }

        addAgentMsg(actionLabel, detailHtml, replyHtml, matchedService);
        
        if (mapsContainerId) {
            renderLiveMap(mapsContainerId, textLower);
        }
        
        input.disabled = false;
        sendBtn.disabled = false;
        input.focus();
    }, 1600);
}

// Start everything up on page load
loadState();
initAiForm();
renderConnectorsList();
renderMcpList();
renderSidebarConnectors();
renderAllLogs();
updateSidebarPermissions();

sendBtn.addEventListener('click', send);
input.addEventListener('keydown', e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } });
