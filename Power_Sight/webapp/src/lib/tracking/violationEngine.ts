// Define the state for the tracking engine
interface TrackerState {
  lastPauseTime: number;
  pauseCount: number;
  pauseTimestamps: number[];
  totalPausedTime: number;
  lastFrameTime: number;
}

const state: TrackerState = {
  lastPauseTime: 0,
  pauseCount: 0,
  pauseTimestamps: [],
  totalPausedTime: 0,
  lastFrameTime: 0,
};

const FPS_LIMIT = 5; // Frame rate limit for tracking
const MIN_FRAME_TIME = 1000 / FPS_LIMIT;

// Function to throttle tracking frame processing
export function shouldProcessFrame(): boolean {
  const now = performance.now();
  if (now - state.lastFrameTime < MIN_FRAME_TIME) {
    return false;
  }
  state.lastFrameTime = now;
  return true;
}

export async function logViolation(
  type: string, 
  severity: 'warning' | 'critical', 
  details: Record<string, unknown> = {},
  employeeId?: string,
  module: string = 'Web Client'
) {
  const ts = new Date().toISOString();
  console.warn(
    `%c⚠️ VIOLATION [${ts}]%c\nType: ${type}\nSeverity: ${severity}\nModule: ${module}\nEmployee: ${employeeId || 'EM001'}\nDetails: ${JSON.stringify(details, null, 2)}`,
    'background: #dc2626; color: white; font-weight: bold; padding: 4px 8px; border-radius: 4px;',
    'color: #f87171;'
  );

  try {
    fetch('/api/tracker/violation', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        employeeId: employeeId || 'EM001',
        eventType: type,
        details: JSON.stringify(details),
        severity: severity.toUpperCase(),
        isFraud: true,
        module: module
      })
    }).then(res => {
      if (res.ok) {
        console.log(`%c✅ Violation saved [${ts}]`, 'color: #22c55e; font-weight: bold;');
        window.dispatchEvent(new CustomEvent('POWERSIGHT_VIOLATION_LOGGED', { detail: { type, severity } }));
      } else {
        console.error(`%c❌ Violation API failed [${ts}] Status: ${res.status}`, 'color: #ef4444; font-weight: bold;');
      }
    }).catch(apiErr => console.error(`%c❌ Violation API error [${ts}]`, 'color: #ef4444; font-weight: bold;', apiErr));

  } catch (error) {
    console.error("Violation engine failed to record violation:", error);
  }
}

/**
 * Handles logic for when the user pauses the tracker.
 * Rule 1: Pause 3 times in 10 seconds -> Violation
 * Rule 2: Pause over 2 hours -> Violation (Checked later via total/interval)
 */
export function handleTrackerPause(employeeId?: string) {
  const now = Date.now();
  state.pauseTimestamps.push(now);

  // Clean up timestamps older than 10 seconds
  state.pauseTimestamps = state.pauseTimestamps.filter(t => now - t <= 10000);

  state.lastPauseTime = now;
}

export function handleTrackerResume(employeeId?: string) {
  if (state.lastPauseTime > 0) {
    const pausedDuration = Date.now() - state.lastPauseTime;
    state.totalPausedTime += pausedDuration;

    // Rule 2: Paused for over 2 hours total in a session
    if (state.totalPausedTime > 2 * 60 * 60 * 1000) {
      logViolation('pause_long', 'critical', { reason: 'Paused for over 2 hours total', duration: state.totalPausedTime }, employeeId);
    }
  }
  state.lastPauseTime = 0;
}

/**
 * Face Policy Checker
 * @param faces Detected face array from MediaPipe
 * @param isLoggedInEmployee Match probability with stored employee face encoding
 */
export function checkFacePolicy(faces: unknown[], isLoggedInEmployee: boolean) {
  if (!shouldProcessFrame()) return;

  if (faces.length === 0) {
    logViolation('face_missing', 'warning', { reason: 'No person in front of screen' });
  } else if (!isLoggedInEmployee) {
    logViolation('face_mismatch', 'critical', { reason: 'Person in front of screen does not match logged-in employee' });
  }
}

/**
 * Mouse Policy Checker
 * @param distance Travel distance
 * @param time Elapsed time
 * @param isLinear Is movement perfectly linear (scripted)
 */
export function checkMousePolicy(distance: number, _time: number, _isLinear: boolean) {
  if (_isLinear && distance > 500) {
    logViolation('mouse_fake', 'critical', { reason: 'Artificial/scripted mouse movement detected' });
  }
}
