/**
 * Amazon Now Snap — BrowserSpeechAdapter
 * 
 * Hackathon Mode Voice Adapter - Stub implementation.
 * In Hackathon Mode, voice transcription happens entirely on the client side
 * using the Web Speech API (window.SpeechRecognition).
 * 
 * This adapter is a pass-through that expects the client to already
 * have transcribed the audio to text before calling the backend.
 * 
 * Backend receives only the transcript string via POST /v1/intent/voice
 * No AWS Transcribe calls, zero AI cost.
 */

import { VoiceAdapter } from '../interfaces';
import { logger } from '@utils/logger';

export class BrowserSpeechAdapter implements VoiceAdapter {
  constructor() {
    logger.info({
      message: 'BrowserSpeechAdapter initialized',
      mode: 'hackathon',
      note: 'Client-side Web Speech API only',
    });
  }

  /**
   * Transcribe audio - Stub implementation
   * 
   * In Hackathon Mode, this method should not be called.
   * The client transcribes audio locally using Web Speech API and sends
   * the transcript string to POST /v1/intent/voice
   * 
   * If called, returns empty string indicating client should handle it
   */
  async transcribe(_audioData: Buffer | string, languageCode: string): Promise<string> {
    logger.warn({
      message: 'BrowserSpeechAdapter.transcribe called (should be client-side)',
      languageCode,
      adapter: 'BrowserSpeech',
      mode: 'hackathon',
    });

    return '';
  }
}
