// PowerSight Popup Script
const timerEl = document.getElementById('timer');
const statusText = document.getElementById('status-text');
const dot = document.getElementById('dot');
const btnStart = document.getElementById('btn-start');
const btnPause = document.getElementById('btn-pause');
const btnStop = document.getElementById('btn-stop');
const btnHome = document.getElementById('btn-home');
const violationMsg = document.getElementById('violation-msg');

// Timestamp-based sync anchors — prevents drift
let syncBaseSeconds = 0;
let syncRunSince = 0;
let isRunning = false;
let tickInterval = null;

function formatTime(totalSeconds) {
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function computeCurrentSeconds() {
  if (isRunning && syncRunSince > 0) {
    const elapsed = Math.floor((Date.now() - syncRunSince) / 1000);
    return syncBaseSeconds + elapsed;
  }
  return syncBaseSeconds;
}

function updateUI(state) {
  if (!state) return;

  isRunning = state.isRunning || false;

  // Sync timestamp anchors from background
  if (state.runSince && state.runSince > 0 && state.isRunning) {
    syncRunSince = state.runSince;
    // state.seconds = base + elapsed already computed by background
    syncBaseSeconds = state.seconds - Math.floor((Date.now() - state.runSince) / 1000);
    if (syncBaseSeconds < 0) syncBaseSeconds = 0;
  } else {
    syncBaseSeconds = state.seconds || 0;
    syncRunSince = 0;
  }

  const displaySeconds = computeCurrentSeconds();
  timerEl.textContent = formatTime(displaySeconds);

  // Face verification state
  if (state.faceVerify && state.faceVerify.isPausedForFace) {
    statusText.textContent = 'Xác minh mặt';
    dot.className = 'dot dot-warning';
    btnStart.style.display = 'none';
    btnPause.style.display = 'none';
    violationMsg.style.display = 'none';
  } else if (state.isPausedByViolation) {
    statusText.textContent = 'VI PHẠM';
    dot.className = 'dot dot-danger';
    btnStart.style.display = 'none';
    btnPause.style.display = 'none';
    violationMsg.style.display = 'block';
  } else if (state.isRunning) {
    statusText.textContent = 'Đang hoạt động';
    dot.className = 'dot dot-active';
    btnStart.style.display = 'none';
    btnPause.style.display = 'flex';
    violationMsg.style.display = 'none';
  } else {
    statusText.textContent = displaySeconds > 0 ? 'Tạm dừng' : 'Chưa bắt đầu';
    dot.className = 'dot dot-idle';
    btnStart.style.display = 'flex';
    btnPause.style.display = 'none';
    violationMsg.style.display = 'none';
  }

  // Start/stop local tick for smooth UI between background polls
  if (isRunning && !tickInterval) {
    tickInterval = setInterval(() => {
      timerEl.textContent = formatTime(computeCurrentSeconds());
    }, 1000);
  } else if (!isRunning && tickInterval) {
    clearInterval(tickInterval);
    tickInterval = null;
  }
}

function send(type) {
  try {
    chrome.runtime.sendMessage({ type }, (response) => {
      if (chrome.runtime.lastError) {
        console.warn('[PowerSight] Popup sendMessage error:', chrome.runtime.lastError.message);
        return;
      }
      updateUI(response);
    });
  } catch (e) {
    console.warn('[PowerSight] Popup context error:', e);
  }
}

// Init
send('GET_STATE');

// Poll for state sync every 5s (local ticking handles display between polls)
setInterval(() => send('GET_STATE'), 5000);

btnStart.addEventListener('click', () => send('START'));
btnPause.addEventListener('click', () => send('PAUSE'));
btnStop.addEventListener('click', () => send('STOP'));
btnHome.addEventListener('click', () => send('GO_HOME'));
