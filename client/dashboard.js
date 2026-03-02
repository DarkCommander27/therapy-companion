/* ============================================
   CAREBRIDGE STAFF DASHBOARD - LOGIC
   ============================================ */

const API_BASE = 'http://localhost:3000/api';
let currentView = 'overview';
let allConversations = [];
let dashboardStats = {};
let staffToken = null;
let currentPage = 1;
let totalPages = 1;

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
    showLoadingOverlay();

    // Load overview stats
    const statsResponse = await fetch(`${API_BASE}/conversations/stats/overview`, {
      headers: { 'Authorization': `Bearer ${staffToken}` }
    });
    if (statsResponse.ok) {
      const statsData = await statsResponse.json();
      dashboardStats = statsData.stats;
    }

    // Load recent conversations (first page)
    const conversationsResponse = await fetch(
      `${API_BASE}/conversations?page=1&limit=20&sortBy=recent`,
      {
        headers: { 'Authorization': `Bearer ${staffToken}` }
      }
    );
    if (conversationsResponse.ok) {
      const data = await conversationsResponse.json();
      allConversations = data.data;
      currentPage = data.pagination.currentPage;
      totalPages = data.pagination.totalPages;
    }

    hideLoadingOverlay();
  } catch (error) {
    console.error('Error loading dashboard data:', error);
    showNotification('Error loading data from server', 'error');
    hideLoadingOverlay();
  }
}

// ============================================
// OVERVIEW VIEW
// ============================================
function displayOverviewStats() {
  // Update stat cards with actual data
  document.getElementById('totalMessages').textContent = dashboardStats.totalMessages || 0;
  document.getElementById('activeChildren').textContent = dashboardStats.totalActiveUsers || 0;
  document.getElementById('safetyAlerts').textContent = dashboardStats.flaggedConversations || 0;
  document.getElementById('pendingFollowups').textContent = dashboardStats.followupsNeeded || 0;

  // Display recent activity
  displayRecentActivity();

  // Display mood distribution
  displayMoodDistribution();
}

function displayRecentActivity() {
  const activityContainer = document.getElementById('recentActivity');
  if (!activityContainer) return;

  if (allConversations.length === 0) {
    activityContainer.innerHTML = '<p class="loading">No recent activity yet</p>';
    return;
  }

  const html = allConversations.slice(0, 10).map(conv => `
    <div class="conversation-item${conv.hasSafetyFlags ? ' critical' : ''}">
      <div class="conversation-header">
        <span class="conversation-user">👤 ${escapeHtml(conv.userId)}</span>
        <span class="conversation-time">${formatTime(conv.lastMessageTime)}</span>
      </div>
      <div class="conversation-preview">
        ${escapeHtml(conv.lastMessagePreview)}
      </div>
      <div class="conversation-footer">
        <span class="badge">${conv.overallMood}</span>
        ${conv.hasSafetyFlags ? '<span class="badge danger">⚠️ FLAGGED</span>' : ''}
        ${conv.requiresStaffFollowUp ? '<span class="badge warning">FOLLOW-UP</span>' : ''}
        <span class="badge">${conv.messageCount} msgs</span>
        <button class="btn btn-primary btn-sm" onclick="viewConversationDetail('${conv.sessionId}')">View</button>
      </div>
    </div>
  `).join('');

  activityContainer.innerHTML = html;
}

function displayMoodDistribution() {
  const moodContainer = document.getElementById('moodDistribution');
  if (!moodContainer) return;

  const moodEmojis = {
    'happy': '😊',
    'sad': '😔',
    'angry': '😤',
    'anxious': '😰',
    'calm': '😌',
    'neutral': '🤔',
    'hopeful': '🌟',
    'desperate': '😩'
  };

  const moodCounts = {};
  
  allConversations.forEach(conv => {
    const mood = conv.overallMood || 'neutral';
    moodCounts[mood] = (moodCounts[mood] || 0) + 1;
  });

  const html = Object.entries(moodCounts).map(([mood, count]) => `
    <div class="mood-item">
      <div class="mood-emoji">${moodEmojis[mood] || '🤔'}</div>
      <div class="mood-name">${mood}</div>
      <div class="mood-count">${count}</div>
    </div>
  `).join('');

  moodContainer.innerHTML = html || '<p class="loading">No mood data available</p>';
}

