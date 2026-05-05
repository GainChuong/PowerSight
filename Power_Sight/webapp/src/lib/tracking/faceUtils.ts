/**
 * Face Recognition Utilities
 * Uses @vladmandic/face-api for real browser-based face detection,
 * landmark extraction, and face descriptor comparison.
 */

let faceapi: typeof import('@vladmandic/face-api') | null = null;
let modelsLoaded = false;
let loadingPromise: Promise<void> | null = null;

const FACE_STORAGE_KEY = 'powerSight_faceDescriptor';
const MATCH_THRESHOLD = 0.6; // Euclidean distance threshold — lower = stricter

export async function loadFaceApi(): Promise<typeof import('@vladmandic/face-api')> {
  if (faceapi && modelsLoaded) return faceapi;

  if (loadingPromise) {
    await loadingPromise;
    return faceapi!;
  }

  loadingPromise = (async () => {
    faceapi = await import('@vladmandic/face-api');

    await Promise.all([
      faceapi.nets.ssdMobilenetv1.loadFromUri('/models'),
      faceapi.nets.faceLandmark68Net.loadFromUri('/models'),
      faceapi.nets.faceRecognitionNet.loadFromUri('/models'),
    ]);

    modelsLoaded = true;
  })();

  await loadingPromise;
  return faceapi!;
}

export function isModelsLoaded(): boolean {
  return modelsLoaded;
}

/**
 * Creates a video stream from the user's webcam.
 */
export async function startWebcam(videoElement: HTMLVideoElement): Promise<MediaStream> {
  const stream = await navigator.mediaDevices.getUserMedia({
    video: { width: 640, height: 480, facingMode: 'user' },
  });
  videoElement.srcObject = stream;
  await videoElement.play();
  return stream;
}

/**
 * Stops all tracks on the given stream.
 */
export function stopWebcam(stream: MediaStream | null) {
  if (stream) {
    stream.getTracks().forEach(track => track.stop());
  }
}

/**
 * Detects a single face in the video element and returns its 128-dimensional descriptor.
 * Returns null if no face is detected.
 */
export async function detectFaceDescriptor(
  videoElement: HTMLVideoElement
): Promise<Float32Array | null> {
  const api = await loadFaceApi();

  const detection = await api
    .detectSingleFace(videoElement, new api.SsdMobilenetv1Options({ minConfidence: 0.5 }))
    .withFaceLandmarks()
    .withFaceDescriptor();

  if (!detection) return null;
  return detection.descriptor;
}

/**
 * Stores the face descriptor (deprecated: use Supabase + Context)
 */
export function storeRegisteredFace(descriptor: Float32Array) {
  // Logic moved to Supabase API and memory context
}

/**
 * Retrieves the stored face descriptor (deprecated: use Supabase + Context)
 */
export function getStoredFace(): Float32Array | null {
  return null;
}

/**
 * Checks if a face has been registered (deprecated: use Supabase + Context)
 */
export function isFaceRegistered(): boolean {
  return false;
}

/**
 * Clears the registered face (deprecated: use Supabase + Context)
 */
export function clearRegisteredFace() {
  // Logic moved to Supabase API and memory context
}

/**
 * Compares two face descriptors using Euclidean distance.
 * Returns { match: boolean, distance: number }
 *   - distance < MATCH_THRESHOLD → match = true
 */
export function compareFaces(
  reference: Float32Array,
  current: Float32Array
): { match: boolean; distance: number } {
  let sum = 0;
  for (let i = 0; i < reference.length; i++) {
    const diff = reference[i] - current[i];
    sum += diff * diff;
  }
  const distance = Math.sqrt(sum);
  return {
    match: distance < MATCH_THRESHOLD,
    distance: Math.round(distance * 100) / 100,
  };
}
