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
  'docs.google.com',
  'sheets.google.com',
  'slides.google.com',
  'mail.google.com',
  'gmail.com',
  'accounts.google.com',
  'chrome://',
  'chrome-extension://',
  'edge://',
  'coccoc://',
  'brave://',
  'about:',
];

// Domains that trigger automatic fullscreen enforcement
const PROTECTED_DOMAINS = [
  'google.com',
  'drive.google.com',
  'docs.google.com',
  'mail.google.com',
  'gmail.com',
  'localhost',
];

// ---- Face Verification Config ----
const FACE_VERIFY_MIN_MS = 240_000;  // 4 minutes
const FACE_VERIFY_MAX_MS = 300_000; // 5 minutes
const FACE_VERIFY_RETRY_MS = 60_000; // 1 minute retry on failure
const FACE_VERIFY_INITIAL_DELAY = 180_000; // 3 minutes initial delay

const KEEPALIVE_ALARM = 'powersight-keepalive';
const STORAGE_KEY = 'powersight_timer_state';

let faceVerifyTimer = null;
let faceVerifyState = {
  phase: 'idle', // idle | warning | scanning | success | fail
  isPausedForFace: false,
};

// ---- State ----
let timerState = {
  isRunning: false,
  seconds: 0,
  sessionStart: null,
  isPausedByViolation: false,
  currentUrl: '',
  isUrlAllowed: true,
  runSince: 0,
  employeeId: 'EM001',
  violationsCount: 0,
};

// Presence & Grace period timers
let lastPresenceTimestamp = Date.now();
let unauthorizedUrlTimer = null;
let presenceMonitorInterval = null;

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
      timerState.violationsCount = ts.violationsCount || 0;
      timerState.employeeId = ts.employeeId || 'EM001';
    }

    const fvs = saved.faceVerifyState;
    if (fvs) {
      faceVerifyState.phase = fvs.phase || 'idle';
      faceVerifyState.isPausedForFace = fvs.isPausedForFace || false;
    }
    console.log('[PowerSight] ✅ State restored');
  } catch (e) {
    console.warn('[PowerSight] Failed to restore state:', e);
  }
}

// ---- Presence Monitor ----
function startPresenceMonitor() {
  if (presenceMonitorInterval) clearInterval(presenceMonitorInterval);
  
  presenceMonitorInterval = setInterval(() => {
    if (!timerState.isRunning || timerState.isPausedByViolation) return;

    const now = Date.now();
    const idleTime = now - lastPresenceTimestamp;

    // If no heartbeat from an active allowed tab for > 3 seconds, trigger violation
    if (idleTime > 3500) {
      console.warn(`[PowerSight] ⚠️ No active presence detected for ${Math.round(idleTime/1000)}s`);
      
      // Pause and Broadcast
      pauseTimer(true);
      broadcastState(true);

      // Log Violation
      logViolation('browser_blurred', 'critical', { 
        reason: 'User is not interacting with an allowed browser tab (switching to desktop or disallowed app)',
        idleTimeMs: idleTime
      });

      // Show Notification
      chrome.notifications.create('violation-focus', {
        type: 'basic',
        iconUrl: 'icons/icon128.png',
        title: '⚠️ Vi phạm: Rời khỏi trình duyệt',
        message: 'Bạn đã rời khỏi trình duyệt quá lâu. Tracker đã tạm dừng.',
        priority: 2,
      });
    }
  }, 1000);
}

