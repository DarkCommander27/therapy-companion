/* ============================================
   CAREBRIDGE STAFF DASHBOARD - LOGIC
   ============================================ */

const API_BASE = 'http://localhost:3000/api';
let currentView = 'overview';
let allConversations = [];
let allFlaggedConversations = [];
let staffToken = null;

// ============================================
// AUTHENTICATION GUARD
// ============================================
function checkAuthentication() {
  staffToken = localStorage.getItem('staffToken');
  
  if (!staffToken) {
    console.warn('No staff token found, redirecting to login');
    window.location.href = './staff-login.html';
    return false;
  }
  
  return true;
}

function handleLogout() {
  if (confirm('Are you sure you want to sign out?')) {
    localStorage.removeItem('staffToken');
    localStorage.removeItem('rememberStaffDevice');
    window.location.href = './staff-login.html';
  }
}

// ============================================
// INITIALIZATION
// ============================================
document.addEventListener('DOMContentLoaded', () => {
  if (!checkAuthentication()) return;
  
  initializeEventListeners();
  loadDashboardData();
  switchView('overview');
});

function initializeEventListeners() {
  // Navigation
  const navItems = document.querySelectorAll('.nav-item');
  navItems.forEach(item => {
    item.addEventListener('click', () => {
      const viewName = item.getAttribute('data-view');
      switchView(viewName);
    });
  });

  // Modal close button
  const closeBtn = document.querySelector('.btn-close');
  if (closeBtn) {
    closeBtn.addEventListener('click', closeConversationModal);
  }

  // Modal background click
  const modal = document.getElementById('conversationModal');
  if (modal) {
    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        closeConversationModal();
      }
    });
  }

  // Search functionality
  const searchBtn = document.querySelector('.btn-search');
  if (searchBtn) {
    searchBtn.addEventListener('click', searchConversations);
  }

  const searchInput = document.querySelector('.search-box input');
  if (searchInput) {
    searchInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        searchConversations();
      }
    });
  }

  // Refresh button
  const refreshBtn = document.querySelector('.btn-refresh');
  if (refreshBtn) {
    refreshBtn.addEventListener('click', () => {
      showLoadingOverlay();
      loadDashboardData().then(() => {
        loadViewData(currentView);
        hideLoadingOverlay();
      });
    });
  }

  // Logout button
  const logoutBtn = document.getElementById('logoutBtn');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', handleLogout);
  }
}

// ============================================
// VIEW SWITCHING
// ============================================
function switchView(viewName) {
  currentView = viewName;

  // Update active nav item
  document.querySelectorAll('.nav-item').forEach(item => {
    item.classList.remove('active');
  });
  document.querySelector(`[data-view="${viewName}"]`).classList.add('active');

  // Hide all views
  document.querySelectorAll('.view').forEach(view => {
    view.classList.remove('active');
  });

  // Show selected view
  const viewElement = document.getElementById(`${viewName}View`);
  if (viewElement) {
    viewElement.classList.add('active');
  }

  // Load view-specific data
  loadViewData(viewName);
}

function loadViewData(viewName) {
  switch (viewName) {
    case 'overview':
      displayOverviewStats();
      break;
    case 'alerts':
      displaySafetyAlerts();
      break;
    case 'followups':
      displayFollowups();
      break;
    case 'conversations':
      displayConversations();
      break;
    case 'analytics':
      displayAnalytics();
      break;
  }
}

// ============================================
// DATA LOADING
// ============================================
async function loadDashboardData() {
  try {
    // Load all conversations
    const conversationsResponse = await fetch(`${API_BASE}/chat`);
    if (conversationsResponse.ok) {
      allConversations = await conversationsResponse.json();
    }

    // Load flagged conversations
    const flaggedResponse = await fetch(`${API_BASE}/chat/flagged`);
    if (flaggedResponse.ok) {
      allFlaggedConversations = await flaggedResponse.json();
    }
  } catch (error) {
    console.error('Error loading dashboard data:', error);
    showNotification('Error loading data from server');
  }
}

// ============================================
// OVERVIEW VIEW
// ============================================
function displayOverviewStats() {
  const stats = calculateStats();

  // Update stat cards
  document.getElementById('totalMessagesNum').textContent = stats.totalMessages;
  document.getElementById('activeChildrenNum').textContent = stats.activeChildren;
  document.getElementById('safetyAlertsNum').textContent = stats.safetyAlerts;
  document.getElementById('pendingFollowupsNum').textContent = stats.pendingFollowups;

  // Display recent activity
  displayRecentActivity();

  // Display mood distribution
  displayMoodDistribution();
}

