// ============================================
// CAREBRIDGE COMPANION - CHAT INTERFACE
// ============================================

const API_URL = window.location.protocol === 'file:'
  ? 'http://localhost:3000'
  : window.location.origin;

let currentSession = null;
let currentUserId = null;
let currentPin = null;
let currentPassword = null;
let staffToken = null;
let currentAvatar = '🤖';
let currentTheme = 'mint';
let messageCount = 0;
let isNewUser = false;
let currentAuthMethod = 'pin'; // 'pin', 'password', or 'staff'
let demoMode = false;
let currentDemoScenario = 'guided';
let apiAvailable = false;
let demoUseLiveLlama = true;
let demoConversationHistory = [];
let demoModelHealth = {
  enabled: false,
  healthy: false,
  model: null,
  streamEnabled: false,
  checked: false
};

const demoScenarios = {
  guided: {
    title: 'Guided Youth Check-In',
    summary: 'Use this to present a supportive youth check-in, light personalization, and the way staff gain useful context without displacing direct care relationships.',
    status: 'Demo mode: supportive check-in flow',
    avatar: '🌈',
    theme: 'ocean',
    userId: 'demo-youth-01',
    placeholder: 'Try a demo prompt or type your own message...',
    transcript: [
      {
        role: 'assistant',
        content: 'Hi, I am CareBridge Companion. This demo illustrates how a young person can check in, feel heard, and still have important concerns surfaced for staff follow-up when appropriate.'
      },
      {
        role: 'user',
        content: 'I am kind of stressed after school and a family call.'
      },
      {
        role: 'assistant',
        content: 'Thank you for sharing that. I can reflect what may be contributing to the stress, offer a few grounding ideas, and help the care team notice patterns that may warrant thoughtful follow-up.'
      }
    ],
    prompts: [
      'I am feeling anxious after a family visit.',
      'What could help me calm down before bedtime?',
      'I want to talk, but I do not want a big reaction.'
    ]
  },
  safety: {
    title: 'Safety Alert Walkthrough',
    summary: 'Use this to explain how concerning language can trigger documented staff review, time-sensitive escalation, and appropriate human follow-up while keeping the system framed as a support tool rather than crisis care.',
    status: 'Demo mode: safety escalation story',
    avatar: '🧠',
    theme: 'coral',
    userId: 'demo-youth-alert',
    placeholder: 'Ask about safety follow-up or try a prompt...',
    transcript: [
      {
        role: 'assistant',
        content: 'This scenario demonstrates how the companion can respond supportively while flagging a potential safeguarding concern for staff review under facility protocols.'
      },
      {
        role: 'user',
        content: 'I do not feel safe going back to my room right now.'
      },
      {
        role: 'assistant',
        content: 'Thank you for saying that clearly. In a live deployment, this kind of message could be logged as a time-sensitive concern, routed for staff review, and included in follow-up documentation so an appropriate response can occur promptly.'
      }
    ],
    prompts: [
      'I do not feel safe going back to my room right now.',
      'Can someone check on me without making it a huge scene?',
      'What happens when the system thinks a follow-up is needed?'
    ]
  }
};

// ============================================
// DOM ELEMENTS
// ============================================
const loginScreen = document.getElementById('loginScreen');

// PIN Login Elements
const pinLoginForm = document.getElementById('pinLoginForm');
const userIdInput = document.getElementById('userIdInput');
const pinInput = document.getElementById('pinInput');
const loginBtn = document.getElementById('loginBtn');
const loginStatus = document.getElementById('loginStatus');

// Password Login Elements
const passwordLoginForm = document.getElementById('passwordLoginForm');
const userIdPassword = document.getElementById('userIdPassword');
const passwordInput = document.getElementById('passwordInput');
const passwordLoginBtn = document.getElementById('passwordLoginBtn');
const loginStatusPassword = document.getElementById('loginStatusPassword');
const passwordStrength = document.getElementById('passwordStrength');

// Staff Login Elements
const staffLoginForm = document.getElementById('staffLoginForm');
const staffEmailUsername = document.getElementById('staffEmailUsername');
const staffPassword = document.getElementById('staffPassword');
const rememberDevice = document.getElementById('rememberDevice');
const staffLoginBtn = document.getElementById('staffLoginBtn');
const loginStatusStaff = document.getElementById('loginStatusStaff');
const demoStatus = document.getElementById('demoStatus');
const startGuidedDemoBtn = document.getElementById('startGuidedDemoBtn');
const startSafetyDemoBtn = document.getElementById('startSafetyDemoBtn');
const demoLlamaToggle = document.getElementById('demoLlamaToggle');
const demoLlamaStatus = document.getElementById('demoLlamaStatus');

