// ============================================================
// PowerSight Tracker — Background Service Worker
// Manages timer state, URL monitoring, violation logging,
// and face verification scheduling
// ============================================================

const SUPABASE_URL = 'https://chornvckgdhojcbmtuoy.supabase.co';
const SUPABASE_KEY = 'sb_publishable_AX5I_KqRWEWj4LIw_LzTTg_cxmbQxit';
const DASHBOARD_URL = 'http://localhost:3000';

// Allowed URL patterns — domains the employee is permitted to work on
const ALLOWED_PATTERNS = [
  'localhost',
  '127.0.0.1',
  'google.com',
  'drive.google.com',
  'gmail.com',
  'sap.com',
  'ucc.cit.tum.de',
  's36.gb.ucc.cit.tum.de',
  'cit.tum.de',
  'chrome://',
  'chrome-extension://',
  'edge://',
  'coccoc://',
  'brave://',
  'about:',
];

// Domains that trigger automatic fullscreen enforcement
const PROTECTED_DOMAINS = [
  'sap.com',
  'google.com',
  'gmail.com',
  'localhost',
  'ucc.cit.tum.de'
];

// Auto-fullscreen enforcement for protected domains
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete' && tab.url) {
    const isProtected = PROTECTED_DOMAINS.some(domain => tab.url.includes(domain));
    if (isProtected) {
      chrome.windows.get(tab.windowId, (win) => {
        if (win.state !== 'fullscreen') {
          console.log('[PowerSight] Enforcing fullscreen for protected domain:', tab.url);
          chrome.windows.update(tab.windowId, { state: 'fullscreen' });
        }
      });
    }
  }
});

// ---- Face Verification Config ----
const FACE_VERIFY_MIN_MS = 60_000;  // 1 minute
const FACE_VERIFY_MAX_MS = 60_000; // 1 minute
const FACE_VERIFY_RETRY_MS = 30_000; // 30 seconds retry on failure

const KEEPALIVE_ALARM = 'powersight-keepalive';
const STORAGE_KEY = 'powersight_timer_state';

let faceVerifyTimer = null;
let faceVerifyState = {
  phase: 'idle', // idle | warning | scanning | success | fail
  isPausedForFace: false,
};

// ---- State ----
// Uses timestamp-based approach: we store the wallclock time when the timer
// last started (`runSince`) so elapsed time can be recomputed after SW restart.
let timerState = {
  isRunning: false,
  seconds: 0,        // accumulated seconds from previous run segments
  sessionStart: null, // ISO string — start of the overall session
  isPausedByViolation: false,
  currentUrl: '',
  isUrlAllowed: true,
  runSince: 0,        // Date.now() when current running segment started
  employeeId: 'EM001', // Default employee ID
};

// ---- Persistence Helpers ----
async function saveState() {
  try {
    await chrome.storage.local.set({
      [STORAGE_KEY]: {
        timerState: { ...timerState },
        faceVerifyState: { ...faceVerifyState },
        savedAt: Date.now(),
      },
    });
  } catch (e) {
    console.warn('[PowerSight] Failed to save state:', e);
  }
}

async function restoreState() {
  try {
    const data = await chrome.storage.local.get(STORAGE_KEY);
    const saved = data[STORAGE_KEY];
    if (!saved) return;

    const ts = saved.timerState;
    if (ts) {
      timerState.seconds = ts.seconds || 0;
      timerState.sessionStart = ts.sessionStart || null;
      timerState.isPausedByViolation = ts.isPausedByViolation || false;
      timerState.currentUrl = ts.currentUrl || '';
      timerState.isUrlAllowed = ts.isUrlAllowed !== false;
      timerState.runSince = ts.runSince || 0;
      timerState.isRunning = ts.isRunning || false;
      timerState.employeeId = ts.employeeId || 'EM001';

      // If timer was running when SW died, the elapsed time since runSince
      // hasn't been captured yet. We keep isRunning=true and runSince as-is
      // so getActiveState() will compute the correct total.
      if (timerState.isRunning && timerState.runSince > 0) {
        console.log('[PowerSight] ♻️ Restored running timer — runSince:', new Date(timerState.runSince).toISOString());
      }
    }

    const fvs = saved.faceVerifyState;
    if (fvs) {
      faceVerifyState.phase = fvs.phase || 'idle';
      faceVerifyState.isPausedForFace = fvs.isPausedForFace || false;
    }

    console.log('[PowerSight] ✅ State restored from storage');
  } catch (e) {
    console.warn('[PowerSight] Failed to restore state:', e);
  }
}