function calculateStats() {
  const stats = {
    totalMessages: 0,
    activeChildren: new Set(),
    safetyAlerts: allFlaggedConversations.length,
    pendingFollowups: 0
  };

  allConversations.forEach(conv => {
    if (conv.messages && Array.isArray(conv.messages)) {
      stats.totalMessages += conv.messages.length;
    }
    if (conv.userId) {
      stats.activeChildren.add(conv.userId);
    }
    if (conv.needsFollowup) {
      stats.pendingFollowups++;
    }
  });

  stats.activeChildren = stats.activeChildren.size;

  return stats;
}

function displayRecentActivity() {
  const activityContainer = document.getElementById('recentActivity');
  if (!activityContainer) return;

  // Sort by timestamp (most recent first)
  const recent = allConversations.slice(0, 5);

  if (recent.length === 0) {
    activityContainer.innerHTML = '<p class="loading">No recent activity yet</p>';
    return;
  }

  const html = recent.map(conv => `
    <div class="conversation-item${conv.flagged ? ' critical' : ''}">
      <div class="conversation-header">
        <span class="conversation-user">User: ${conv.userId || 'Unknown'}</span>
        <span class="conversation-time">${formatTime(conv.createdAt)}</span>
      </div>
      <div class="conversation-preview">
        ${escapeHtml((conv.messages?.[0]?.content || 'No messages'))}
      </div>
      <div class="conversation-footer">
        ${conv.flagged ? '<span class="badge danger">FLAGGED</span>' : ''}
        ${conv.needsFollowup ? '<span class="badge warning">FOLLOW-UP</span>' : ''}
        <span class="badge">${conv.messages?.length || 0} messages</span>
      </div>
    </div>
  `).join('');

  activityContainer.innerHTML = html;
}

function displayMoodDistribution() {
  const moodContainer = document.getElementById('moodDistribution');
  if (!moodContainer) return;

  const moodCounts = {
    '😊': 0,
    '😔': 0,
    '😤': 0,
    '😰': 0,
    '😌': 0,
    '🤔': 0
  };

  allConversations.forEach(conv => {
    if (conv.mood && moodCounts.hasOwnProperty(conv.mood)) {
      moodCounts[conv.mood]++;
    }
  });

  const html = Object.entries(moodCounts).map(([emoji, count]) => `
    <div class="mood-item">
      <div class="mood-emoji">${emoji}</div>
      <div class="mood-count">${count}</div>
    </div>
  `).join('');

  moodContainer.innerHTML = html;
}

// ============================================
// SAFETY ALERTS VIEW
// ============================================
function displaySafetyAlerts() {
  const alertsContainer = document.getElementById('alertsList');
  if (!alertsContainer) return;

  if (allFlaggedConversations.length === 0) {
    alertsContainer.innerHTML = '<p class="loading">No safety alerts</p>';
    return;
  }

  const html = allFlaggedConversations.map(conv => `
    <div class="conversation-item critical">
      <div class="conversation-header">
        <span class="conversation-user">User: ${conv.userId || 'Unknown'}</span>
        <span class="conversation-time">${formatTime(conv.flaggedAt)}</span>
      </div>
      <div class="conversation-preview">
        Flag Reason: ${escapeHtml(conv.flagReason || 'Safety concern detected')}
      </div>
      <div class="conversation-footer">
        <span class="badge danger">${conv.severity || 'MEDIUM'}</span>
        <button class="btn btn-primary btn-sm" onclick="viewConversationDetail('${conv.sessionId}')">
          View Details
        </button>
      </div>
    </div>
  `).join('');

  alertsContainer.innerHTML = html;
}

// ============================================
// FOLLOW-UPS VIEW
// ============================================
function displayFollowups() {
  const followupsContainer = document.getElementById('followupsList');
  if (!followupsContainer) return;

  const followups = allConversations.filter(c => c.needsFollowup);

  if (followups.length === 0) {
    followupsContainer.innerHTML = '<p class="loading">No pending follow-ups</p>';
    return;
  }

  const html = followups.map(conv => `
    <div class="conversation-item">
      <div class="conversation-header">
        <span class="conversation-user">User: ${conv.userId || 'Unknown'}</span>
        <span class="conversation-time">${formatTime(conv.createdAt)}</span>
      </div>
      <div class="conversation-preview">
        ${escapeHtml(conv.followupReason || 'Requires staff follow-up')}
      </div>
      <div class="conversation-footer">
        <span class="badge warning">FOLLOW-UP NEEDED</span>
        <button class="btn btn-primary btn-sm" onclick="viewConversationDetail('${conv.sessionId}')">
          View & Acknowledge
        </button>
      </div>
    </div>
  `).join('');

  followupsContainer.innerHTML = html;
}

