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
  'gmail.com',
  'sap.com',
  'ucc.cit.tum.de',
  'chrome://',
  'chrome-extension://',
  'edge://',
  'coccoc://',
  'brave://',
  'about:',
];

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

function broadcastState() {
  const msg = { type: 'STATE_UPDATE', state: getActiveState() };
  // Send to all content scripts
  chrome.tabs.query({}, (tabs) => {
    if (chrome.runtime.lastError) { const _ = chrome.runtime.lastError; }
    if (!tabs) return;
    tabs.forEach((tab) => {
      if (tab.id) {
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
  // Webapp handles face verification. The extension no longer schedules it independently
  // to prevent camera conflicts and double verification loops.
  clearFaceVerifyTimer();
  return;
}

function triggerFaceVerification() {
  console.log('[PowerSight] 🔔 Triggering face verification!');

  // Pause timer
  pauseTimerForFace();
  faceVerifyState.phase = 'warning';

  // Send FACE_VERIFY_START to all content scripts (active tab gets the modal)
  const msg = { type: 'FACE_VERIFY_START' };
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    if (chrome.runtime.lastError) { const _ = chrome.runtime.lastError; }
    if (tabs && tabs[0] && tabs[0].id) {
      chrome.tabs.sendMessage(tabs[0].id, msg).catch(() => {
        console.warn('[PowerSight] Could not send face verify to active tab');
      });
    }
  });

  // Also show a notification as backup
  chrome.notifications.create('face-verify', {
    type: 'basic',
    iconUrl: 'icons/icon128.png',
    title: '⚠️ Xác minh khuôn mặt',
    message: 'Hệ thống cần xác minh danh tính của bạn. Vui lòng nhìn vào camera.',
    priority: 2,
    requireInteraction: true,
  });

  broadcastState();
}

// ---- URL Monitoring ----
function isUrlAllowed(url) {
  if (!url) return true;
  return ALLOWED_PATTERNS.some((pattern) => url.includes(pattern));
}

function checkCurrentTab() {
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    if (chrome.runtime.lastError) { const _ = chrome.runtime.lastError; }
    if (!tabs || !tabs[0]) return;
    const url = tabs[0].url || '';
    timerState.currentUrl = url;
    const allowed = isUrlAllowed(url);
    timerState.isUrlAllowed = allowed;

    if (!allowed && timerState.isRunning) {
      // Auto-pause and log violation
      pauseTimer(true);
      logViolation('unauthorized_website', 'critical', {
        reason: 'Employee accessed non-allowed website',
        url: url,
      });
      // Show notification
      chrome.notifications.create('violation-url', {
        type: 'basic',
        iconUrl: 'icons/icon128.png',
        title: '⚠️ Vi phạm: Trang web không được phép',
        message: `Bạn đang truy cập trang không nằm trong danh sách cho phép. Timer đã tạm dừng. Quay lại làm việc ngay.`,
        priority: 2,
      });
    } else if (allowed && timerState.isPausedByViolation) {
      // Auto-resume when returning to allowed site
      startTimer();
    }

    broadcastState();
  });
}

// Tab change listeners
chrome.tabs.onActivated.addListener(() => {
  setTimeout(checkCurrentTab, 300);
});
chrome.tabs.onUpdated.addListener((tabId, changeInfo) => {
  if (changeInfo.url || changeInfo.status === 'complete') {
    setTimeout(checkCurrentTab, 300);
  }
});

// ---- Browser/Desktop Focus Detection ----
chrome.windows.onFocusChanged.addListener((windowId) => {
  if (windowId === chrome.windows.WINDOW_ID_NONE) {
    // Browser lost focus — user switched to desktop app
    if (timerState.isRunning) {
      pauseTimer(true);
      logViolation('browser_unfocus', 'critical', {
        reason: 'Employee switched to desktop application',
      });
      chrome.notifications.create('violation-desktop', {
        type: 'basic',
        iconUrl: 'icons/icon128.png',
        title: '⚠️ Vi phạm: Rời khỏi trình duyệt',
        message: 'Hệ thống phát hiện bạn đang sử dụng ứng dụng desktop. Timer đã tạm dừng. Vui lòng quay lại trình duyệt để tiếp tục làm việc.',
        priority: 2,
      });
    }
  } else {
    // Browser regained focus
    if (timerState.isPausedByViolation) {
      checkCurrentTab(); // will auto-resume if on allowed site
    }
  }
});

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
  try {
    await fetch(`${SUPABASE_URL}/rest/v1/work_logs`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': SUPABASE_KEY,
        'Authorization': `Bearer ${SUPABASE_KEY}`,
        'Prefer': 'return=minimal',
      },
      body: JSON.stringify({
        event_type: type,
        severity: severity,
        details: JSON.stringify(details),
        is_fraud: true,
        module: 'Extension',
      }),
    });
  } catch (err) {
    console.error('[PowerSight] Failed to log violation:', err);
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
    case 'GO_HOME':
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
      sendResponse({ ok: true });
      break;
    case 'SWITCH_TAB':
      chrome.tabs.query({ url: msg.pattern }, (tabs) => {
        if (chrome.runtime.lastError) { const _ = chrome.runtime.lastError; }
        if (tabs && tabs.length > 0) {
          const existingTab = tabs[0];
          chrome.tabs.update(existingTab.id, { active: true });
          chrome.windows.update(existingTab.windowId, { focused: true });
        } else {
          chrome.tabs.create({ url: msg.url });
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
  if (timerState.isRunning) {
    startKeepalive();
    scheduleFaceVerification();
  }
  console.log('[PowerSight] 🚀 Service worker initialized');
});