// ---- Keepalive Alarm ----
// Keeps the SW alive while the timer is running (fires every 25s)
function startKeepalive() {
  chrome.alarms.create(KEEPALIVE_ALARM, { periodInMinutes: 0.4 });
}

function stopKeepalive() {
  chrome.alarms.clear(KEEPALIVE_ALARM);
}

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === KEEPALIVE_ALARM) {
    // Just touching the SW keeps it alive; also persist state
    if (timerState.isRunning) {
      saveState();
      broadcastState();
    } else {
      stopKeepalive();
    }
  }
});

// ---- Timer via Timestamps ----
function startTimer() {
  if (timerState.isRunning) {
    // Nếu đang chạy mà bị kẹt state xác minh mặt thì clear state
    if (faceVerifyState.isPausedForFace) {
      faceVerifyState.isPausedForFace = false;
      faceVerifyState.phase = 'idle';
      broadcastState();
    }
    return;
  }
  timerState.isRunning = true;
  timerState.isPausedByViolation = false;
  timerState.runSince = Date.now();
  if (!timerState.sessionStart) {
    timerState.sessionStart = new Date().toISOString();
  }
  faceVerifyState.isPausedForFace = false;
  faceVerifyState.phase = 'idle';

  // Force fullscreen on start
  chrome.windows.getCurrent((win) => {
    if (!chrome.runtime.lastError && win) {
      chrome.windows.update(win.id, { state: 'fullscreen' });
    }
  });

  startKeepalive();
  saveState();
  broadcastState();

  // Schedule face verification when timer starts
  scheduleFaceVerification();
}

function pauseTimer(byViolation = false) {
  if (timerState.isRunning) {
    timerState.seconds += Math.floor((Date.now() - timerState.runSince) / 1000);
    timerState.runSince = 0;
  }
  timerState.isRunning = false;
  timerState.isPausedByViolation = byViolation;
  saveState();
  broadcastState();
}

function pauseTimerForFace() {
  if (timerState.isRunning) {
    timerState.seconds += Math.floor((Date.now() - timerState.runSince) / 1000);
    timerState.runSince = 0;
  }
  timerState.isRunning = false;
  faceVerifyState.isPausedForFace = true;
  saveState();
  broadcastState();
}

function resumeTimerAfterFace() {
  faceVerifyState.isPausedForFace = false;
  faceVerifyState.phase = 'idle';
  timerState.isRunning = true;
  timerState.runSince = Date.now();

  // Re-ensure fullscreen after verification
  chrome.windows.getCurrent((win) => {
    if (!chrome.runtime.lastError && win) {
      chrome.windows.update(win.id, { state: 'fullscreen' });
    }
  });

  startKeepalive();
  saveState();
  broadcastState();

  // Schedule next verification (random 1-3 min)
  scheduleFaceVerification();
}

function stopTimer() {
  if (timerState.isRunning) {
    timerState.seconds += Math.floor((Date.now() - timerState.runSince) / 1000);
  }
  timerState.isRunning = false;
  timerState.seconds = 0;
  timerState.sessionStart = null;
  timerState.isPausedByViolation = false;
  timerState.runSince = 0;
  faceVerifyState.isPausedForFace = false;
  faceVerifyState.phase = 'idle';
  clearFaceVerifyTimer();
  stopKeepalive();
  saveState();
  broadcastState();
}

function getActiveState() {
  const state = { ...timerState };
  if (state.isRunning && state.runSince > 0) {
    state.seconds += Math.floor((Date.now() - state.runSince) / 1000);
  }
  state.faceVerify = { ...faceVerifyState };
  // Include runSince so clients can compute time locally with timestamps
  state.runSince = timerState.runSince;
  return state;
}

function broadcastState(activeTabOnly = false) {
  const msg = { type: 'STATE_UPDATE', state: getActiveState() };
  
  if (activeTabOnly) {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs && tabs[0] && tabs[0].id) {
        chrome.tabs.sendMessage(tabs[0].id, msg).catch(() => { });
      }
    });
    return;
  }

  // Send to all content scripts
  chrome.tabs.query({}, (tabs) => {
    if (chrome.runtime.lastError) { const _ = chrome.runtime.lastError; }
    if (!tabs) return;
    
    // Prioritize active tab
    const activeTab = tabs.find(t => t.active && t.highlighted);
    if (activeTab && activeTab.id) {
      chrome.tabs.sendMessage(activeTab.id, msg).catch(() => { });
    }

    tabs.forEach((tab) => {
      if (tab.id && (!activeTab || tab.id !== activeTab.id)) {
        chrome.tabs.sendMessage(tab.id, msg).catch(() => { });
      }
    });
  });
}