// Auth Method Selector
const authMethodBtns = document.querySelectorAll('.auth-method-btn');

const setupScreen = document.getElementById('setupScreen');
const chatScreen = document.getElementById('chatScreen');
const startBtn = document.getElementById('startBtn');
const messageInput = document.getElementById('messageInput');
const sendBtn = document.getElementById('sendBtn');
const messagesContainer = document.getElementById('messagesContainer');
const settingsBtn = document.getElementById('settingsBtn');
const settingsModal = document.getElementById('settingsModal');
const closeSettingsBtn = document.getElementById('closeSettingsBtn');
const newChatBtn = document.getElementById('newChatBtn');
const loadingIndicator = document.getElementById('loadingIndicator');
const statusText = document.getElementById('statusText');
const headerAvatar = document.getElementById('headerAvatar');
const demoControlPanel = document.getElementById('demoControlPanel');
const demoScenarioTitle = document.getElementById('demoScenarioTitle');
const demoScenarioSummary = document.getElementById('demoScenarioSummary');
const demoPromptButtons = document.querySelectorAll('.demo-prompt-btn');
const restartDemoBtn = document.getElementById('restartDemoBtn');

const DEMO_MEMORY_LIMIT = 8;

// ============================================
// INITIALIZATION
// ============================================
document.addEventListener('DOMContentLoaded', () => {
  setupEventListeners();
  checkApiConnection({ silent: true });
  updateDemoLlamaControls();
});

function setupEventListeners() {
  // Auth method selector
  authMethodBtns.forEach(btn => {
    btn.addEventListener('click', () => switchAuthMethod(btn.dataset.method));
  });

  startGuidedDemoBtn?.addEventListener('click', () => startDemoScenario('guided'));
  startSafetyDemoBtn?.addEventListener('click', () => startDemoScenario('safety'));
  demoLlamaToggle?.addEventListener('change', handleDemoLlamaToggleChange);
  restartDemoBtn?.addEventListener('click', restartDemoScenario);
  demoPromptButtons.forEach(button => {
    button.addEventListener('click', () => triggerDemoPrompt(button.dataset.demoPrompt || ''));
  });

  // PIN Login screen
  loginBtn.addEventListener('click', handlePINLogin);
  pinInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      handlePINLogin();
    }
  });

  // Password Login screen
  passwordLoginBtn.addEventListener('click', handlePasswordLogin);
  passwordInput.addEventListener('input', updatePasswordStrength);
  passwordInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      handlePasswordLogin();
    }
  });

  // Staff Login screen
  staffLoginBtn.addEventListener('click', handleStaffLogin);
  staffPassword.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      handleStaffLogin();
    }
  });

  // Setup screen
  startBtn.addEventListener('click', startChat);
  
  // Avatar selection
  document.querySelectorAll('[data-avatar]').forEach(option => {
    option.addEventListener('click', () => selectAvatar(option));
  });

  // Theme selection
  document.querySelectorAll('[data-theme]').forEach(option => {
    option.addEventListener('click', () => selectTheme(option));
  });

  // Chat screen
  sendBtn.addEventListener('click', sendMessage);
  messageInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  });

  // Settings
  settingsBtn.addEventListener('click', openSettings);
  closeSettingsBtn.addEventListener('click', closeSettings);
  newChatBtn.addEventListener('click', startNewChat);

  // Modal close on background click
  settingsModal.addEventListener('click', (e) => {
    if (e.target === settingsModal) {
      closeSettings();
    }
  });
}

// ============================================
// LOGIN FUNCTION
// ============================================
// ============================================
// LOGIN METHODS
// ============================================

function switchAuthMethod(method) {
  currentAuthMethod = method;
  
  // Update button states
  authMethodBtns.forEach(btn => {
    btn.classList.toggle('active', btn.dataset.method === method);
  });
  
  // Hide all forms
  pinLoginForm.style.display = 'none';
  passwordLoginForm.style.display = 'none';
  staffLoginForm.style.display = 'none';
  
  // Show selected form
  switch(method) {
    case 'pin':
      pinLoginForm.style.display = 'flex';
      break;
    case 'password':
      passwordLoginForm.style.display = 'flex';
      break;
    case 'staff':
      staffLoginForm.style.display = 'flex';
      break;
  }
}

function updateDemoStatus(isConnected) {
  if (!demoStatus) return;

  apiAvailable = isConnected;

  if (isConnected) {
    demoStatus.textContent = 'Live API detected. You can show the real app or use local demo mode for a controlled walkthrough.';
    demoStatus.className = 'demo-status demo-status-live';
    return;
  }

  demoStatus.textContent = 'Live API unavailable. Demo mode is ready with scripted scenarios so you can still present the product confidently.';
  demoStatus.className = 'demo-status demo-status-fallback';
}