// ============================================
// SAFETY ALERTS VIEW
// ============================================
async function displaySafetyAlerts() {
  const alertsContainer = document.getElementById('flaggedList');
  if (!alertsContainer) return;

  try {
    showLoadingOverlay();
    
    const response = await fetch(
      `${API_BASE}/conversations?status=flagged&limit=50`,
      {
        headers: { 'Authorization': `Bearer ${staffToken}` }
      }
    );
    
    if (!response.ok) throw new Error('Failed to fetch flagged conversations');
    
    const data = await response.json();
    const flaggedConversations = data.data;

    if (flaggedConversations.length === 0) {
      alertsContainer.innerHTML = '<p class="loading">No safety alerts</p>';
      hideLoadingOverlay();
      return;
    }

    const html = flaggedConversations.map(conv => `
      <div class="conversation-item critical">
        <div class="conversation-header">
          <span class="conversation-user">👤 ${escapeHtml(conv.userId)}</span>
          <span class="conversation-time">${formatTime(conv.lastMessageTime)}</span>
        </div>
        <div class="conversation-preview">
          <strong>Flags:</strong> ${conv.safetyFlagsDetected.map(f => f.type).join(', ')}
          <br><em>"${escapeHtml(conv.lastMessagePreview)}"</em>
        </div>
        <div class="conversation-footer">
          ${conv.criticalFlags.length > 0 ? `<span class="badge danger">CRITICAL (${conv.criticalFlags.length})</span>` : ''}
          <span class="badge">${conv.messageCount} msgs</span>
          <button class="btn btn-primary btn-sm" onclick="viewConversationDetail('${conv.sessionId}')">View & Acknowledge</button>
        </div>
      </div>
    `).join('');

    alertsContainer.innerHTML = html;
    hideLoadingOverlay();
  } catch (error) {
    console.error('Error loading safety alerts:', error);
    alertsContainer.innerHTML = '<p class="loading">Error loading alerts</p>';
    hideLoadingOverlay();
  }
}

// ============================================
// FOLLOW-UPS VIEW
// ============================================
async function displayFollowups() {
  const followupsContainer = document.getElementById('followupsList');
  if (!followupsContainer) return;

  try {
    showLoadingOverlay();
    
    const response = await fetch(
      `${API_BASE}/conversations?status=followup&limit=50`,
      {
        headers: { 'Authorization': `Bearer ${staffToken}` }
      }
    );
    
    if (!response.ok) throw new Error('Failed to fetch follow-ups');
    
    const data = await response.json();
    const followups = data.data;

    if (followups.length === 0) {
      followupsContainer.innerHTML = '<p class="loading">No pending follow-ups</p>';
      hideLoadingOverlay();
      return;
    }

    const html = followups.map(conv => `
      <div class="conversation-item">
        <div class="conversation-header">
          <span class="conversation-user">👤 ${escapeHtml(conv.userId)}</span>
          <span class="conversation-time">${formatTime(conv.lastMessageTime)}</span>
        </div>
        <div class="conversation-preview">
          <strong>Topics:</strong> ${conv.primaryTopics.join(', ') || 'None tracked'}<br>
          <strong>Concerns:</strong> ${conv.primaryConcerns.join(', ') || 'None identified'}
        </div>
        <div class="conversation-footer">
          <span class="badge warning">✓ FOLLOW-UP NEEDED</span>
          <span class="badge">${conv.messageCount} msgs</span>
          <button class="btn btn-primary btn-sm" onclick="viewConversationDetail('${conv.sessionId}')">Review & Acknowledge</button>
        </div>
      </div>
    `).join('');

    followupsContainer.innerHTML = html;
    hideLoadingOverlay();
  } catch (error) {
    console.error('Error loading follow-ups:', error);
    followupsContainer.innerHTML = '<p class="loading">Error loading follow-ups</p>';
    hideLoadingOverlay();
  }
}