// ---- Face Verification Scheduling ----
function randomFaceInterval() {
  return Math.floor(Math.random() * (FACE_VERIFY_MAX_MS - FACE_VERIFY_MIN_MS + 1)) + FACE_VERIFY_MIN_MS;
}

function clearFaceVerifyTimer() {
  if (faceVerifyTimer) {
    clearTimeout(faceVerifyTimer);
    faceVerifyTimer = null;
  }
}

function scheduleFaceVerification(delayMs) {
  clearFaceVerifyTimer();
  if (!timerState.isRunning) return;

  const delay = delayMs || randomFaceInterval();
  console.log(`[PowerSight] 🕒 Next face verification in ${Math.round(delay / 1000)}s`);

  faceVerifyTimer = setTimeout(() => {
    triggerFaceVerification();
  }, delay);
}

function triggerFaceVerification() {
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    if (chrome.runtime.lastError) { const _ = chrome.runtime.lastError; }
    
    if (tabs && tabs[0]) {
      const url = tabs[0].url || '';
      const isLoginPage = url.includes('/login') || url.includes('/auth') || url.includes('accounts.google.com');
      
      if (isLoginPage) {
        console.log('[PowerSight] 🚫 Skipping face verification on login/auth page:', url);
        // Reschedule in 30s to try again later when they might be logged in
        scheduleFaceVerification(30000);
        return;
      }
    }

    console.log('[PowerSight] 🔔 Triggering face verification!');

    // Pause timer
    pauseTimerForFace();
    faceVerifyState.phase = 'warning';

    // Send FACE_VERIFY_START to active tab
    const msg = { type: 'FACE_VERIFY_START' };
    if (tabs && tabs[0] && tabs[0].id) {
      chrome.tabs.sendMessage(tabs[0].id, msg).catch(() => {
        console.warn('[PowerSight] Could not send face verify to active tab');
      });
    }

    // Also show a notification as backup
    chrome.notifications.create('face-verify', {
      type: 'basic',
      iconUrl: 'icons/icon128.png',
      title: '⚠️ Xác minh khuôn mặt',
      message: 'Hệ đồng cần xác minh danh tính của bạn. Vui lòng nhìn vào camera.',
      priority: 2,
      requireInteraction: true,
    });

    broadcastState();
  });
}

// ---- URL Monitoring ----
function isUrlAllowed(url) {
  if (!url) return true;
  return ALLOWED_PATTERNS.some((pattern) => url.includes(pattern));
}

function checkCurrentTab(providedTab = null) {
  const processTab = (tab) => {
    if (!tab) return;
    const url = tab.url || '';
    timerState.currentUrl = url;
    const allowed = isUrlAllowed(url);
    timerState.isUrlAllowed = allowed;

    if (!allowed && timerState.isRunning) {
      // 1. Show notification INSTANTLY
      chrome.notifications.create('violation-url', {
        type: 'basic',
        iconUrl: 'icons/icon128.png',
        title: '⚠️ Vi phạm: Trang web không được phép',
        message: `Bạn đang truy cập trang không nằm trong danh sách cho phép. Timer đã tạm dừng. Quay lại làm việc ngay.`,
        priority: 2,
      });

      // 2. Pause and Broadcast
      pauseTimer(true);
      broadcastState(true); // Active tab only for speed

      // 3. Log asynchronously
      logViolation('unauthorized_website', 'critical', {
        reason: 'Employee accessed non-allowed website',
        url: url,
      });
    } else if (allowed && timerState.isPausedByViolation) {
      startTimer();
    } else {
      broadcastState(true);
    }

    // If waiting for face verify, re-trigger modal on the now-active tab
    if (faceVerifyState.isPausedForFace && (faceVerifyState.phase === 'warning' || faceVerifyState.phase === 'fail')) {
      chrome.tabs.sendMessage(tab.id, { type: 'FACE_VERIFY_START' }).catch(() => {});
    }
  };

  if (providedTab) {
    processTab(providedTab);
  } else {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (chrome.runtime.lastError) { const _ = chrome.runtime.lastError; }
      if (tabs && tabs[0]) processTab(tabs[0]);
    });
  }
}

