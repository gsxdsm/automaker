/**
 * API Client Singleton
 *
 * Provides a unified API client that works in both web and Electron modes.
 * Automatically uses HttpApiClient or Electron IPC based on environment.
 */

import { getHttpApiClient } from './http-api-client';

// Export singleton instance
export const api = getHttpApiClient();