// ============================================
// CONVERSATIONS VIEW
// ============================================
async function displayConversations() {
  const conversationsContainer = document.getElementById('conversationsList');
  if (!conversationsContainer) return;

  try {
    showLoadingOverlay();
    
    const response = await fetch(
      `${API_BASE}/conversations?page=${currentPage}&limit=20&sortBy=recent`,
      {
        headers: { 'Authorization': `Bearer ${staffToken}` }
      }
    );
    
    if (!response.ok) throw new Error('Failed to fetch conversations');
    
    const data = await response.json();
    const conversations = data.data;
    currentPage = data.pagination.currentPage;
    totalPages = data.pagination.totalPages;

    if (conversations.length === 0) {
      conversationsContainer.innerHTML = '<p class="loading">No conversations yet</p>';
      hideLoadingOverlay();
      return;
    }

    // Group by user
    const grouped = {};
    conversations.forEach(conv => {
      const userId = conv.userId || 'Unknown User';
      if (!grouped[userId]) {
        grouped[userId] = [];
      }
      grouped[userId].push(conv);
    });

    const html = Object.entries(grouped).map(([userId, convs]) => `
      <div class="card">
        <h3>👤 ${escapeHtml(userId)} (${convs.length} conversation${convs.length !== 1 ? 's' : ''})</h3>
        <div class="conversations-list">
          ${convs.map(conv => `
            <div class="conversation-item${conv.hasSafetyFlags ? ' critical' : ''}">
              <div class="conversation-header">
                <span class="conversation-user">📋 ${conv.sessionId.slice(0, 12)}...</span>
                <span class="conversation-time">${formatTime(conv.lastMessageTime)}</span>
              </div>
              <div class="conversation-preview">
                ${escapeHtml(conv.lastMessagePreview)}
              </div>
              <div class="conversation-footer">
                <span class="badge">${conv.overallMood}</span>
                ${conv.moodTrend ? `<span class="badge">${conv.moodTrend}</span>` : ''}
                ${conv.hasSafetyFlags ? '<span class="badge danger">⚠️ FLAGGED</span>' : ''}
                ${conv.requiresStaffFollowUp ? '<span class="badge warning">FOLLOW-UP</span>' : ''}
                <span class="badge">${conv.messageCount} msgs</span>
                <button class="btn btn-primary btn-sm" onclick="viewConversationDetail('${conv.sessionId}')">View</button>
              </div>
            </div>
          `).join('')}
        </div>
      </div>
    `).join('');

    conversationsContainer.innerHTML = html;
    
    // Add pagination controls if needed
    if (totalPages > 1) {
      conversationsContainer.innerHTML += `
        <div style="text-align: center; padding: 20px; margin-top: 20px;">
          ${currentPage > 1 ? `<button onclick="previousPage()" class="btn btn-secondary">← Previous</button>` : ''}
          <span style="margin: 0 10px;">Page ${currentPage} of ${totalPages}</span>
          ${currentPage < totalPages ? `<button onclick="nextPage()" class="btn btn-secondary">Next →</button>` : ''}
        </div>
      `;
    }
    
    hideLoadingOverlay();
  } catch (error) {
    console.error('Error loading conversations:', error);
    conversationsContainer.innerHTML = '<p class="loading">Error loading conversations</p>';
    hideLoadingOverlay();
  }
}

function nextPage() {
  if (currentPage < totalPages) {
    currentPage++;
    displayConversations();
  }
}

function previousPage() {
  if (currentPage > 1) {
    currentPage--;
    displayConversations();
  }
}

