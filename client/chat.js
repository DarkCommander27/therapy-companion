// ============================================
// CAREBRIDGE COMPANION - CHAT INTERFACE
// ============================================

const API_URL = 'http://localhost:3000';

let currentSession = null;
let currentUserId = null;
let currentPin = null;
let currentAvatar = '🤖';
let currentTheme = 'mint';
let messageCount = 0;
let isNewUser = false;

// ============================================
// DOM ELEMENTS
// ============================================
const loginScreen = document.getElementById('loginScreen');
const userIdInput = document.getElementById('userIdInput');
const pinInput = document.getElementById('pinInput');
const loginBtn = document.getElementById('loginBtn');
const loginStatus = document.getElementById('loginStatus');

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

// ============================================
// INITIALIZATION
// ============================================
// INITIALIZATION
// ============================================
document.addEventListener('DOMContentLoaded', () => {
  setupEventListeners();
  checkApiConnection();
});

function setupEventListeners() {
  // Login screen
  loginBtn.addEventListener('click', handleLogin);
  pinInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      handleLogin();
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
async function handleLogin() {
  const userId = userIdInput.value.trim();
  const pin = pinInput.value.trim();

  if (!userId || !pin || pin.length !== 4) {
    showLoginStatus('Please enter valid User ID and 4-digit PIN', 'error');
    return;
  }

  if (!/^\d{4}$/.test(pin)) {
    showLoginStatus('PIN must be 4 digits', 'error');
    return;
  }

  try {
    loginBtn.disabled = true;
    showLoginStatus('Authenticating...', 'loading');

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
      showLoginStatus(data.error || 'Login failed', 'error');
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
      showLoginStatus('');
    } else {
      // For returning users, skip setup and go straight to chat
      setupDefaultSelections();
      switchScreen(loginScreen, chatScreen);
      await createSession();
    }

  } catch (error) {
    console.error('Login error:', error);
    showLoginStatus(`Connection error: ${error.message}`, 'error');
    loginBtn.disabled = false;
  }
}

function showLoginStatus(message, type = '') {
  loginStatus.textContent = message;
  loginStatus.className = 'status-message ' + (type ? `status-${type}` : '');
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
  if (!currentUserId || !currentPin) return;

  try {
    const response = await fetch(`${API_URL}/api/users/${currentUserId}/settings`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        pin: currentPin,
        avatar: currentAvatar,
        theme: currentTheme
      })
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
  }
  if (savedUserId && !currentUserId) {
    currentUserId = savedUserId;
  }
}  if (savedTheme) {
    currentTheme = savedTheme;
    selectThemeByName(savedTheme);
  } else {
    currentTheme = 'mint';
    selectThemeByName('mint');
  }

  if (savedUserId) {
    currentUserId = savedUserId;
    document.getElementById('userId').value = savedUserId;
  }
}

// ============================================
// CHAT FUNCTIONS
// ============================================
async function checkApiConnection() {
  try {
    const response = await fetch(`${API_URL}/health`);
    if (response.ok) {
      console.log('✓ Connected to CareBridge API');
      return true;
    } else {
      console.error('✗ API health check failed');
      return false;
    }
  } catch (error) {
    console.error('✗ Cannot connect to API:', error.message);
    showNotification('Cannot connect to server. Make sure the app is running on port 3000.');
    return false;
  }
}

async function startChat() {
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
  try {
    statusText.textContent = 'Starting new session...';
    
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
  
  if (!message || !currentSession) return;

  // Disable input during send
  messageInput.disabled = true;
  sendBtn.disabled = true;

  // Add user message to UI
  addMessageToUI('user', message);
  messageInput.value = '';
  messageCount++;

  try {
    // Always attempt streaming in browser
    const supportsStreaming = true;

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

    // Always try streaming first (check if body is readable)
    if (response.body) {
      try {
        await handleStreamingResponse(response);
      } catch (error) {
        console.warn('Streaming failed, attempting JSON fallback:', error);
        // If streaming fails, we can't retry since body is consumed
        // But the error will be caught below
      }
    }

    statusText.textContent = 'Ready to chat';
    messageCount++;
  } catch (error) {
    console.error('Error sending message:', error);
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

  } catch (error) {
    console.error('Streaming error:', error);
    throw error;
  }
}

function handleNonStreamingResponse(data) {
  addMessageToUI('assistant', data.response);
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
  messagesContainer.innerHTML = `
    <div class="message assistant">
      <div class="avatar">${currentAvatar}</div>
      <div class="content">
        <p>Hi there! 👋 I'm CareBridge Companion. I'm here to listen and support you. How are you doing today?</p>
      </div>
    </div>
  `;
  messageCount = 0;
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
