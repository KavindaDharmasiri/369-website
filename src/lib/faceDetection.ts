import { FaceDetector, FilesetResolver } from '@mediapipe/tasks-vision'

let detector: FaceDetector | null = null

async function getFaceDetector(): Promise<FaceDetector> {
  if (detector) return detector
  const vision = await FilesetResolver.forVisionTasks(
    'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@1.0.1/wasm'
  )
  detector = await FaceDetector.createFromOptions(vision, {
    baseOptions: {
      modelAssetPath:
        'https://storage.googleapis.com/mediapipe-models/face_detector/blaze_face_short_range/float16/latest/blaze_face_short_range.tflite',
      delegate: 'CPU',
    },
    runningMode: 'IMAGE',
    minDetectionConfidence: 0.5,
  })
  return detector
}

export interface FaceCheckResult {
  count: number
}

export async function countFaces(image: HTMLImageElement): Promise<FaceCheckResult> {
  const det = await getFaceDetector()
  const result = det.detect(image)
  return { count: result.detections.length }
}