async function searchConversations() {
  const searchInput = document.querySelector('.search-box input');
  const searchTerm = searchInput.value.trim();

  if (!searchTerm) {
    currentPage = 1;
    displayConversations();
    return;
  }

  try {
    showLoadingOverlay();
    
    const response = await fetch(
      `${API_BASE}/conversations?page=1&limit=50&userId=${encodeURIComponent(searchTerm)}`,
      {
        headers: { 'Authorization': `Bearer ${staffToken}` }
      }
    );
    
    if (!response.ok) throw new Error('Failed to search');
    
    const data = await response.json();
    const conversationsContainer = document.getElementById('conversationsList');
    
    if (data.data.length === 0) {
      conversationsContainer.innerHTML = `<p class="loading">No conversations match "${escapeHtml(searchTerm)}"</p>`;
      hideLoadingOverlay();
      return;
    }

    const grouped = {};
    data.data.forEach(conv => {
      const userId = conv.userId;
      if (!grouped[userId]) grouped[userId] = [];
      grouped[userId].push(conv);
    });

    const html = Object.entries(grouped).map(([userId, convs]) => `
      <div class="card">
        <h3>${escapeHtml(userId)} (${convs.length})</h3>
        <div class="conversations-list">
          ${convs.map(conv => `
            <div class="conversation-item${conv.hasSafetyFlags ? ' critical' : ''}">
              <div class="conversation-header">
                <span>${conv.sessionId.slice(0, 12)}...</span>
                <span>${formatTime(conv.lastMessageTime)}</span>
              </div>
              <div class="conversation-preview">
                ${escapeHtml(conv.lastMessagePreview)}
              </div>
              <div class="conversation-footer">
                <button class="btn btn-primary btn-sm" onclick="viewConversationDetail('${conv.sessionId}')">View</button>
              </div>
            </div>
          `).join('')}
        </div>
      </div>
    `).join('');

    conversationsContainer.innerHTML = html;
    hideLoadingOverlay();
  } catch (error) {
    console.error('Search error:', error);
    showNotification('Search failed', 'error');
    hideLoadingOverlay();
  }
}