// ============================================
// CONVERSATIONS VIEW
// ============================================
function displayConversations() {
  const conversationsContainer = document.getElementById('conversationsList');
  if (!conversationsContainer) return;

  if (allConversations.length === 0) {
    conversationsContainer.innerHTML = '<p class="loading">No conversations yet</p>';
    return;
  }

  // Group by user
  const grouped = {};
  allConversations.forEach(conv => {
    const userId = conv.userId || 'Unknown User';
    if (!grouped[userId]) {
      grouped[userId] = [];
    }
    grouped[userId].push(conv);
  });

  const html = Object.entries(grouped).map(([userId, convs]) => `
    <div class="card">
      <h3>${userId} (${convs.length} conversations)</h3>
      <div class="conversations-list">
        ${convs.map(conv => `
          <div class="conversation-item${conv.flagged ? ' critical' : ''}">
            <div class="conversation-header">
              <span class="conversation-user">Session: ${conv.sessionId?.slice(0, 8) || 'N/A'}...</span>
              <span class="conversation-time">${formatTime(conv.createdAt)}</span>
            </div>
            <div class="conversation-preview">
              ${escapeHtml((conv.messages?.[0]?.content || 'No messages'))}
            </div>
            <div class="conversation-footer">
              ${conv.flagged ? '<span class="badge danger">FLAGGED</span>' : ''}
              ${conv.needsFollowup ? '<span class="badge warning">FOLLOW-UP</span>' : ''}
              <span class="badge">${conv.messages?.length || 0} messages</span>
              <button class="btn btn-primary btn-sm" onclick="viewConversationDetail('${conv.sessionId}')">
                View
              </button>
            </div>
          </div>
        `).join('')}
      </div>
    </div>
  `).join('');

  conversationsContainer.innerHTML = html;
}

function searchConversations() {
  const searchInput = document.querySelector('.search-box input');
  const searchTerm = searchInput.value.trim().toLowerCase();

  if (!searchTerm) {
    displayConversations();
    return;
  }

  const filtered = allConversations.filter(conv =>
    conv.userId?.toLowerCase().includes(searchTerm) ||
    conv.sessionId?.toLowerCase().includes(searchTerm)
  );

  const conversationsContainer = document.getElementById('conversationsList');
  if (!conversationsContainer) return;

  if (filtered.length === 0) {
    conversationsContainer.innerHTML = `<p class="loading">No conversations match "${escapeHtml(searchTerm)}"</p>`;
    return;
  }

  const html = filtered.map(conv => `
    <div class="conversation-item${conv.flagged ? ' critical' : ''}">
      <div class="conversation-header">
        <span class="conversation-user">${escapeHtml(conv.userId || 'Unknown')}</span>
        <span class="conversation-time">${formatTime(conv.createdAt)}</span>
      </div>
      <div class="conversation-preview">
        ${escapeHtml((conv.messages?.[0]?.content || 'No messages'))}
      </div>
      <div class="conversation-footer">
        ${conv.flagged ? '<span class="badge danger">FLAGGED</span>' : ''}
        ${conv.needsFollowup ? '<span class="badge warning">FOLLOW-UP</span>' : ''}
        <span class="badge">${conv.messages?.length || 0} messages</span>
        <button class="btn btn-primary btn-sm" onclick="viewConversationDetail('${conv.sessionId}')">
          View
        </button>
      </div>
    </div>
  `).join('');

  conversationsContainer.innerHTML = html;
}