function shouldUseLiveDemoResponses() {
  return demoMode && demoUseLiveLlama && apiAvailable && demoModelHealth.healthy;
}

function updateDemoLlamaControls() {
  if (!demoLlamaToggle || !demoLlamaStatus) return;

  const liveAvailable = apiAvailable && demoModelHealth.healthy;
  const modelLabel = demoModelHealth.model ? ` (${demoModelHealth.model})` : '';

  demoLlamaToggle.checked = liveAvailable && demoUseLiveLlama;
  demoLlamaToggle.disabled = !liveAvailable;

  if (demoLlamaToggle.checked) {
    demoLlamaStatus.textContent = `Live Llama${modelLabel} is active for demo replies.`;
    demoLlamaStatus.className = 'demo-model-status live';
    return;
  }

  if (liveAvailable) {
    demoLlamaStatus.textContent = `Live Llama${modelLabel} is available. Turn on the switch to use live demo replies.`;
    demoLlamaStatus.className = 'demo-model-status live';
    return;
  }

  if (!apiAvailable) {
    demoLlamaStatus.textContent = 'Scripted demo replies are active. Connect the app server to enable the live-model toggle.';
    demoLlamaStatus.className = 'demo-model-status unavailable';
    return;
  }

  if (!demoModelHealth.checked) {
    demoLlamaStatus.textContent = 'Checking whether a local Llama model is available for demo mode...';
    demoLlamaStatus.className = 'demo-model-status';
    return;
  }

  if (!demoModelHealth.enabled) {
    demoLlamaStatus.textContent = 'Scripted demo replies are active. Live Llama is disabled on this server.';
    demoLlamaStatus.className = 'demo-model-status unavailable';
    return;
  }

  demoLlamaStatus.textContent = 'Scripted demo replies are active. Live Llama is not currently healthy or reachable.';
  demoLlamaStatus.className = 'demo-model-status unavailable';
}

async function refreshDemoModelHealth() {
  if (!apiAvailable) {
    demoModelHealth = {
      enabled: false,
      healthy: false,
      model: null,
      streamEnabled: false,
      checked: true
    };
    demoUseLiveLlama = false;
    updateDemoLlamaControls();
    return demoModelHealth;
  }

  try {
    const response = await fetch(`${API_URL}/api/chat/health`);
    const data = await response.json();

    demoModelHealth = {
      enabled: data.enabled !== false,
      healthy: response.ok && data.healthy === true,
      model: data.model || null,
      streamEnabled: data.streamEnabled === true,
      checked: true
    };
  } catch (error) {
    console.warn('Demo model health check failed:', error);
    demoModelHealth = {
      enabled: false,
      healthy: false,
      model: null,
      streamEnabled: false,
      checked: true
    };
  }

  demoUseLiveLlama = demoModelHealth.healthy;
  localStorage.setItem('carebridge-demo-live-llama', demoUseLiveLlama ? 'true' : 'false');

  if (!demoModelHealth.healthy) {
    demoUseLiveLlama = false;
  }

  updateDemoLlamaControls();
  return demoModelHealth;
}

async function handleDemoLlamaToggleChange(event) {
  const requested = event.target.checked;

  if (requested) {
    await refreshDemoModelHealth();

    if (!demoModelHealth.healthy) {
      demoUseLiveLlama = false;
      updateDemoLlamaControls();
      showNotification('Live Llama is not available right now. The demo will stay in scripted mode.');
      return;
    }

    demoUseLiveLlama = true;
    localStorage.setItem('carebridge-demo-live-llama', 'true');
    updateDemoLlamaControls();

    if (demoMode) {
      currentSession = null;
      await createSession();
      statusText.textContent = `Demo mode: live replies via ${demoModelHealth.model || 'local model'}`;
    }

    return;
  }

  demoUseLiveLlama = false;
  localStorage.setItem('carebridge-demo-live-llama', 'false');
  updateDemoLlamaControls();

  if (demoMode) {
    const scenario = demoScenarios[currentDemoScenario] || demoScenarios.guided;
    statusText.textContent = scenario.status;
  }
}

