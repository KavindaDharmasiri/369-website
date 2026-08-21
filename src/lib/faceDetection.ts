import { FilesetResolver, PoseLandmarker } from '@mediapipe/tasks-vision'

let landmarkerPromise: Promise<PoseLandmarker> | null = null

function getPoseLandmarker(): Promise<PoseLandmarker> {
  if (!landmarkerPromise) {
    landmarkerPromise = FilesetResolver.forVisionTasks(
      'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@1.0.1/wasm'
    ).then((vision) =>
      PoseLandmarker.createFromOptions(vision, {
        baseOptions: {
          modelAssetPath:
            'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/latest/pose_landmarker_lite.tflite',
          delegate: 'CPU',
        },
        runningMode: 'IMAGE',
        numPoses: 2,
        minPoseDetectionConfidence: 0.4,
      })
    )
    landmarkerPromise.catch(() => {
      landmarkerPromise = null
    })
  }
  return landmarkerPromise
}

export interface PersonCheckResult {
  count: number
}

/**
 * Counts people in the photo using MediaPipe Pose Landmarker, which is far
 * more reliable on full-body / fashion shots than a generic COCO object
 * detector. If the detector itself fails to load or times out we fail open
 * (assume one person) so a detector outage never blocks the try-on flow.
 */
export async function countPersons(image: HTMLImageElement): Promise<PersonCheckResult> {
  try {
    const landmarker = await Promise.race([
      getPoseLandmarker(),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('Person detector timed out')), 20000)
      ),
    ])
    const result = landmarker.detect(image)
    return { count: result.landmarks.length }
  } catch (err) {
    console.warn('Person detection unavailable, continuing without the check:', err)
    return { count: 1 }
  }
}
