/**
 * Amazon Now Snap — Adapter Factory
 * 
 * This factory reads ENABLE_* environment variables and returns the correct
 * adapter implementation for each service. This is the ONLY place where
 * deployment mode is decided.
 * 
 * Lambda functions should ALWAYS import from this factory, never instantiate
 * adapters directly.
 * 
 * Example:
 *   import { searchAdapter, cacheAdapter } from '@adapters/factory';
 *   const results = await searchAdapter.search(query, pincode);
 */

import {
  SearchAdapter,
  CacheAdapter,
  RecommendationAdapter,
  IntentResolutionAdapter,
  VisionAdapter,
  VoiceAdapter,
} from './interfaces';

// ============================================================================
// Adapter Implementations (imported lazily to avoid loading unused services)
// ============================================================================

// Search Adapters
let OpenSearchAdapter: new () => SearchAdapter;
let DynamoSearchAdapter: new () => SearchAdapter;

// Cache Adapters
let RedisCacheAdapter: new () => CacheAdapter;
let DynamoCacheAdapter: new () => CacheAdapter;

// Recommendation Adapters
let PersonalizeAdapter: new () => RecommendationAdapter;
let RuleBasedRecommendationAdapter: new () => RecommendationAdapter;

// Intent Resolution Adapters
let BedrockIntentAdapter: new () => IntentResolutionAdapter;
let KeywordIntentAdapter: new () => IntentResolutionAdapter;

// Vision Adapters
let RekognitionAdapter: new () => VisionAdapter;
let BarcodeVisionAdapter: new () => VisionAdapter;

// Voice Adapters
let TranscribeAdapter: new () => VoiceAdapter;
let BrowserSpeechAdapter: new () => VoiceAdapter;

// ============================================================================
// Factory Functions
// ============================================================================

/**
 * Get the search adapter based on ENABLE_OPENSEARCH flag
 */
function getSearchAdapter(): SearchAdapter {
  const enabled = process.env.ENABLE_OPENSEARCH === 'true';

  if (enabled) {
    if (!OpenSearchAdapter) {
      // Lazy load production adapter
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      OpenSearchAdapter = require('./search/OpenSearchAdapter').OpenSearchAdapter;
    }
    return new OpenSearchAdapter();
  } else {
    if (!DynamoSearchAdapter) {
      // Lazy load hackathon adapter
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      DynamoSearchAdapter = require('./search/DynamoSearchAdapter').DynamoSearchAdapter;
    }
    return new DynamoSearchAdapter();
  }
}

/**
 * Get the cache adapter based on ENABLE_REDIS flag
 */
function getCacheAdapter(): CacheAdapter {
  const enabled = process.env.ENABLE_REDIS === 'true';

  if (enabled) {
    if (!RedisCacheAdapter) {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      RedisCacheAdapter = require('./cache/RedisCacheAdapter').RedisCacheAdapter;
    }
    return new RedisCacheAdapter();
  } else {
    if (!DynamoCacheAdapter) {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      DynamoCacheAdapter = require('./cache/DynamoCacheAdapter').DynamoCacheAdapter;
    }
    return new DynamoCacheAdapter();
  }
}

/**
 * Get the recommendation adapter based on ENABLE_PERSONALIZE flag
 */
function getRecommendationAdapter(): RecommendationAdapter {
  const enabled = process.env.ENABLE_PERSONALIZE === 'true';

  if (enabled) {
    if (!PersonalizeAdapter) {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      PersonalizeAdapter = require('./recommendation/PersonalizeAdapter').PersonalizeAdapter;
    }
    return new PersonalizeAdapter();
  } else {
    if (!RuleBasedRecommendationAdapter) {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      RuleBasedRecommendationAdapter =
        require('./recommendation/RuleBasedRecommendationAdapter').RuleBasedRecommendationAdapter;
    }
    return new RuleBasedRecommendationAdapter();
  }
}

/**
 * Get the intent resolution adapter based on ENABLE_BEDROCK flag
 */
function getIntentResolutionAdapter(): IntentResolutionAdapter {
  const enabled = process.env.ENABLE_BEDROCK === 'true';

  if (enabled) {
    if (!BedrockIntentAdapter) {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      BedrockIntentAdapter = require('./intent/BedrockIntentAdapter').BedrockIntentAdapter;
    }
    return new BedrockIntentAdapter();
  } else {
    if (!KeywordIntentAdapter) {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      KeywordIntentAdapter = require('./intent/KeywordIntentAdapter').KeywordIntentAdapter;
    }
    return new KeywordIntentAdapter();
  }
}

/**
 * Get the vision adapter based on ENABLE_REKOGNITION flag
 */
function getVisionAdapter(): VisionAdapter {
  const enabled = process.env.ENABLE_REKOGNITION === 'true';

  if (enabled) {
    if (!RekognitionAdapter) {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      RekognitionAdapter = require('./vision/RekognitionAdapter').RekognitionAdapter;
    }
    return new RekognitionAdapter();
  } else {
    if (!BarcodeVisionAdapter) {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      BarcodeVisionAdapter = require('./vision/BarcodeVisionAdapter').BarcodeVisionAdapter;
    }
    return new BarcodeVisionAdapter();
  }
}

/**
 * Get the voice adapter based on ENABLE_TRANSCRIBE flag
 */
function getVoiceAdapter(): VoiceAdapter {
  const enabled = process.env.ENABLE_TRANSCRIBE === 'true';

  if (enabled) {
    if (!TranscribeAdapter) {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      TranscribeAdapter = require('./voice/TranscribeAdapter').TranscribeAdapter;
    }
    return new TranscribeAdapter();
  } else {
    if (!BrowserSpeechAdapter) {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      BrowserSpeechAdapter = require('./voice/BrowserSpeechAdapter').BrowserSpeechAdapter;
    }
    return new BrowserSpeechAdapter();
  }
}

// ============================================================================
// Singleton Instances (created once per Lambda cold start)
// ============================================================================

export const searchAdapter: SearchAdapter = getSearchAdapter();
export const cacheAdapter: CacheAdapter = getCacheAdapter();
export const recommendationAdapter: RecommendationAdapter = getRecommendationAdapter();
export const intentAdapter: IntentResolutionAdapter = getIntentResolutionAdapter();
export const visionAdapter: VisionAdapter = getVisionAdapter();
export const voiceAdapter: VoiceAdapter = getVoiceAdapter();

// ============================================================================
// Deployment Mode Logging (for observability)
// ============================================================================

const deploymentMode = {
  search: process.env.ENABLE_OPENSEARCH === 'true' ? 'OpenSearch' : 'DynamoDB',
  cache: process.env.ENABLE_REDIS === 'true' ? 'Redis' : 'DynamoDB',
  recommendation: process.env.ENABLE_PERSONALIZE === 'true' ? 'Personalize' : 'RuleBased',
  intent: process.env.ENABLE_BEDROCK === 'true' ? 'Bedrock' : 'Keyword',
  vision: process.env.ENABLE_REKOGNITION === 'true' ? 'Rekognition' : 'Barcode',
  voice: process.env.ENABLE_TRANSCRIBE === 'true' ? 'Transcribe' : 'BrowserSpeech',
};

// Log deployment mode on Lambda cold start
console.log('[Adapter Factory] Deployment mode:', JSON.stringify(deploymentMode));