// ---- Timer Logic ----
function startTimer() {
  if (timerState.isRunning) {
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
  lastPresenceTimestamp = Date.now(); // Reset presence on start
  
  if (!timerState.sessionStart) {
    timerState.sessionStart = new Date().toISOString();
  }
  faceVerifyState.isPausedForFace = false;
  faceVerifyState.phase = 'idle';

  chrome.windows.getCurrent((win) => {
    if (!chrome.runtime.lastError && win) {
      chrome.windows.update(win.id, { state: 'fullscreen' });
    }
  });

  startKeepalive();
  startPresenceMonitor();
  saveState();
  broadcastState();
  scheduleFaceVerification(FACE_VERIFY_INITIAL_DELAY);
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
  
  if (presenceMonitorInterval) {
    clearInterval(presenceMonitorInterval);
    presenceMonitorInterval = null;
  }
  
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
  state.runSince = timerState.runSince;
  return state;
}

function broadcastState(activeTabOnly = false) {
  const msg = { type: 'STATE_UPDATE', state: getActiveState() };
  chrome.tabs.query({}, (tabs) => {
    if (!tabs) return;
    tabs.forEach(tab => {
      if (tab.id) chrome.tabs.sendMessage(tab.id, msg).catch(() => {});
    });
  });
}

// ---- Keepalive ----
function startKeepalive() {
  chrome.alarms.create(KEEPALIVE_ALARM, { periodInMinutes: 0.4 });
}
function stopKeepalive() {
  chrome.alarms.clear(KEEPALIVE_ALARM);
}
chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === KEEPALIVE_ALARM && timerState.isRunning) {
    saveState();
    broadcastState();
  }
});

// ---- Face Verification ----
function randomFaceInterval() {
  return Math.floor(Math.random() * (FACE_VERIFY_MAX_MS - FACE_VERIFY_MIN_MS + 1)) + FACE_VERIFY_MIN_MS;
}
function clearFaceVerifyTimer() {
  if (faceVerifyTimer) { clearTimeout(faceVerifyTimer); faceVerifyTimer = null; }
}
function scheduleFaceVerification(delayMs) {
  clearFaceVerifyTimer();
  if (!timerState.isRunning) return;
  const delay = delayMs || randomFaceInterval();
  faceVerifyTimer = setTimeout(triggerFaceVerification, delay);
}
function triggerFaceVerification() {
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    if (tabs && tabs[0]) {
      const url = tabs[0].url || '';
      if (url.includes('/login') || url.includes('/auth')) {
        scheduleFaceVerification(30000);
        return;
      }
    }
    pauseTimerForFace();
    faceVerifyState.phase = 'warning';
    if (tabs && tabs[0] && tabs[0].id) {
      chrome.tabs.sendMessage(tabs[0].id, { type: 'FACE_VERIFY_START' }).catch(() => {});
    }
    broadcastState();
  });
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
function resumeTimerAfterFace(isRetry = false) {
  faceVerifyState.isPausedForFace = false;
  faceVerifyState.phase = 'idle';
  timerState.isRunning = true;
  timerState.runSince = Date.now();
  lastPresenceTimestamp = Date.now(); // Reset presence on resume
  saveState();
  broadcastState();
  scheduleFaceVerification(isRetry ? FACE_VERIFY_RETRY_MS : null);
}

// ---- URL Monitoring ----
function isUrlAllowed(url) {
  if (!url) return true;
  return ALLOWED_PATTERNS.some(p => url.includes(p));
}
function checkCurrentTab(providedTab = null) {
  const processTab = (tab) => {
    if (!tab) return;
    const url = tab.url || '';
    timerState.currentUrl = url;
    const allowed = isUrlAllowed(url);
    timerState.isUrlAllowed = allowed;

    if (!allowed && timerState.isRunning && !timerState.isPausedByViolation) {
      if (!unauthorizedUrlTimer) {
        unauthorizedUrlTimer = setTimeout(() => {
          chrome.notifications.create('violation-url', {
            type: 'basic', iconUrl: 'icons/icon128.png',
            title: '⚠️ Vi phạm: Trang web không được phép',
            message: 'Bạn đã truy cập trang không cho phép quá 2 giây.',
            priority: 2,
          });
          pauseTimer(true);
          broadcastState(true);
          logViolation('unauthorized_website', 'critical', { url });
          unauthorizedUrlTimer = null;
        }, 2000);
      }
    } else {
      if (unauthorizedUrlTimer) { clearTimeout(unauthorizedUrlTimer); unauthorizedUrlTimer = null; }
      if (allowed && timerState.isPausedByViolation) {
        // If they returned to allowed URL, we might want to auto-resume,
        // but it's safer to wait for focus/presence or manual resume.
        // For now, we'll auto-resume if they were paused specifically by URL violation.
        startTimer();
      } else {
        broadcastState(true);
      }
    }
  };
  if (providedTab) processTab(providedTab);
  else chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => { if (tabs && tabs[0]) processTab(tabs[0]); });
}
chrome.tabs.onActivated.addListener(() => setTimeout(checkCurrentTab, 250));
chrome.tabs.onUpdated.addListener((id, change, tab) => { if (change.url || change.status === 'complete') checkCurrentTab(tab); });