// ============================================
// ANALYTICS VIEW
// ============================================
async function displayAnalytics() {
  try {
    showLoadingOverlay();
    
    // Get all conversations for analytics
    const response = await fetch(
      `${API_BASE}/conversations?page=1&limit=1000`,
      {
        headers: { 'Authorization': `Bearer ${staffToken}` }
      }
    );
    
    if (!response.ok) throw new Error('Failed to fetch analytics data');
    
    const data = await response.json();
    const conversations = data.data;

    const analyticsContainer = document.getElementById('analyticsView');
    if (!analyticsContainer) {
      hideLoadingOverlay();
      return;
    }

    // Calculate mood distribution
    const moodCounts = {};
    const topicsMap = {};
    let totalFlags = 0;

    conversations.forEach(conv => {
      // Mood counts
      const mood = conv.overallMood || 'neutral';
      moodCounts[mood] = (moodCounts[mood] || 0) + 1;

      // Topics
      (conv.primaryTopics || []).forEach(topic => {
        topicsMap[topic] = (topicsMap[topic] || 0) + 1;
      });

      // Concerns
      (conv.primaryConcerns || []).forEach(concern => {
        topicsMap[concern] = (topicsMap[concern] || 0) + 1;
      });

      if (conv.hasSafetyFlags) totalFlags++;
    });

    // Sort topics by frequency
    const sortedTopics = Object.entries(topicsMap)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([name, count]) => ({ name, count }));

    const moodEmojis = {
      happy: '😊', sad: '😔', angry: '😤', anxious: '😰',
      calm: '😌', neutral: '🤔', hopeful: '🌟', desperate: '😩'
    };

    const html = `
      <div class="analytics-grid">
        <div class="card">
          <h3>📊 Message Statistics</h3>
          <div class="stats-content">
            <div class="stat-row">
              <span class="stat-label">Total Messages</span>
              <span class="stat-value">${dashboardStats.totalMessages || 0}</span>
            </div>
            <div class="stat-row">
              <span class="stat-label">Avg Messages per Session</span>
              <span class="stat-value">${dashboardStats.avgMessagesPerConversation || '0'}</span>
            </div>
            <div class="stat-row">
              <span class="stat-label">Total Conversations</span>
              <span class="stat-value">${dashboardStats.totalConversations || 0}</span>
            </div>
            <div class="stat-row">
              <span class="stat-label">Active Users</span>
              <span class="stat-value">${dashboardStats.totalActiveUsers || 0}</span>
            </div>
          </div>
        </div>

        <div class="card">
          <h3>⚠️ Safety Summary</h3>
          <div class="stats-content">
            <div class="stat-row">
              <span class="stat-label">Flagged Conversations</span>
              <span class="stat-value critical">${dashboardStats.flaggedConversations || 0}</span>
            </div>
            <div class="stat-row">
              <span class="stat-label">Pending Follow-ups</span>
              <span class="stat-value warning">${dashboardStats.followupsNeeded || 0}</span>
            </div>
            <div class="stat-row">
              <span class="stat-label">Flag Rate</span>
              <span class="stat-value">${dashboardStats.totalConversations > 0 ? ((dashboardStats.flaggedConversations / dashboardStats.totalConversations) * 100).toFixed(1) : '0'}%</span>
            </div>
            <div class="stat-row">
              <span class="stat-label">Active Sessions</span>
              <span class="stat-value">${dashboardStats.activeConversations || 0}</span>
            </div>
          </div>
        </div>

        <div class="card">
          <h3>😊 Mood Distribution</h3>
          <div class="mood-grid">
            ${Object.entries(moodCounts).map(([mood, count]) => `
              <div class="mood-item">
                <div class="mood-emoji">${moodEmojis[mood] || '🤔'}</div>
                <div class="mood-name">${mood}</div>
                <div class="mood-count">${count}</div>
              </div>
            `).join('')}
          </div>
        </div>

        <div class="card">
          <h3>🎯 Topics & Concerns</h3>
          <div class="stats-content">
            ${sortedTopics.length > 0 
              ? sortedTopics.map(topic => `
                <div class="stat-row">
                  <span class="stat-label">${escapeHtml(topic.name)}</span>
                  <span class="stat-value">${topic.count}</span>
                </div>
              `).join('')
              : '<p>No topics identified yet</p>'
            }
          </div>
        </div>
      </div>
    `;

    const contentArea = analyticsContainer.querySelector('.analytics-grid');
    if (contentArea) {
      contentArea.innerHTML = html;
    } else {
      const gridDiv = document.createElement('div');
      gridDiv.className = 'analytics-grid';
      gridDiv.innerHTML = html;
      analyticsContainer.appendChild(gridDiv);
    }

    hideLoadingOverlay();
  } catch (error) {
    console.error('Error loading analytics:', error);
    showNotification('Error loading analytics data', 'error');
    hideLoadingOverlay();
  }
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

