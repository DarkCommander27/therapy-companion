// ============================================
// CAREBRIDGE COMPANION - CHAT INTERFACE
// ============================================

const API_URL = 'http://localhost:3000';

let currentSession = null;
let currentUserId = null;
let currentAvatar = '🤖';
let currentTheme = 'mint';
let messageCount = 0;

// ============================================
// DOM ELEMENTS
// ============================================
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
document.addEventListener('DOMContentLoaded', () => {
  loadSettings();
  setupEventListeners();
  checkApiConnection();
});

function setupEventListeners() {
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
  localStorage.setItem('carebridge-avatar', currentAvatar);
  localStorage.setItem('carebridge-theme', currentTheme);
  localStorage.setItem('carebridge-userId', currentUserId);
}

function loadSettings() {
  const savedAvatar = localStorage.getItem('carebridge-avatar');
  const savedTheme = localStorage.getItem('carebridge-theme');
  const savedUserId = localStorage.getItem('carebridge-userId');

  if (savedAvatar) {
    currentAvatar = savedAvatar;
    document.querySelector(`[data-avatar="${savedAvatar}"]`)?.classList.add('active');
  } else {
    document.querySelector('[data-avatar="🤖"]')?.classList.add('active');
  }

  if (savedTheme) {
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
  const userIdInput = document.getElementById('userId').value.trim();
  
  if (!userIdInput) {
    currentUserId = `user-${Date.now()}`;
  } else {
    currentUserId = userIdInput;
  }

  saveSettings();

  // Check API before proceeding
  const isConnected = await checkApiConnection();
  if (!isConnected) return;

  // Switch screens
  setupScreen.classList.remove('active');
  chatScreen.classList.add('active');

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
    // Check if client supports streaming
    const supportsStreaming = process.env.NODE_ENV !== 'production';

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

    // Handle streaming response
    if (response.headers.get('content-type')?.includes('text/event-stream')) {
      await handleStreamingResponse(response);
    } else {
      // Fallback to non-streaming
      const data = await response.json();
      handleNonStreamingResponse(data);
    }

    statusText.textContent = 'Ready to chat';
    messageCount++;
  } catch (error) {
    console.error('Error sending message:', error);
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
  let assistantMessage = '';
  let messageElement = null;

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const chunk = decoder.decode(value);
      const lines = chunk.split('\n').filter(line => line.startsWith('data: '));

      for (const line of lines) {
        try {
          const json = JSON.parse(line.slice(6));
          
          if (json.chunk) {
            assistantMessage += json.chunk;
            
            // Create or update message element
            if (!messageElement) {
              messageElement = addMessageToUI('assistant', assistantMessage);
            } else {
              messageElement.querySelector('.content p').textContent = assistantMessage;
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
  } catch (error) {
    console.error('Stream error:', error);
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
