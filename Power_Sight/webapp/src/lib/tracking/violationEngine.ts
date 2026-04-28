import { supabase } from '@/lib/supabase';

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

export async function logViolation(type: string, severity: 'warning' | 'critical', details: Record<string, unknown> = {}) {
  console.warn(`[VIOLATION ENFORCED] Type: ${type}, Severity: ${severity}`, details);
  try {
    const { error } = await supabase.from('work_logs').insert([{
      event_type: type,
      severity: severity,
      details: JSON.stringify(details),
      is_fraud: true,
      module: 'Face/Mouse' // Default module or could be passed in
    }]);
    
    if (error) {
      console.error("Supabase insert error:", error);
    } else {
      console.log(`✅ Violation saved to DB: ${type}`);
    }
  } catch (error) {
    console.error("Violation engine failed to write to DB:", error);
  }
}

/**
 * Handles logic for when the user pauses the tracker.
 * Rule 1: Pause 3 times in 10 seconds -> Violation
 * Rule 2: Pause over 2 hours -> Violation (Checked later via total/interval)
 */
export function handleTrackerPause() {
  const now = Date.now();
  state.pauseTimestamps.push(now);

  // Clean up timestamps older than 10 seconds
  state.pauseTimestamps = state.pauseTimestamps.filter(t => now - t <= 10000);

  if (state.pauseTimestamps.length >= 3) {
    logViolation('pause_frequent', 'critical', { reason: 'Paused 3 times within 10 seconds' });
    // Reset to avoid spamming
    state.pauseTimestamps = [];
  }

  state.lastPauseTime = now;
}

export function handleTrackerResume() {
  if (state.lastPauseTime > 0) {
    const pausedDuration = Date.now() - state.lastPauseTime;
    state.totalPausedTime += pausedDuration;

    // Rule 2: Paused for over 2 hours total in a session
    if (state.totalPausedTime > 2 * 60 * 60 * 1000) {
      logViolation('pause_long', 'critical', { reason: 'Paused for over 2 hours total', duration: state.totalPausedTime });
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
export function checkMousePolicy(distance: number, time: number, isLinear: boolean) {
  // If mouse is moving in perfectly linear lines repeatedly or impossibly fast
  if (isLinear && distance > 100) {
    logViolation('mouse_fake', 'critical', { reason: 'Artificial/scripted mouse movement detected' });
  }
}