// ============================================
// ANALYTICS VIEW
// ============================================
function displayAnalytics() {
  const analyticsContainer = document.getElementById('analyticsContent');
  if (!analyticsContainer) return;

  const stats = calculateStats();
  const messageStats = calculateMessageStats();
  const topicsOfConcern = extractTopics();

  const html = `
    <div class="analytics-grid">
      <div class="card">
        <h3>📊 Message Statistics</h3>
        <div class="stats-content">
          <div class="stat-row">
            <span class="stat-label">Total Messages</span>
            <span class="stat-value">${stats.totalMessages}</span>
          </div>
          <div class="stat-row">
            <span class="stat-label">Average per Session</span>
            <span class="stat-value">${(stats.totalMessages / Math.max(allConversations.length, 1)).toFixed(1)}</span>
          </div>
          <div class="stat-row">
            <span class="stat-label">Active Conversations</span>
            <span class="stat-value">${allConversations.length}</span>
          </div>
          <div class="stat-row">
            <span class="stat-label">Unique Users</span>
            <span class="stat-value">${stats.activeChildren}</span>
          </div>
        </div>
      </div>

      <div class="card">
        <h3>⚠️ Safety Summary</h3>
        <div class="stats-content">
          <div class="stat-row">
            <span class="stat-label">Flagged Conversations</span>
            <span class="stat-value critical">${stats.safetyAlerts}</span>
          </div>
          <div class="stat-row">
            <span class="stat-label">Pending Follow-ups</span>
            <span class="stat-value warning">${stats.pendingFollowups}</span>
          </div>
          <div class="stat-row">
            <span class="stat-label">Alert Flag Rate</span>
            <span class="stat-value">${((stats.safetyAlerts / Math.max(allConversations.length, 1)) * 100).toFixed(1)}%</span>
          </div>
        </div>
      </div>

      <div class="card">
        <h3>💭 Mood Distribution</h3>
        <div class="mood-grid">
          <div class="mood-item">
            <div class="mood-emoji">😊</div>
            <div class="mood-name">Happy</div>
            <div class="mood-count">${messageMoodCount('happy')}</div>
          </div>
          <div class="mood-item">
            <div class="mood-emoji">😔</div>
            <div class="mood-name">Sad</div>
            <div class="mood-count">${messageMoodCount('sad')}</div>
          </div>
          <div class="mood-item">
            <div class="mood-emoji">😤</div>
            <div class="mood-name">Angry</div>
            <div class="mood-count">${messageMoodCount('angry')}</div>
          </div>
          <div class="mood-item">
            <div class="mood-emoji">😰</div>
            <div class="mood-name">Anxious</div>
            <div class="mood-count">${messageMoodCount('anxious')}</div>
          </div>
          <div class="mood-item">
            <div class="mood-emoji">😌</div>
            <div class="mood-name">Calm</div>
            <div class="mood-count">${messageMoodCount('calm')}</div>
          </div>
          <div class="mood-item">
            <div class="mood-emoji">🤔</div>
            <div class="mood-name">Thoughtful</div>
            <div class="mood-count">${messageMoodCount('thoughtful')}</div>
          </div>
        </div>
      </div>

      <div class="card">
        <h3>🏷️ Topics of Concern</h3>
        <div class="stats-content">
          ${topicsOfConcern.length > 0 
            ? topicsOfConcern.slice(0, 8).map(topic => `
              <div class="stat-row">
                <span class="stat-label">${escapeHtml(topic.word)}</span>
                <span class="stat-value">${topic.count}</span>
              </div>
            `).join('')
            : '<p>No significant topics detected</p>'
          }
        </div>
      </div>
    </div>
  `;

  analyticsContainer.innerHTML = html;
}

function calculateMessageStats() {
  let stats = {
    totalMessages: 0,
    totalResponses: 0,
    averageMessageLength: 0
  };

  allConversations.forEach(conv => {
    if (conv.messages && Array.isArray(conv.messages)) {
      conv.messages.forEach(msg => {
        if (msg.role === 'user') {
          stats.totalMessages++;
        } else {
          stats.totalResponses++;
        }
      });
    }
  });

  return stats;
}

function messageMoodCount(mood) {
  return allConversations.filter(c => c.mood === mood).length;
}

function extractTopics() {
  const concerns = [
    'suicidal', 'suicide', 'harm', 'death', 'depressed', 'depression',
    'abuse', 'bullying', 'violence', 'assault', 'trauma', 'anxious',
    'fear', 'scared', 'worried', 'lonely', 'isolated', 'cutting',
    'self-harm', 'drugs', 'alcohol', 'eating', 'disorder'
  ];

  const topicCount = {};

  allConversations.forEach(conv => {
    if (conv.messages && Array.isArray(conv.messages)) {
      conv.messages.forEach(msg => {
        const content = msg.content?.toLowerCase() || '';
        concerns.forEach(word => {
          if (content.includes(word)) {
            topicCount[word] = (topicCount[word] || 0) + 1;
          }
        });
      });
    }
  });

  return Object.entries(topicCount)
    .map(([word, count]) => ({ word, count }))
    .sort((a, b) => b.count - a.count);
}