async function startDemoScenario(scenarioKey) {
  const scenario = demoScenarios[scenarioKey] || demoScenarios.guided;

  demoMode = true;
  currentDemoScenario = scenarioKey;
  currentUserId = scenario.userId;
  currentPin = null;
  currentPassword = null;
  currentAvatar = scenario.avatar;
  currentTheme = scenario.theme;
  currentSession = `demo-${scenarioKey}-${Date.now()}`;
  isNewUser = false;

  applyTheme();
  setupDefaultSelections();
  renderDemoScenario(scenario);
  updateDemoControlPanel(scenario);
  headerAvatar.textContent = currentAvatar;
  statusText.textContent = scenario.status;
  messageInput.placeholder = scenario.placeholder;
  messageInput.disabled = false;
  sendBtn.disabled = false;
  loadingIndicator.classList.remove('active');

  switchScreen(loginScreen, chatScreen);
  updateSettingsDisplay();

  if (demoUseLiveLlama) {
    await refreshDemoModelHealth();

    if (demoModelHealth.healthy) {
      currentSession = null;
      await createSession();
      statusText.textContent = `Demo mode: live replies via ${demoModelHealth.model || 'local model'}`;
    }
  }

  messageInput.focus();
}

async function restartDemoScenario() {
  await startDemoScenario(currentDemoScenario);
}

function renderDemoScenario(scenario) {
  demoConversationHistory = scenario.transcript.map((entry) => ({
    role: entry.role,
    content: entry.content,
  }));
  messageCount = scenario.transcript.length;
  messagesContainer.innerHTML = scenario.transcript
    .map(entry => createMessageMarkup(entry.role, entry.content))
    .join('');
  messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

function getDemoContextHistory() {
  return demoConversationHistory.slice(-DEMO_MEMORY_LIMIT);
}

function appendDemoConversation(role, content) {
  if (!demoMode || !content) return;

  demoConversationHistory.push({ role, content });
}

function updateDemoControlPanel(scenario) {
  if (!demoControlPanel) return;

  demoControlPanel.hidden = !demoMode;

  if (!demoMode) {
    return;
  }

  demoScenarioTitle.textContent = scenario.title;
  demoScenarioSummary.textContent = scenario.summary;
  updateDemoLlamaControls();
  demoPromptButtons.forEach((button, index) => {
    const prompt = scenario.prompts[index] || '';
    button.textContent = prompt;
    button.dataset.demoPrompt = prompt;
    button.hidden = !prompt;
  });
}

function triggerDemoPrompt(prompt) {
  if (!prompt) return;

  messageInput.value = prompt;
  sendMessage();
}

/**
 * PIN Login Handler
 */
async function handlePINLogin() {
  const userId = userIdInput.value.trim();
  const pin = pinInput.value.trim();

  if (!userId || !pin || pin.length !== 4) {
    showLoginStatus('Please enter valid User ID and 4-digit PIN', 'error', 'pin');
    return;
  }

  if (!/^\d{4}$/.test(pin)) {
    showLoginStatus('PIN must be 4 digits', 'error', 'pin');
    return;
  }

  try {
    loginBtn.disabled = true;
    showLoginStatus('Authenticating...', 'loading', 'pin');

    const response = await fetch(`${API_URL}/api/users/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId,
        pin,
        deviceId: `device-${Date.now()}`,
        deviceName: navigator.userAgent.includes('Mobile') ? 'Mobile Device' : 'Desktop'
      })
    });

    const data = await response.json();

    if (!response.ok) {
      showLoginStatus(data.error || 'Login failed', 'error', 'pin');
      loginBtn.disabled = false;
      return;
    }

    // Store user info
    currentUserId = userId;
    currentPin = pin;
    isNewUser = data.isNewUser;

    // Load user settings if available
    if (!isNewUser && data.avatar && data.theme) {
      currentAvatar = data.avatar;
      currentTheme = data.theme;
      applyTheme();
    }

    // Switch to setup or chat screen
    if (isNewUser) {
      switchScreen(loginScreen, setupScreen);
      showLoginStatus('', '', 'pin');
    } else {
      // For returning users, skip setup and go straight to chat
      setupDefaultSelections();
      switchScreen(loginScreen, chatScreen);
      await createSession();
    }

  } catch (error) {
    console.error('PIN Login error:', error);
    showLoginStatus(`Connection error: ${error.message}`, 'error', 'pin');
    loginBtn.disabled = false;
  }
}

/**
 * Password Login Handler
 */
async function handlePasswordLogin() {
  const userId = userIdPassword.value.trim();
  const password = passwordInput.value.trim();

  if (!userId || !password) {
    showLoginStatus('Please enter your User ID and password', 'error', 'password');
    return;
  }

  if (password.length < 6) {
    showLoginStatus('Password must be at least 6 characters', 'error', 'password');
    return;
  }

  try {
    passwordLoginBtn.disabled = true;
    showLoginStatus('Authenticating...', 'loading', 'password');

    const response = await fetch(`${API_URL}/api/users/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId,
        password,
        deviceId: `device-${Date.now()}`,
        deviceName: navigator.userAgent.includes('Mobile') ? 'Mobile Device' : 'Desktop'
      })
    });

    const data = await response.json();

    if (!response.ok) {
      showLoginStatus(data.error || 'Login failed', 'error', 'password');
      passwordLoginBtn.disabled = false;
      return;
    }

    // Store user info
    currentUserId = userId;
    currentPassword = password;
    isNewUser = data.isNewUser;

    // Load user settings if available
    if (!isNewUser && data.avatar && data.theme) {
      currentAvatar = data.avatar;
      currentTheme = data.theme;
      applyTheme();
    }

    // Switch to setup or chat screen
    if (isNewUser) {
      switchScreen(loginScreen, setupScreen);
      showLoginStatus('', '', 'password');
    } else {
      setupDefaultSelections();
      switchScreen(loginScreen, chatScreen);
      await createSession();
    }

  } catch (error) {
    console.error('Password Login error:', error);
    showLoginStatus(`Connection error: ${error.message}`, 'error', 'password');
    passwordLoginBtn.disabled = false;
  }
}