function showNotification(message, type = 'info') {
  const notification = document.createElement('div');
  notification.className = `notification notification-${type}`;
  notification.textContent = message;
  notification.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    padding: 15px 20px;
    background: ${type === 'error' ? '#f44336' : type === 'success' ? '#4caf50' : type === 'warning' ? '#ff9800' : '#2196f3'};
    color: white;
    border-radius: 4px;
    box-shadow: 0 2px 5px rgba(0,0,0,0.2);
    z-index: 10000;
    animation: slideIn 0.3s ease;
    max-width: 400px;
  `;
  document.body.appendChild(notification);
  
  setTimeout(() => {
    notification.style.animation = 'slideOut 0.3s ease';
    setTimeout(() => notification.remove(), 300);
  }, 3000 + message.length * 50);
}

// ============================================
// VIEW CONVERSATION DETAIL
// ============================================
async function viewConversationDetail(sessionId) {
  try {
    showLoadingOverlay();
    
    const response = await fetch(
      `${API_BASE}/conversations/${sessionId}`,
      {
        headers: { 'Authorization': `Bearer ${staffToken}` }
      }
    );
    
    if (!response.ok) throw new Error('Failed to load conversation');
    
    const data = await response.json();
    const conversation = data.data;

    const modal = document.createElement('div');
    modal.className = 'modal-overlay';
    modal.id = 'conversationDetailModal';
    modal.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: rgba(0,0,0,0.5);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 9999;
    `;

    const moodEmojis = {
      happy: '😊', sad: '😔', angry: '😤', anxious: '😰',
      calm: '😌', neutral: '🤔', hopeful: '🌟', desperate: '😩'
    };

    const modalContent = document.createElement('div');
    modalContent.className = 'modal-content';
    modalContent.style.cssText = `
      background: white;
      border-radius: 8px;
      max-width: 90%;
      width: 800px;
      max-height: 90vh;
      overflow-y: auto;
      box-shadow: 0 4px 6px rgba(0,0,0,0.1);
    `;

    let messagesHtml = '';
    (conversation.messages || []).forEach(msg => {
      messagesHtml += `
        <div class="message-item" style="
          padding: 15px;
          margin: 10px 0;
          border-radius: 4px;
          background: ${msg.role === 'user' ? '#f5f5f5' : '#e3f2fd'};
          border-left: 4px solid ${msg.role === 'user' ? '#999' : '#2196f3'};
        ">
          <div style="font-weight: bold; margin-bottom: 8px;">
            ${msg.role === 'user' ? '👤 User' : '🤖 Assistant'} - ${formatTime(msg.timestamp)}
          </div>
          <div style="color: #333;">${escapeHtml(msg.content).replace(/\n/g, '<br>')}</div>
          ${msg.safetyFlags && msg.safetyFlags.length > 0 ? `
            <div style="margin-top: 10px; padding-top: 10px; border-top: 1px solid #ddd;">
              ${msg.safetyFlags.map(flag => `
                <span style="
                  display: inline-block;
                  padding: 4px 8px;
                  margin: 4px;
                  background: ${flag.severity === 'critical' ? '#ff1744' : flag.severity === 'high' ? '#ff6f00' : '#fbc02d'};
                  color: white;
                  border-radius: 3px;
                  font-size: 12px;
                ">
                  ${escapeHtml(flag.type)}: ${escapeHtml(flag.explanation)}
                </span>
              `).join('')}
            </div>
          ` : ''}
        </div>
      `;
    });

    let flagsHtml = '';
    if (conversation.safetyFlagsDetected && conversation.safetyFlagsDetected.length > 0) {
      flagsHtml = `
        <div style="margin-top: 20px; padding: 15px; background: #fff3cd; border-radius: 4px;">
          <h3 style="margin-top: 0;">⚠️ Safety Flags Summary</h3>
          ${conversation.safetyFlagsDetected.map(flag => `
            <div style="padding: 10px; margin: 5px 0; background: white; border-radius: 3px; border-left: 4px solid #ff9800;">
              <strong>${escapeHtml(flag.type)}</strong> - Occurred ${flag.count} time(s) - Severity: ${flag.severity}
            </div>
          `).join('')}
        </div>
      `;
    }

    let notesHtml = '';
    if (conversation.staffNotes && conversation.staffNotes.length > 0) {
      notesHtml = `
        <div style="margin-top: 20px; padding: 15px; background: #f0f4f8; border-radius: 4px;">
          <h3 style="margin-top: 0;">📝 Staff Notes</h3>
          ${conversation.staffNotes.map(note => `
            <div style="padding: 10px; margin: 10px 0; background: white; border-radius: 3px;">
              <div style="font-size: 12px; color: #666;">${escapeHtml(note.staffName)} - ${formatTime(note.timestamp)}</div>
              <div style="margin-top: 5px; color: #333;">${escapeHtml(note.content).replace(/\n/g, '<br>')}</div>
            </div>
          `).join('')}
        </div>
      `;
    }

    modalContent.innerHTML = `
      <div style="padding: 20px;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
          <h2 style="margin: 0;">📋 Conversation Details</h2>
          <button onclick="closeModal('conversationDetailModal')" style="
            background: none;
            border: none;
            font-size: 28px;
            cursor: pointer;
            color: #666;
          ">&times;</button>
        </div>

        <div style="padding: 15px; background: #f9f9f9; border-radius: 4px; margin-bottom: 20px;">
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px;">
            <div>
              <strong>User ID:</strong> ${escapeHtml(conversation.userId)}
            </div>
            <div>
              <strong>Session Started:</strong> ${formatTime(conversation.createdAt)}
            </div>
            <div>
              <strong>Last Message:</strong> ${formatTime(conversation.updatedAt)}
            </div>
            <div>
              <strong>Mood:</strong> ${moodEmojis[conversation.overallMood] || '🤔'} ${conversation.overallMood}
            </div>
            <div>
              <strong>Messages:</strong> ${(conversation.messages || []).length}
            </div>
            ${conversation.hasSafetyFlags ? `
              <div style="color: #ff6f00;">
                <strong>⚠️ Safety Flags:</strong> ${conversation.safetyFlagsDetected?.length || 0}
              </div>
            ` : ''}
          </div>
        </div>

        <div style="margin: 20px 0;">
          <h3>💬 Message Thread</h3>
          ${messagesHtml}
        </div>

        ${flagsHtml}
        ${notesHtml}

        <div style="margin-top: 20px; padding: 15px; background: #f0f4f8; border-radius: 4px;">
          <h3 style="margin-top: 0;">➕ Add Staff Note</h3>
          <textarea id="newStaffNote" placeholder="Add a note about this conversation..." style="
            width: 100%;
            padding: 10px;
            border: 1px solid #ddd;
            border-radius: 4px;
            font-family: inherit;
            resize: vertical;
            min-height: 100px;
          "></textarea>
          <button onclick="addStaffNote('${sessionId}')" style="
            margin-top: 10px;
            padding: 10px 20px;
            background: #2196f3;
            color: white;
            border: none;
            border-radius: 4px;
            cursor: pointer;
            font-weight: bold;
          ">Add Note</button>
        </div>
      </div>
    `;

    modal.appendChild(modalContent);
    document.body.appendChild(modal);

    hideLoadingOverlay();
  } catch (error) {
    console.error('Error loading conversation:', error);
    showNotification('Error loading conversation details', 'error');
    hideLoadingOverlay();
  }
}

async function addStaffNote(sessionId) {
  const textarea = document.getElementById('newStaffNote');
  const noteContent = textarea.value.trim();
  
  if (!noteContent) {
    showNotification('Please enter a note', 'warning');
    return;
  }

  try {
    showLoadingOverlay();
    
    const response = await fetch(
      `${API_BASE}/conversations/${sessionId}/add-note`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${staffToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ content: noteContent })
      }
    );
    
    if (!response.ok) throw new Error('Failed to add note');
    
    textarea.value = '';
    showNotification('Note added successfully', 'success');
    
    // Reload conversation detail
    setTimeout(() => {
      closeModal('conversationDetailModal');
      viewConversationDetail(sessionId);
    }, 500);
    
  } catch (error) {
    console.error('Error adding note:', error);
    showNotification('Error adding note', 'error');
  } finally {
    hideLoadingOverlay();
  }
}

function closeModal(modalId) {
  const modal = document.getElementById(modalId);
  if (modal) {
    modal.remove();
  }
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