// ============================================
// MODAL & CONVERSATION DETAIL
// ============================================
function viewConversationDetail(sessionId) {
  const conversation = allConversations.find(c => c.sessionId === sessionId);
  if (!conversation) {
    showNotification('Conversation not found');
    return;
  }

  // Populate modal
  const modalTitle = document.querySelector('.modal-header h2');
  const detailContent = document.getElementById('conversationDetail');
  const detailUser = document.getElementById('detailUser');

  if (modalTitle) {
    modalTitle.textContent = `Conversation with ${conversation.userId || 'User'}`;
  }

  if (detailUser) {
    detailUser.innerHTML = `
      <strong>User ID:</strong> ${escapeHtml(conversation.userId || 'Unknown')}<br>
      <strong>Session ID:</strong> ${escapeHtml(conversation.sessionId)}<br>
      <strong>Date:</strong> ${formatDateTime(conversation.createdAt)}<br>
      ${conversation.flagged ? `<strong style="color: var(--danger-color);">Status: FLAGGED</strong><br>` : ''}
      ${conversation.flagReason ? `<strong>Flag Reason:</strong> ${escapeHtml(conversation.flagReason)}<br>` : ''}
      ${conversation.needsFollowup ? `<strong style="color: var(--warning-color);">Requires Follow-up</strong><br>` : ''}
    `;
  }

  if (detailContent) {
    const messages = conversation.messages || [];
    const messagesHtml = messages.map((msg, idx) => `
      <div class="message-detail">
        <div class="message-role">${msg.role === 'user' ? '👤 User' : '🤖 Companion'}</div>
        <div class="message-content">${escapeHtml(msg.content)}</div>
        <div class="message-meta">${formatTime(msg.timestamp)}</div>
      </div>
    `).join('');

    detailContent.innerHTML = messagesHtml || '<p class="loading">No messages in this conversation</p>';
  }

  // Show modal
  openConversationModal();

  // Update acknowledge button
  const acknowledgeBtn = document.querySelector('[onclick="acknowledgeReview()"]');
  if (acknowledgeBtn) {
    acknowledgeBtn.setAttribute('data-session-id', sessionId);
    if (conversation.reviewedBy) {
      acknowledgeBtn.textContent = '✓ Reviewed';
      acknowledgeBtn.disabled = true;
    } else {
      acknowledgeBtn.textContent = 'Mark as Reviewed';
      acknowledgeBtn.disabled = false;
    }
  }
}

function openConversationModal() {
  const modal = document.getElementById('conversationModal');
  if (modal) {
    modal.classList.add('active');
  }
}

function closeConversationModal() {
  const modal = document.getElementById('conversationModal');
  if (modal) {
    modal.classList.remove('active');
  }
}

async function acknowledgeReview() {
  const btn = event.target;
  const sessionId = btn.getAttribute('data-session-id');

  if (!sessionId) return;

  try {
    const response = await fetch(`${API_BASE}/chat/${sessionId}/acknowledge`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reviewedBy: 'staff' })
    });

    if (response.ok) {
      // Update button state
      btn.textContent = '✓ Reviewed';
      btn.disabled = true;

      // Reload data
      await loadDashboardData();
      loadViewData(currentView);

      showNotification('Review acknowledged');
    }
  } catch (error) {
    console.error('Error acknowledging review:', error);
    showNotification('Error saving acknowledgment');
  }
}

// ============================================
// UTILITY FUNCTIONS
// ============================================
function formatTime(dateString) {
  if (!dateString) return 'N/A';

  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now - date;
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;

  return date.toLocaleDateString();
}

function formatDateTime(dateString) {
  if (!dateString) return 'N/A';

  const date = new Date(dateString);
  return date.toLocaleString();
}

function escapeHtml(unsafe) {
  if (!unsafe) return '';
  return unsafe
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function showNotification(message) {
  alert(message);
}

function showLoadingOverlay() {
  const overlay = document.querySelector('.loading-overlay');
  if (overlay) {
    overlay.classList.add('active');
  }
}

function hideLoadingOverlay() {
  const overlay = document.querySelector('.loading-overlay');
  if (overlay) {
    overlay.classList.remove('active');
  }
}

// Add button styles for small buttons
const style = document.createElement('style');
style.textContent = `
  .btn-sm {
    padding: 6px 12px;
    font-size: 12px;
  }
  .stat-value.critical {
    color: var(--danger-color);
  }
  .stat-value.warning {
    color: var(--warning-color);
  }
`;
document.head.appendChild(style);