/**
 * Staff Login Handler
 */
async function handleStaffLogin() {
  const emailOrUsername = staffEmailUsername.value.trim();
  const password = staffPassword.value.trim();

  if (!emailOrUsername || !password) {
    showLoginStatus('Please enter email/username and password', 'error', 'staff');
    return;
  }

  try {
    staffLoginBtn.disabled = true;
    showLoginStatus('Authenticating...', 'loading', 'staff');

    const loginBody = {
      password,
      deviceId: `device-${Date.now()}`,
      deviceName: navigator.userAgent.includes('Mobile') ? 'Mobile Device' : 'Desktop'
    };

    // Check if input is email or username
    if (emailOrUsername.includes('@')) {
      loginBody.email = emailOrUsername;
    } else {
      loginBody.username = emailOrUsername;
    }

    const response = await fetch(`${API_URL}/api/staff/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(loginBody)
    });

    const data = await response.json();

    if (!response.ok) {
      showLoginStatus(data.error || 'Staff login failed', 'error', 'staff');
      staffLoginBtn.disabled = false;
      return;
    }

    // Store staff token
    staffToken = data.token;
    localStorage.setItem('staffToken', staffToken);

    if (rememberDevice.checked) {
      localStorage.setItem('rememberStaffDevice', 'true');
    }

    // Redirect to staff dashboard
    showLoginStatus('Redirecting to dashboard...', 'success', 'staff');
    setTimeout(() => {
      window.location.href = './dashboard.html';
    }, 1500);

  } catch (error) {
    console.error('Staff Login error:', error);
    showLoginStatus(`Connection error: ${error.message}`, 'error', 'staff');
    staffLoginBtn.disabled = false;
  }
}

/**
 * Update password strength indicator
 */
function updatePasswordStrength() {
  const password = passwordInput.value;
  
  if (!password) {
    passwordStrength.innerHTML = '';
    passwordStrength.className = 'password-strength empty';
    return;
  }

  let strength = 'weak';
  if (password.length >= 8 && /[A-Z]/.test(password) && /[0-9]/.test(password)) {
    strength = 'good';
  } else if (password.length >= 8 || (/[A-Z]/.test(password) && /[0-9]/.test(password))) {
    strength = 'fair';
  }

  passwordStrength.innerHTML = `<div class="password-strength-bar ${strength}"></div>`;
  passwordStrength.className = 'password-strength';
}

function showLoginStatus(message, type = '', method = 'pin') {
  const statusElement = method === 'pin' ? 
    loginStatus : 
    method === 'password' ? 
      loginStatusPassword : 
      loginStatusStaff;

  if (statusElement) {
    statusElement.textContent = message;
    statusElement.className = 'status-message ' + (type ? `status-${type}` : '');
  }
}

function switchScreen(fromScreen, toScreen) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  toScreen.classList.add('active');
}

function setupDefaultSelections() {
  // Set default avatar and theme selections
  document.querySelectorAll('[data-avatar]').forEach(el => el.classList.remove('active'));
  document.querySelectorAll('[data-theme]').forEach(el => el.classList.remove('active'));
  
  document.querySelector(`[data-avatar="${currentAvatar}"]`)?.classList.add('active');
  document.querySelector(`[data-theme="${currentTheme}"]`)?.classList.add('active');
}

// ============================================
// SETUP FUNCTIONS
// ============================================
function selectAvatar(element) {
  document.querySelectorAll('[data-avatar]').forEach(el => el.classList.remove('active'));
  element.classList.add('active');
  currentAvatar = element.getAttribute('data-avatar');
  saveSettings();
}

function selectTheme(element) {
  document.querySelectorAll('[data-theme]').forEach(el => el.classList.remove('active'));
  element.classList.add('active');
  currentTheme = element.getAttribute('data-theme');
  applyTheme();
  saveSettings();
}

function selectThemeByName(theme) {
  document.querySelectorAll('[data-theme]').forEach(el => {
    if (el.getAttribute('data-theme') === theme) {
      el.classList.add('active');
    } else {
      el.classList.remove('active');
    }
  });
}

function applyTheme() {
  document.body.className = currentTheme ? `theme-${currentTheme}` : '';
}

function saveSettings() {
  // Still save to localStorage for quick access
  localStorage.setItem('carebridge-avatar', currentAvatar);
  localStorage.setItem('carebridge-theme', currentTheme);
  localStorage.setItem('carebridge-userId', currentUserId);
}

async function saveSettingsToDatabase() {
  if (!currentUserId) return;

  try {
    const body = {
      avatar: currentAvatar,
      theme: currentTheme
    };

    // Add authentication based on current method
    if (currentPin) {
      body.pin = currentPin;
    } else if (currentPassword) {
      body.password = currentPassword;
    } else {
      return; // No auth method available
    }

    const response = await fetch(`${API_URL}/api/users/${currentUserId}/settings`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });

    if (response.ok) {
      console.log('✓ Settings synced to database');
    } else {
      console.warn('⚠ Settings not synced, but chat continues');
    }
  } catch (error) {
    console.warn('Settings sync failed (non-blocking):', error);
  }
}

function loadSettings() {
  // Load from localStorage as fallback
  const savedAvatar = localStorage.getItem('carebridge-avatar');
  const savedTheme = localStorage.getItem('carebridge-theme');
  const savedUserId = localStorage.getItem('carebridge-userId');

  if (savedAvatar && !currentAvatar) {
    currentAvatar = savedAvatar;
  }
  if (savedTheme && !currentTheme) {
    currentTheme = savedTheme;
    selectThemeByName(savedTheme);
  } else {
    currentTheme = 'mint';
    selectThemeByName('mint');
  }

  if (savedUserId && !currentUserId) {
    currentUserId = savedUserId;
  }
}

// ============================================
// CHAT FUNCTIONS
// ============================================
async function checkApiConnection(options = {}) {
  const { silent = false } = options;

  try {
    const response = await fetch(`${API_URL}/health`);
    if (response.ok) {
      console.log('✓ Connected to CareBridge API');
      updateDemoStatus(true);
      await refreshDemoModelHealth();
      return true;
    } else {
      console.error('✗ API health check failed');
      updateDemoStatus(false);
      updateDemoLlamaControls();
      return false;
    }
  } catch (error) {
    console.error('✗ Cannot connect to API:', error.message);
    updateDemoStatus(false);
    demoModelHealth = {
      enabled: false,
      healthy: false,
      model: null,
      streamEnabled: false,
      checked: true
    };
    demoUseLiveLlama = false;
    localStorage.setItem('carebridge-demo-live-llama', 'false');
    updateDemoLlamaControls();
    if (!silent) {
      showNotification('Cannot connect to server. Make sure the app is running on port 3000.');
    }
    return false;
  }
}

async function startChat() {
  demoMode = false;
  updateDemoControlPanel(demoScenarios[currentDemoScenario]);
  messageInput.placeholder = 'Type your thoughts... (or just chat.)';

  // Save settings to database
  await saveSettingsToDatabase();

  // Check API before proceeding
  const isConnected = await checkApiConnection();
  if (!isConnected) return;

  // Switch screens
  switchScreen(setupScreen, chatScreen);

  // Update header
  headerAvatar.textContent = currentAvatar;
  messageCount = 0;

  // Create session
  await createSession();
  
  // Focus input
  messageInput.focus();
}

async function createSession() {
  if (demoMode && !shouldUseLiveDemoResponses()) {
    currentSession = `demo-${currentDemoScenario}-${Date.now()}`;
    const scenario = demoScenarios[currentDemoScenario] || demoScenarios.guided;
    renderDemoScenario(scenario);
    statusText.textContent = scenario.status;
    updateSettingsDisplay();
    return;
  }

  try {
    statusText.textContent = demoMode ? 'Preparing live demo session...' : 'Starting new session...';
    
    const response = await fetch(`${API_URL}/api/chat/start`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId: currentUserId,
        companionId: 'carebridge-companion-01'
      })
    });

    if (!response.ok) throw new Error('Failed to create session');
    
    const data = await response.json();
    currentSession = data.sessionId;
    
    statusText.textContent = 'Ready to chat';
    console.log('✓ Session created:', currentSession);
  } catch (error) {
    console.error('Error creating session:', error);
    statusText.textContent = 'Error creating session';
    showNotification('Failed to create chat session. Please try again.');
  }
}

async function sendMessage() {
  const message = messageInput.value.trim();
  
  if (!message) return;

  if (!currentSession && !(demoMode && shouldUseLiveDemoResponses())) return;

  // Disable input during send
  messageInput.disabled = true;
  sendBtn.disabled = true;

  // Add user message to UI
  addMessageToUI('user', message);
  messageInput.value = '';
  messageCount++;

  try {
    const demoContextHistory = demoMode ? getDemoContextHistory() : [];

    if (demoMode && !shouldUseLiveDemoResponses()) {
      const demoReply = getDemoReply(message);

      statusText.textContent = demoReply.status;
      await new Promise(resolve => setTimeout(resolve, 450));
      addMessageToUI('assistant', demoReply.reply);
      messageCount++;
      appendDemoConversation('user', message);
      appendDemoConversation('assistant', demoReply.reply);

      if (demoReply.note) {
        await new Promise(resolve => setTimeout(resolve, 250));
        addMessageToUI('assistant', demoReply.note);
        messageCount++;
        appendDemoConversation('assistant', demoReply.note);
      }

      updateSettingsDisplay();
      return;
    }

    if (demoMode && shouldUseLiveDemoResponses() && (!currentSession || currentSession.startsWith('demo-'))) {
      await createSession();

      if (!currentSession) {
        throw new Error('Failed to prepare live demo session');
      }
    }

    const fetchOptions = {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Accept': 'text/event-stream'
      },
      body: JSON.stringify({
        sessionId: currentSession,
        userId: currentUserId,
        message: message,
        contextHistory: demoContextHistory,
        stream: true
      })
    };

    statusText.textContent = 'Companion is thinking...';
    loadingIndicator.classList.add('active');

    const response = await fetch(`${API_URL}/api/chat`, fetchOptions);

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to send message');
    }

    const contentType = response.headers.get('content-type') || '';

    let assistantReply = '';

    if (contentType.includes('text/event-stream') && response.body) {
      assistantReply = await handleStreamingResponse(response);
    } else {
      const data = await response.json();
      assistantReply = handleNonStreamingResponse(data);
    }

    appendDemoConversation('user', message);
    appendDemoConversation('assistant', assistantReply);

    statusText.textContent = 'Ready to chat';
    messageCount++;
  } catch (error) {
    console.error('Error sending message:', error);

    if (demoMode && shouldUseLiveDemoResponses()) {
      demoUseLiveLlama = false;
      localStorage.setItem('carebridge-demo-live-llama', 'false');
      updateDemoLlamaControls();

      const demoReply = getDemoReply(message);
      addMessageToUI('assistant', demoReply.reply);
      appendDemoConversation('user', message);
      appendDemoConversation('assistant', demoReply.reply);
      if (demoReply.note) {
        addMessageToUI('assistant', demoReply.note);
        appendDemoConversation('assistant', demoReply.note);
      }
      statusText.textContent = 'Demo mode: switched back to scripted replies';
      showNotification('Live Llama failed during demo mode, so the app switched back to scripted replies.');
      return;
    }

    showNotification(`Error: ${error.message}`);
    addMessageToUI('assistant', `Sorry, I encountered an error: ${error.message}. Please try again.`);
    statusText.textContent = 'Error occurred';
  } finally {
    loadingIndicator.classList.remove('active');
    messageInput.disabled = false;
    sendBtn.disabled = false;
    messageInput.focus();
  }
}

async function handleStreamingResponse(response) {
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let fullResponse = '';
  let messageElement = null;

  try {
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) {
        // Process any remaining buffer
        if (buffer) {
          const lines = buffer.split('\n').filter(l => l.trim());
          for (const line of lines) {
            if (line.startsWith('data: ')) {
              try {
                const json = JSON.parse(line.slice(6));
                if (json.chunk) {
                  fullResponse += json.chunk;
                }
              } catch (e) {
                // Skip malformed JSON
              }
            }
          }
        }
        break;
      }

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || ''; // Keep incomplete line in buffer

      for (const line of lines) {
        if (!line.trim()) continue;
        
        if (line.startsWith('data: ')) {
          try {
            const json = JSON.parse(line.slice(6));
            
            if (json.chunk) {
              fullResponse += json.chunk;
              
              // Create or update message element
              if (!messageElement) {
                messageElement = addMessageToUI('assistant', fullResponse);
              } else {
                const contentP = messageElement.querySelector('.content p');
                if (contentP) contentP.textContent = fullResponse;
              }

              // Auto-scroll
              messagesContainer.scrollTop = messagesContainer.scrollHeight;
            }

            if (json.isDone) {
              statusText.textContent = 'Message received';
            }

            if (json.sessionId) {
              currentSession = json.sessionId;
            }
          } catch (e) {
            // Invalid JSON line, skip
          }
        }
      }
    }

    // If no message was created, something went wrong
    if (!messageElement && fullResponse === '') {
      throw new Error('No response received from server');
    }

    return fullResponse;

  } catch (error) {
    console.error('Streaming error:', error);
    throw error;
  }
}

function handleNonStreamingResponse(data) {
  if (data.sessionId) {
    currentSession = data.sessionId;
  }
  addMessageToUI('assistant', data.response);
  return data.response;
}

function addMessageToUI(role, content) {
  const messageDiv = document.createElement('div');
  messageDiv.className = `message ${role}`;

  const avatarDisplay = role === 'assistant' ? currentAvatar : '👤';
  
  messageDiv.innerHTML = `
    <div class="avatar">${avatarDisplay}</div>
    <div class="content">
      <p>${escapeHtml(content)}</p>
    </div>
  `;

  messagesContainer.appendChild(messageDiv);
  messagesContainer.scrollTop = messagesContainer.scrollHeight;

  return messageDiv;
}

function createMessageMarkup(role, content) {
  const avatarDisplay = role === 'assistant' ? currentAvatar : '👤';

  return `
    <div class="message ${role}">
      <div class="avatar">${avatarDisplay}</div>
      <div class="content">
        <p>${escapeHtml(content)}</p>
      </div>
    </div>
  `;
}

function getDemoReply(message) {
  const normalized = message.toLowerCase();

  if (normalized.includes('safe') || normalized.includes('unsafe') || normalized.includes('scared') || normalized.includes('afraid')) {
    return {
      status: 'Demo: staff follow-up would be flagged',
      reply: 'Thank you for saying that directly. The companion should respond calmly, encourage the young person to remain connected to immediate support, and surface a documented need for timely staff assessment.',
      note: 'Demo note: in the live product, staff would receive an alert and concise summary that supports review, documentation, and follow-up within facility protocols.'
    };
  }

  if (normalized.includes('family') || normalized.includes('visit') || normalized.includes('call')) {
    return {
      status: 'Demo: reflection and pattern capture',
      reply: 'Family contact can bring up several emotions at once. A strong response here would validate the feeling, explore what shifted after the visit or call, and capture themes the care team may want to review later.'
    };
  }

  if (normalized.includes('calm') || normalized.includes('bedtime') || normalized.includes('cope')) {
    return {
      status: 'Demo: supportive coaching',
      reply: 'A helpful response here would walk through one manageable grounding step, such as slowing breathing, naming what feels most intense, or identifying one routine that usually helps before bed.'
    };
  }

  if (normalized.includes('private') || normalized.includes('privacy') || normalized.includes('local')) {
    return {
      status: 'Demo: privacy-first positioning',
      reply: 'This project is designed around facility-controlled deployment, so a program can choose local hosting and keep transcripts, alerts, and model operations under its own governance.'
    };
  }

  return {
    status: 'Demo: supportive response',
    reply: 'In a live session, this is where the companion would reflect the young person’s message, ask a gentle follow-up, and help staff notice patterns if repeated concerns begin to emerge.'
  };
}

// ============================================
// SETTINGS FUNCTIONS
// ============================================
function openSettings() {
  settingsModal.classList.add('active');
  updateSettingsDisplay();
  
  // Reapply active states in modal
  document.querySelectorAll('#settingsModal [data-avatar]').forEach(el => {
    el.classList.toggle('active', el.getAttribute('data-avatar') === currentAvatar);
  });

  document.querySelectorAll('#settingsModal [data-theme]').forEach(el => {
    el.classList.toggle('active', el.getAttribute('data-theme') === currentTheme);
  });
}

function closeSettings() {
  settingsModal.classList.remove('active');
}

function updateSettingsDisplay() {
  document.getElementById('settingsUserId').textContent = currentUserId;
  document.getElementById('settingsSessionId').textContent = currentSession ? currentSession.substring(0, 13) + '...' : '-';
  document.getElementById('settingsMessageCount').textContent = messageCount;
}

function startNewChat() {
  closeSettings();
  if (demoMode) {
    createSession();
    messageInput.focus();
    return;
  }

  messagesContainer.innerHTML = createMessageMarkup(
    'assistant',
    "Hi there! 👋 I'm CareBridge Companion. I'm here to listen and support you. How are you doing today?"
  );
  messageCount = 1;
  createSession();
  messageInput.focus();
}

// ============================================
// UTILITIES
// ============================================
function escapeHtml(unsafe) {
  return unsafe
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function showNotification(message) {
  // Simple alert for now - could be improved with toast notifications
  alert(message);
}