// ---- Violation Logging ----
async function logViolation(type, severity, details) {
  const now = new Date();
  const ts = now.toISOString();
  
  // Terminal log
  fetch(`${DASHBOARD_URL}/api/log`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ type, severity, details, timestamp: ts })
  }).catch(() => {});

  // Supabase log
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
        year: now.getFullYear(), month: now.getMonth() + 1,
        event_type: type, severity, details: JSON.stringify(details),
        is_fraud: 1, module: 'Extension', timestamp: ts
      }),
    });
  } catch (err) {}
  
  timerState.violationsCount = (timerState.violationsCount || 0) + 1;
  saveState();
  broadcastState();
}

// ---- Message Handler ----
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  switch (msg.type) {
    case 'PRESENCE_HEARTBEAT':
      if (isUrlAllowed(msg.url)) {
        lastPresenceTimestamp = Date.now();
        if (timerState.isPausedByViolation && timerState.isUrlAllowed) {
           startTimer();
        }
      }
      break;
    case 'GET_STATE': sendResponse(getActiveState()); break;
    case 'START': startTimer(); sendResponse(getActiveState()); break;
    case 'PAUSE': pauseTimer(false); sendResponse(getActiveState()); break;
    case 'STOP': stopTimer(); sendResponse(getActiveState()); break;
    case 'RESET':
      stopTimer();
      timerState.seconds = 0; timerState.violationsCount = 0; timerState.sessionStart = null;
      saveState(); broadcastState(); sendResponse(getActiveState());
      break;
    case 'SET_CONFIG':
      if (msg.config) {
        if (msg.config.employeeId) timerState.employeeId = msg.config.employeeId;
        saveState();
      }
      sendResponse({ ok: true });
      break;
    case 'GO_HOME':
      chrome.tabs.query({ url: '*://localhost/*' }, (tabs) => {
        if (tabs && tabs.length > 0) {
          chrome.tabs.update(tabs[0].id, { active: true });
          chrome.windows.update(tabs[0].windowId, { focused: true, state: 'fullscreen' });
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
        if (tabs && tabs.length > 0) {
          chrome.tabs.update(tabs[0].id, { url: msg.url, active: true });
          chrome.windows.update(tabs[0].windowId, { focused: true, state: 'fullscreen' });
        } else {
          chrome.tabs.create({ url: msg.url }, (tab) => {
            chrome.windows.update(tab.windowId, { state: 'fullscreen' });
          });
        }
      });
      sendResponse({ ok: true });
      break;
    case 'VIOLATION': logViolation(msg.violationType || msg.type, msg.severity || 'warning', msg.details || {}); break;
    case 'MOUSE_VIOLATION':
      if (timerState.isRunning) {
        pauseTimer(true);
        logViolation('mouse_fake', 'critical', { reason: msg.reason, metrics: msg.metrics });
      }
      break;
    case 'FACE_VERIFY_RESULT':
      if (msg.result && msg.result.match) {
        faceVerifyState.phase = 'success';
        broadcastState();
        setTimeout(() => resumeTimerAfterFace(false), 2000);
      } else {
        faceVerifyState.phase = 'fail';
        broadcastState();
        logViolation('face_mismatch', 'critical', { reason: 'Face verification failed', distance: msg.result ? msg.result.distance : 999 });
        setTimeout(() => resumeTimerAfterFace(true), 3000);
      }
      break;
    case 'FACE_VERIFY_TRIGGER':
      if (timerState.isRunning) triggerFaceVerification();
      sendResponse({ ok: true });
      break;
    case 'FORCE_FULLSCREEN':
      chrome.windows.getCurrent((win) => {
        if (win) chrome.windows.update(win.id, { state: 'fullscreen' });
      });
      sendResponse({ ok: true });
      break;
  }
  return true;
});

// ---- Initialize ----
restoreState().then(() => {
  checkCurrentTab();
  if (timerState.isRunning) {
    startKeepalive();
    startPresenceMonitor();
    scheduleFaceVerification();
  }
  console.log('[PowerSight] 🚀 Service worker initialized with Presence Heartbeat');
});