// ---- Fullscreen Enforcement ----
// Aggressively re-enforces fullscreen if user tries to exit it while timer is running
chrome.windows.onBoundsChanged.addListener((window) => {
  if (timerState.isRunning && window.state !== 'fullscreen') {
    chrome.windows.update(window.id, { state: 'fullscreen' });
  }
});

// Tab change listeners
chrome.tabs.onActivated.addListener((activeInfo) => {
  // Very small delay to allow URL to be ready
  setTimeout(() => {
    checkCurrentTab();
  }, 50);
});
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.url) {
    // If URL changed, check immediately
    checkCurrentTab(tab);
  } else if (changeInfo.status === 'complete') {
    checkCurrentTab(tab);
  }
});

// ---- Browser/Desktop Focus Detection ----
// Window focus monitoring removed as requested.

// ---- Idle Detection (screen lock, AFK) ----
chrome.idle.setDetectionInterval(300); // 5 minutes
chrome.idle.onStateChanged.addListener((newState) => {
  if (newState === 'idle' || newState === 'locked') {
    if (timerState.isRunning) {
      pauseTimer(true);
      logViolation('idle_detected', 'warning', {
        reason: `System detected: ${newState}`,
      });
    }
  } else if (newState === 'active') {
    if (timerState.isPausedByViolation) {
      checkCurrentTab();
    }
  }
});

// ---- Supabase Logging ----
async function logViolation(type, severity, details) {
  console.warn(`[PowerSight] Violation: ${type}`, details);
  const now = new Date();
  try {
    await fetch(`${SUPABASE_URL}/rest/v1/fraud_events`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': SUPABASE_KEY,
        'Authorization': `Bearer ${SUPABASE_KEY}`,
        'Prefer': 'return=minimal',
      },
      body: JSON.stringify({
        emp_id: timerState.employeeId || 'EM001',
        year: now.getFullYear(),
        month: now.getMonth() + 1,
        event_type: type,
        severity: severity,
        details: JSON.stringify(details),
        is_fraud: 1, // Store as integer for is_fraud column
        module: 'Extension',
        timestamp: now.toISOString()
      }),
    });
  } catch (err) {
    console.error('[PowerSight] Failed to log violation:', err);
  }
}

