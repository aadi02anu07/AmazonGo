/**
 * Amazon Now Snap — BarcodeVisionAdapter
 * 
 * Hackathon Mode Vision Adapter - Stub implementation.
 * In Hackathon Mode, barcode scanning happens entirely on the client side
 * using ZXing/ML Kit/BarcodeDetector API.
 * 
 * This adapter is a pass-through that expects the client to already
 * have extracted the barcode value before calling the backend.
 * 
 * No S3 photo uploads, no Rekognition calls, zero AI cost.
 */

import { VisionAdapter, VisionResult } from '../interfaces';
import { logger } from '@utils/logger';

export class BarcodeVisionAdapter implements VisionAdapter {
  constructor() {
    logger.info({
      message: 'BarcodeVisionAdapter initialized',
      mode: 'hackathon',
      note: 'Client-side barcode scanning only',
    });
  }

  /**
   * Analyze image - Stub implementation
   * 
   * In Hackathon Mode, this method should not be called.
   * The client performs barcode scanning locally and sends the barcode
   * directly to GET /v1/products/barcode/{code}
   * 
   * If called, returns empty result indicating client should handle it
   */
  async analyzeImage(imageKey: string): Promise<VisionResult> {
    logger.warn({
      message: 'BarcodeVisionAdapter.analyzeImage called (should be client-side)',
      imageKey,
      adapter: 'BarcodeVision',
      mode: 'hackathon',
    });

    return {
      labels: [],
      detectedText: [],
      barcode: undefined,
    };
  }
}
