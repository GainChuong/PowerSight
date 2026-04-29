// ============================================================
// PowerSight Tracker — Content Script
// Injects floating tracker bar + face verification modal
// ============================================================

(function () {
  // Don't inject on extension pages
  if (window.location.protocol === 'chrome-extension:' || window.location.protocol === 'chrome:') return;

  const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';

  // ============================================================
  // SECTION 1: Tracker Bar (only if NOT on localhost)
  // ============================================================
  let bar = null;

  if (!isLocalhost) {
    bar = document.createElement('div');
    bar.id = 'powersight-tracker-bar';
    bar.innerHTML = `
      <div class="ps-bar-inner">
        <div class="ps-logo">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#3b82f6" stroke-width="2">
            <circle cx="12" cy="12" r="10"/>
            <circle cx="12" cy="12" r="3"/>
            <line x1="12" y1="2" x2="12" y2="5"/>
            <line x1="12" y1="19" x2="12" y2="22"/>
            <line x1="2" y1="12" x2="5" y2="12"/>
            <line x1="19" y1="12" x2="22" y2="12"/>
          </svg>
          <span class="ps-brand">PowerSight</span>
        </div>

        <div class="ps-status" id="ps-status">
          <span class="ps-dot" id="ps-dot"></span>
          <span id="ps-status-text">Đang tải...</span>
        </div>

        <div class="ps-timer" id="ps-timer">00:00:00</div>

        <div class="ps-controls">
          <button id="ps-btn-start" class="ps-btn ps-btn-start" title="Bắt đầu">▶</button>
          <button id="ps-btn-pause" class="ps-btn ps-btn-pause" title="Tạm dừng" style="display:none">⏸</button>
          <button id="ps-btn-stop" class="ps-btn ps-btn-stop" title="Kết thúc">⏹</button>
        </div>

        <div class="ps-dropdown-container">
          <button id="ps-btn-apps" class="ps-btn ps-btn-apps" title="Ứng dụng nhanh">
            🚀 Ứng dụng <span class="ps-chevron">▼</span>
          </button>
          <div id="ps-apps-menu" class="ps-dropdown-menu">
            <button id="ps-btn-gmail" class="ps-dropdown-item">
              <span class="ps-item-icon">📧</span> Gmail
            </button>
            <button id="ps-btn-sap" class="ps-dropdown-item">
              <span class="ps-item-icon">📊</span> SAP System
            </button>
          </div>
        </div>

        <button id="ps-btn-home" class="ps-btn ps-btn-home" title="Quay về Dashboard">
          🏠 Dashboard
        </button>
        
        <button id="ps-btn-toggle" class="ps-btn-toggle" title="Ẩn/Hiện">🔽</button>
      </div>
    `;

    document.documentElement.appendChild(bar);
    document.documentElement.style.setProperty('--ps-bar-height', '44px');
    document.body.style.marginTop = '44px';
  }

  // ---- DOM References ----
  const timerEl = document.getElementById('ps-timer');
  const statusText = document.getElementById('ps-status-text');
  const statusDot = document.getElementById('ps-dot');
  const btnStart = document.getElementById('ps-btn-start');
  const btnPause = document.getElementById('ps-btn-pause');
  const btnStop = document.getElementById('ps-btn-stop');
  const btnHome = document.getElementById('ps-btn-home');
  const btnToggle = document.getElementById('ps-btn-toggle');

  let isMinimized = false;

  const isSafeDomain = isLocalhost ||
    window.location.hostname.includes('google.com') ||
    window.location.hostname.includes('sap.com') ||
    window.location.hostname.includes('gmail.com');

  function formatTime(totalSeconds) {
    const h = Math.floor(totalSeconds / 3600);
    const m = Math.floor((totalSeconds % 3600) / 60);
    const s = totalSeconds % 60;
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  }

  // ---- Update UI from State ----
  let localTimerInterval = null;
  let localState = null;

  // Timestamp-based sync: store the base values received from background
  // so local ticking computes elapsed time from timestamps, not incrementing.
  let syncBaseSeconds = 0;   // background's accumulated seconds at sync time
  let syncRunSince = 0;      // background's runSince timestamp

  function computeCurrentSeconds() {
    if (localState && localState.isRunning && syncRunSince > 0) {
      const elapsed = Math.floor((Date.now() - syncRunSince) / 1000);
      return syncBaseSeconds + elapsed;
    }
    return syncBaseSeconds;
  }

  function updateUI(state) {
    if (!state) return;
    localState = { ...state };

    // Sync timestamp anchors from background
    // state.seconds already includes elapsed from background's getActiveState()
    // state.runSince is the raw wallclock timestamp when the current segment started
    if (state.runSince && state.runSince > 0 && state.isRunning) {
      // background sent computed seconds = base + elapsed. We want just the base.
      syncRunSince = state.runSince;
      syncBaseSeconds = state.seconds - Math.floor((Date.now() - state.runSince) / 1000);
      if (syncBaseSeconds < 0) syncBaseSeconds = 0;
    } else {
      // Paused / stopped — seconds is the final value
      syncBaseSeconds = state.seconds || 0;
      syncRunSince = 0;
    }

    const displaySeconds = computeCurrentSeconds();

    if (bar) {
      timerEl.textContent = formatTime(displaySeconds);

      // Check if paused for face verification
      if (localState.faceVerify && localState.faceVerify.isPausedForFace) {
        statusText.textContent = 'Xác minh mặt';
        statusDot.className = 'ps-dot ps-dot-warning';
        btnStart.style.display = 'none';
        btnPause.style.display = 'none';
      } else if (localState.isPausedByViolation) {
        statusText.textContent = localState.isUrlAllowed === false ? 'SAI TRANG WEB' : 'VI PHẠM AFK/DESKTOP';
        statusDot.className = 'ps-dot ps-dot-danger';
        btnStart.style.display = 'none';
        btnPause.style.display = 'none';

        if (isMinimized) {
          isMinimized = false;
          bar.classList.remove('ps-minimized');
          btnToggle.textContent = '🔽';
        }
      } else if (localState.isRunning) {
        statusText.textContent = 'Đang hoạt động';
        statusDot.className = 'ps-dot ps-dot-active';
        btnStart.style.display = 'none';
        btnPause.style.display = 'inline-flex';
      } else {
        statusText.textContent = displaySeconds > 0 ? 'Tạm dừng' : 'Chưa bắt đầu';
        statusDot.className = 'ps-dot ps-dot-idle';
        btnStart.style.display = 'inline-flex';
        btnPause.style.display = 'none';
      }
    }

    // Always post message to window so the webapp can sync
    const stateForWebapp = { ...localState, seconds: displaySeconds };
    window.postMessage({ type: 'POWERSIGHT_STATE_UPDATE', state: stateForWebapp }, '*');

    // Manage local UI ticking — uses timestamp-based computation, no drift
    if (localState.isRunning && !localTimerInterval) {
      localTimerInterval = setInterval(() => {
        const currentSeconds = computeCurrentSeconds();
        if (bar) timerEl.textContent = formatTime(currentSeconds);
        window.postMessage({
          type: 'POWERSIGHT_STATE_UPDATE',
          state: { ...localState, seconds: currentSeconds },
        }, '*');
      }, 1000);
    } else if (!localState.isRunning && localTimerInterval) {
      clearInterval(localTimerInterval);
      localTimerInterval = null;
    }
  }

  // ---- Extension Context Guard ----
  function isContextValid() {
    try {
      return !!(chrome && chrome.runtime && chrome.runtime.id);
    } catch {
      return false;
    }
  }

  function teardown() {
    // Clean up intervals and listeners when extension context is dead
    if (localTimerInterval) {
      clearInterval(localTimerInterval);
      localTimerInterval = null;
    }
    console.warn('[PowerSight] Extension context invalidated — content script deactivated.');
  }

  // ---- Communication with Background ----
  function sendMessage(type, data) {
    if (!isContextValid()) { teardown(); return; }
    try {
      chrome.runtime.sendMessage({ type, ...data }, (response) => {
        if (chrome.runtime.lastError) {
          // Silently handle — context may have just died
          console.warn('[PowerSight] sendMessage error:', chrome.runtime.lastError.message);
          return;
        }
        if (response) updateUI(response);
      });
    } catch (e) {
      // "Extension context invalidated" throws synchronously in some cases
      teardown();
    }
  }

  sendMessage('GET_STATE');

  if (isContextValid()) {
    try {
      chrome.runtime.onMessage.addListener((msg) => {
        if (!isContextValid()) { teardown(); return; }
        if (msg.type === 'STATE_UPDATE') {
          updateUI(msg.state);
        }
        if (msg.type === 'FACE_VERIFY_START') {
          showFaceVerificationModal();
        }
      });
    } catch (e) {
      teardown();
    }
  }

  window.addEventListener('message', (event) => {
    if (event.data && event.data.type === 'POWERSIGHT_COMMAND') {
      sendMessage(event.data.command);
    }
  });

  // ---- Button Handlers ----
  if (bar) {
    btnStart.addEventListener('click', () => sendMessage('START'));
    btnPause.addEventListener('click', () => sendMessage('PAUSE'));
    btnStop.addEventListener('click', () => sendMessage('STOP'));
    btnHome.addEventListener('click', () => sendMessage('GO_HOME'));
    
    const appsBtn = document.getElementById('ps-btn-apps');
    const appsMenu = document.getElementById('ps-apps-menu');
    
    if (appsBtn && appsMenu) {
      appsBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        appsMenu.classList.toggle('ps-show');
      });
      
      document.addEventListener('click', () => {
        appsMenu.classList.remove('ps-show');
      });
    }
    
    document.getElementById('ps-btn-gmail').addEventListener('click', () => {
      appsMenu.classList.remove('ps-show');
      sendMessage('SWITCH_TAB', { url: 'https://mail.google.com', pattern: '*://mail.google.com/*' });
    });
    
    document.getElementById('ps-btn-sap').addEventListener('click', () => {
      appsMenu.classList.remove('ps-show');
      sendMessage('SWITCH_TAB', { url: 'https://ucc.cit.tum.de', pattern: '*://ucc.cit.tum.de/*' });
    });

    btnToggle.addEventListener('click', () => {
      isMinimized = !isMinimized;
      if (isMinimized) {
        bar.classList.add('ps-minimized');
        btnToggle.textContent = '▶';
        document.body.style.marginTop = '0';
      } else {
        bar.classList.remove('ps-minimized');
        btnToggle.textContent = '🔽';
        document.body.style.marginTop = '44px';
      }
    });
  }

  // ============================================================
  // SECTION 2: Face Verification Modal
  // ============================================================
  
  const FACE_STORAGE_KEY = 'powerSight_faceDescriptor';
  const WARNING_SECONDS = 5;
  const MATCH_THRESHOLD = 0.6;

  let faceModal = null;
  let faceStream = null;

  function getStoredFaceDescriptor() {
    try {
      const raw = localStorage.getItem(FACE_STORAGE_KEY);
      if (!raw) return null;
      return JSON.parse(raw);
    } catch { return null; }
  }

  function showFaceVerificationModal() {
    // Don't show if already showing
    if (faceModal) return;

    const storedFace = getStoredFaceDescriptor();
    if (!storedFace) {
      console.warn('[PowerSight] No face registered, skipping verification');
      // Auto-pass if no face registered
      sendMessage('FACE_VERIFY_RESULT', { result: { match: true, distance: 0 } });
      return;
    }

    // Create full-screen modal overlay
    faceModal = document.createElement('div');
    faceModal.id = 'powersight-face-modal';
    faceModal.innerHTML = `
      <div class="psf-backdrop">
        <div class="psf-card">
          <div id="psf-warning-phase">
            <div class="psf-icon psf-icon-warning">⚠️</div>
            <h2 class="psf-title psf-title-warning">Xác minh khuôn mặt</h2>
            <p class="psf-desc">
              Hệ thống sẽ quét khuôn mặt của bạn để xác minh danh tính.<br>
              Vui lòng nhìn thẳng vào camera.
            </p>
            <div id="psf-countdown" class="psf-countdown">${WARNING_SECONDS}</div>
            <p class="psf-paused">⏸ Timer đã tạm dừng</p>
          </div>

          <div id="psf-scanning-phase" style="display:none">
            <div class="psf-video-container">
              <video id="psf-video" autoplay muted playsinline></video>
              <div class="psf-scan-line"></div>
              <div class="psf-video-overlay"></div>
            </div>
            <h2 class="psf-title psf-title-scanning">Đang quét khuôn mặt...</h2>
            <p class="psf-desc">Vui lòng giữ khuôn mặt ở giữa khung hình</p>
          </div>

          <div id="psf-success-phase" style="display:none">
            <div class="psf-icon psf-icon-success">✅</div>
            <h2 class="psf-title psf-title-success">Xác minh thành công!</h2>
            <p class="psf-desc">Danh tính đã được xác nhận. Timer sẽ tiếp tục...</p>
            <p id="psf-success-score" class="psf-score"></p>
          </div>

          <div id="psf-fail-phase" style="display:none">
            <div class="psf-icon psf-icon-fail">❌</div>
            <h2 class="psf-title psf-title-fail">Xác minh thất bại!</h2>
            <p class="psf-desc">
              Không thể xác nhận danh tính. Timer vẫn tạm dừng.<br>
              Hệ thống sẽ quét lại sau <strong style="color:#ef4444">1 phút</strong>.
            </p>
            <p id="psf-fail-score" class="psf-score"></p>
          </div>
        </div>
      </div>
    `;

    document.documentElement.appendChild(faceModal);

    // Start warning countdown
    let countdown = WARNING_SECONDS;
    const countdownEl = document.getElementById('psf-countdown');
    const countdownInterval = setInterval(() => {
      countdown -= 1;
      if (countdownEl) countdownEl.textContent = countdown;
      if (countdown <= 0) {
        clearInterval(countdownInterval);
        startFaceScanning();
      }
    }, 1000);
  }

  async function startFaceScanning() {
    const warningPhase = document.getElementById('psf-warning-phase');
    const scanningPhase = document.getElementById('psf-scanning-phase');
    const videoEl = document.getElementById('psf-video');
    
    if (warningPhase) warningPhase.style.display = 'none';
    if (scanningPhase) scanningPhase.style.display = 'block';

    try {
      // Get camera stream
      faceStream = await navigator.mediaDevices.getUserMedia({
        video: { width: 640, height: 480, facingMode: 'user' }
      });
      if (videoEl) {
        videoEl.srcObject = faceStream;
        await videoEl.play();
      }

      // Wait for camera to stabilize
      await new Promise(r => setTimeout(r, 2000));

      // Capture and compare
      const result = await captureAndCompare(videoEl);
      
      // Stop camera
      stopFaceStream();
      
      // Show result
      showFaceResult(result);
      
      // Report to background
      sendMessage('FACE_VERIFY_RESULT', { result });
      
    } catch (err) {
      console.error('[PowerSight] Camera error:', err);
      stopFaceStream();
      const failResult = { match: false, distance: 999 };
      showFaceResult(failResult);
      sendMessage('FACE_VERIFY_RESULT', { result: failResult });
    }
  }

  async function captureAndCompare(videoEl) {
    if (!videoEl) return { match: false, distance: 999 };
    
    const storedDescriptorArray = getStoredFaceDescriptor();
    if (!storedDescriptorArray) return { match: true, distance: 0 };

    // Capture current frame to canvas and extract pixel data for comparison
    const canvas = document.createElement('canvas');
    canvas.width = videoEl.videoWidth || 640;
    canvas.height = videoEl.videoHeight || 480;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(videoEl, 0, 0, canvas.width, canvas.height);

    // Try using face-api.js if available via the webapp
    // The webapp loads face-api models, so if we're on localhost, we can use them
    // For other sites, we'll use a canvas-based brightness comparison as a lightweight fallback

    try {
      // Try to dynamically load face-api from the webapp
      const faceapi = await loadFaceApiFromWebapp();
      if (faceapi) {
        const detection = await faceapi
          .detectSingleFace(canvas, new faceapi.SsdMobilenetv1Options({ minConfidence: 0.5 }))
          .withFaceLandmarks()
          .withFaceDescriptor();

        if (detection) {
          const currentDescriptor = detection.descriptor;
          const storedDescriptor = new Float32Array(storedDescriptorArray);
          
          // Euclidean distance comparison
          let sum = 0;
          for (let i = 0; i < storedDescriptor.length; i++) {
            const diff = storedDescriptor[i] - currentDescriptor[i];
            sum += diff * diff;
          }
          const distance = Math.sqrt(sum);
          return {
            match: distance < MATCH_THRESHOLD,
            distance: Math.round(distance * 100) / 100,
          };
        }
      }
    } catch (e) {
      console.warn('[PowerSight] face-api.js not available, using fallback', e);
    }

    // Fallback: Basic face detection using canvas pixel analysis
    // This checks if there's a face-like region in the center of the frame
    const imageData = ctx.getImageData(
      canvas.width * 0.25, canvas.height * 0.1,
      canvas.width * 0.5, canvas.height * 0.8
    );
    const pixels = imageData.data;
    
    // Compute average skin-tone presence and brightness
    let skinPixels = 0;
    let totalPixels = pixels.length / 4;
    
    for (let i = 0; i < pixels.length; i += 4) {
      const r = pixels[i], g = pixels[i + 1], b = pixels[i + 2];
      // Simple skin color detection (works for various skin tones)
      if (r > 60 && g > 40 && b > 20 && r > g && (r - g) > 10 && r < 255 && g < 240) {
        skinPixels++;
      }
    }
    
    const skinRatio = skinPixels / totalPixels;
    // If at least 15% of center region has skin-like pixels, consider it a face present
    const hasFace = skinRatio > 0.15;
    
    return {
      match: hasFace,
      distance: hasFace ? Math.round((1 - skinRatio) * 100) / 100 : 0.99,
    };
  }

  // Try to load face-api.js from the webapp's served modules
  let faceApiInstance = null;
  let faceApiLoadAttempted = false;

  async function loadFaceApiFromWebapp() {
    if (faceApiInstance) return faceApiInstance;
    if (faceApiLoadAttempted) return null;
    faceApiLoadAttempted = true;

    try {
      // The webapp serves models at /models/ — try loading face-api from CDN
      const script = document.createElement('script');
      script.src = 'https://cdn.jsdelivr.net/npm/@vladmandic/face-api@1.7.15/dist/face-api.js';
      
      await new Promise((resolve, reject) => {
        script.onload = resolve;
        script.onerror = reject;
        document.head.appendChild(script);
      });

      // face-api.js sets window.faceapi
      if (window.faceapi) {
        faceApiInstance = window.faceapi;
        // Load models from webapp's public folder or CDN
        const modelUrl = isLocalhost 
          ? '/models' 
          : 'https://cdn.jsdelivr.net/npm/@vladmandic/face-api@1.7.15/model';
        
        await Promise.all([
          faceApiInstance.nets.ssdMobilenetv1.loadFromUri(modelUrl),
          faceApiInstance.nets.faceLandmark68Net.loadFromUri(modelUrl),
          faceApiInstance.nets.faceRecognitionNet.loadFromUri(modelUrl),
        ]);
        
        console.log('[PowerSight] ✅ face-api.js loaded from CDN');
        return faceApiInstance;
      }
    } catch (err) {
      console.warn('[PowerSight] Could not load face-api.js:', err);
    }
    return null;
  }

  function showFaceResult(result) {
    const scanningPhase = document.getElementById('psf-scanning-phase');
    const successPhase = document.getElementById('psf-success-phase');
    const failPhase = document.getElementById('psf-fail-phase');
    
    if (scanningPhase) scanningPhase.style.display = 'none';

    if (result.match) {
      if (successPhase) successPhase.style.display = 'block';
      const scoreEl = document.getElementById('psf-success-score');
      if (scoreEl) {
        scoreEl.textContent = `Độ tương đồng: ${Math.max(0, Math.round((1 - result.distance) * 100))}%`;
      }
      // Auto-dismiss after 2 seconds
      setTimeout(dismissFaceModal, 2000);
    } else {
      if (failPhase) failPhase.style.display = 'block';
      const scoreEl = document.getElementById('psf-fail-score');
      if (scoreEl && result.distance < 999) {
        scoreEl.textContent = `Độ tương đồng: ${Math.max(0, Math.round((1 - result.distance) * 100))}%`;
      }
      // Dismiss after 3 seconds (but timer stays paused)
      setTimeout(dismissFaceModal, 3000);
    }
  }

  function stopFaceStream() {
    if (faceStream) {
      faceStream.getTracks().forEach(t => t.stop());
      faceStream = null;
    }
  }

  function dismissFaceModal() {
    stopFaceStream();
    if (faceModal) {
      faceModal.remove();
      faceModal = null;
    }
  }

  // ============================================================
  // SECTION 3: Mouse Tracker (Anti-Fake)
  // ============================================================
  let mouseEvents = [];
  let lastMouseEventTime = 0;
  let mouseProcessor = null;
  let xgbRunner = null;
  
  // Sliding window to hold the last 12 evaluation results (1 minute)
  const MAX_HISTORY = 12; 
  let anomalyHistory = [];

  async function initMouseTracker() {
    if (!window.PowerSightRealTimeProcessor || !window.PowerSightXGBoostRunner) return;
    
    mouseProcessor = new window.PowerSightRealTimeProcessor();
    xgbRunner = new window.PowerSightXGBoostRunner();
    
    // Asynchronously load the JSON model dumped from PKL
    await xgbRunner.loadModel();
    
    window.addEventListener('mousemove', (e) => {
      // Only track if timer is running and we are on an allowed domain
      if (!localState || !localState.isRunning) return;

      const now = Date.now();
      // Throttle to ~10 FPS (100ms)
      if (now - lastMouseEventTime < 100) return;
      lastMouseEventTime = now;

      mouseEvents.push({
        x: e.clientX,
        y: e.clientY,
        timestamp: now
      });
    });

    // Evaluate metrics every 5 seconds using AI Model
    setInterval(() => {
      if (!localState || !localState.isRunning || !mouseProcessor || !xgbRunner.isReady) return;
      if (mouseEvents.length < 5) {
        mouseEvents = []; // Too few events, ignore
        return;
      }

      const metrics = mouseProcessor.calculateAllMetrics(mouseEvents);
      mouseEvents = []; // Reset for next window

      // Map metrics to the feature names expected by the XGBoost model
      const features = {
        'Velocity': metrics.velocity_ui || 0,
        'Acceleration': metrics.acceleration_ui || 0,
        'XFlips': metrics.x_flips_ui || 0,
        'YFlips': metrics.y_flips_ui || 0,
        'TotalDistance': metrics.distance_ui || 0,
        'MovementTimeSpan': metrics.movement_time_span_ui || 0,
        'XVelocity': metrics.x_axis_velocity_ui || 0,
        'YVelocity': metrics.y_axis_velocity_ui || 0,
        'XAxisDistance': metrics.x_axis_distance_ui || 0,
        'YAxisDistance': metrics.y_axis_distance_ui || 0
      };

      // Ensure TotalDistance is high enough to be considered a real session
      if (features.TotalDistance > 10) {
        const anomalyProbability = xgbRunner.predict(features);
        
        // Threshold for Binary Classification (0.5)
        const isAnomaly = anomalyProbability > 0.5;
        anomalyHistory.push(isAnomaly);
        
        // Keep only the last 12 evaluations (1 minute total)
        if (anomalyHistory.length > MAX_HISTORY) {
          anomalyHistory.shift();
        }

        const anomalyCount = anomalyHistory.filter(Boolean).length;
        console.log(`[PowerSight] Mouse evaluated. Anomaly Probability: ${(anomalyProbability * 100).toFixed(1)}%. Window Score: ${anomalyCount}/${anomalyHistory.length}`);

        // Trigger violation if at least 6 anomaly periods (30 seconds of fake mouse) are detected
        if (anomalyCount >= 6) {
          console.warn('[PowerSight] Sustained XGBoost Anomaly detected!', features);
          sendMessage('MOUSE_VIOLATION', { 
            reason: `Phát hiện hành vi chuột tự động (${anomalyCount}/${MAX_HISTORY} chu kỳ vi phạm)`, 
            metrics: features 
          });
          
          // Reset history to prevent back-to-back immediate triggers when user resumes
          anomalyHistory = [];
        }
      }
    }, 5000);
  }

  // Initialize after a short delay to ensure scripts are loaded
  setTimeout(initMouseTracker, 1000);

})();