// ---- Face Descriptor Sync ----
async function syncFaceDescriptor() {
  if (!timerState.employeeId) return;
  
  console.log('[PowerSight] 🔄 Syncing face descriptor from Supabase for:', timerState.employeeId);
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/employees?emp_id=eq.${timerState.employeeId}&select=face_id`, {
      headers: {
        'apikey': SUPABASE_KEY,
        'Authorization': `Bearer ${SUPABASE_KEY}`,
      }
    });
    const data = await res.json();
    if (data && data[0] && data[0].face_id) {
      console.log('[PowerSight] ✅ Face descriptor synced successfully');
      await chrome.storage.local.set({ powerSight_faceDescriptor: data[0].face_id });
    } else {
      console.warn('[PowerSight] ⚠️ No face descriptor found in Supabase');
    }
  } catch (err) {
    console.error('[PowerSight] Failed to sync face descriptor:', err);
  }
}

// ---- Message Handler (from content scripts & popup) ----
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  switch (msg.type) {
    case 'GET_STATE':
      sendResponse(getActiveState());
      break;
    case 'START':
      startTimer();
      sendResponse(getActiveState());
      break;
    case 'PAUSE':
      pauseTimer(false);
      sendResponse(getActiveState());
      break;
    case 'STOP':
      stopTimer();
      sendResponse(getActiveState());
      break;
    case 'FORCE_FULLSCREEN':
      if (sender.tab && sender.tab.windowId) {
        chrome.windows.update(sender.tab.windowId, { state: 'fullscreen' });
      } else {
        chrome.windows.update(chrome.windows.WINDOW_ID_CURRENT, { state: 'fullscreen' });
      }
      sendResponse(getActiveState());
      break;
    case 'VIOLATION':
      logViolation(msg.violationType || msg.type, msg.severity || 'warning', msg.details || {});
      sendResponse(getActiveState());
      break;
    case 'SET_CONFIG':
      if (msg.config) {
        if (msg.config.employeeId) {
          const oldId = timerState.employeeId;
          timerState.employeeId = msg.config.employeeId;
          if (oldId !== timerState.employeeId) {
            syncFaceDescriptor();
          }
        }
        saveState();
      }
      sendResponse({ ok: true });
      break;
    case 'GO_HOME':
      chrome.tabs.query({ url: '*://localhost/*' }, (tabs) => {
        if (chrome.runtime.lastError) { const _ = chrome.runtime.lastError; }
        if (tabs && tabs.length > 0) {
          const existingTab = tabs[0];
          chrome.tabs.update(existingTab.id, { active: true });
          chrome.windows.update(existingTab.windowId, { focused: true, state: 'fullscreen' });
        } else {
          chrome.tabs.create({ url: DASHBOARD_URL }, (tab) => {
             chrome.windows.update(tab.windowId, { state: 'fullscreen' });
          });
        }
      });
      sendResponse({ ok: true });
      break;
    case 'SWITCH_TAB':
      chrome.tabs.query({ url: msg.pattern }, (tabs) => {
        if (chrome.runtime.lastError) { const _ = chrome.runtime.lastError; }
        if (tabs && tabs.length > 0) {
          const existingTab = tabs[0];
          // Always navigate to the specific URL to ensure we're not on a 'wrong link'
          chrome.tabs.update(existingTab.id, { url: msg.url, active: true });
          chrome.windows.update(existingTab.windowId, { focused: true, state: 'fullscreen' });
        } else {
          chrome.tabs.create({ url: msg.url }, (tab) => {
            chrome.windows.update(tab.windowId, { state: 'fullscreen' });
          });
        }
      });
      sendResponse({ ok: true });
      break;
    case 'FACE_VERIFY_RESULT':
      // Handle result from content script face verification
      console.log('[PowerSight] Face verify result:', msg.result);
      chrome.notifications.clear('face-verify');

      if (msg.result && msg.result.match) {
        // Success — resume timer
        faceVerifyState.phase = 'success';
        broadcastState();
        setTimeout(() => {
          resumeTimerAfterFace();
        }, 2000);
      } else {
        // Failure — keep paused, retry in 1 min
        faceVerifyState.phase = 'fail';
        broadcastState();
        logViolation('face_mismatch', 'critical', {
          reason: 'Face verification failed',
          distance: msg.result ? msg.result.distance : 999,
        });
        setTimeout(() => {
          faceVerifyState.phase = 'idle';
          broadcastState();
          // Retry in 1 minute
          scheduleFaceVerification(FACE_VERIFY_RETRY_MS);
        }, 3000);
      }
      sendResponse({ ok: true });
      break;
    case 'FACE_VERIFY_TRIGGER':
      // Manual trigger from popup or content script
      if (timerState.isRunning) {
        triggerFaceVerification();
      }
      sendResponse({ ok: true });
      break;
    case 'MOUSE_VIOLATION':
      if (timerState.isRunning) {
        pauseTimer(true);
        logViolation('mouse_fake', 'critical', {
          reason: msg.reason,
          metrics: msg.metrics
        });
        chrome.notifications.create('violation-mouse', {
          type: 'basic',
          iconUrl: 'icons/icon128.png',
          title: '⚠️ Vi phạm: Di chuyển chuột bất thường',
          message: 'Phát hiện hành vi di chuyển chuột không giống người thật (Auto/Script). Timer đã bị dừng.',
          priority: 2,
        });
      }
      sendResponse({ ok: true });
      break;
    case 'FORCE_FULLSCREEN':
      chrome.windows.getCurrent((win) => {
        chrome.windows.update(win.id, { state: 'fullscreen' });
      });
      sendResponse({ ok: true });
      break;
    default:
      sendResponse({ error: 'Unknown message type' });
  }
  return true; // keep channel open for async
});

// ---- Notification Click ----
chrome.notifications.onClicked.addListener((notifId) => {
  chrome.tabs.query({ url: '*://localhost/*' }, (tabs) => {
    if (chrome.runtime.lastError) { const _ = chrome.runtime.lastError; }
    if (tabs && tabs.length > 0) {
      const existingTab = tabs[0];
      chrome.tabs.update(existingTab.id, { active: true });
      chrome.windows.update(existingTab.windowId, { focused: true });
    } else {
      chrome.tabs.create({ url: DASHBOARD_URL });
    }
  });
});

// ---- Initialize: restore state then check tab ----
restoreState().then(() => {
  checkCurrentTab();
  syncFaceDescriptor();
  if (timerState.isRunning) {
    startKeepalive();
    scheduleFaceVerification();
  }
  console.log('[PowerSight] 🚀 Service worker initialized');
});
