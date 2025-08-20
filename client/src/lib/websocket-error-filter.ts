/**
 * WebSocket Error Filter
 * 
 * This module provides error filtering to suppress development tool WebSocket errors
 * that don't affect the application functionality, while preserving actual errors.
 */

// Store original console.error
const originalConsoleError = console.error;

// Development tool error patterns to filter out (Vite HMR WebSocket errors)
const FILTERED_ERROR_PATTERNS = [
  // Vite HMR WebSocket connection failures
  /WebSocket connection.*failed.*client:\d+/,
  /setupWebSocket.*client:\d+/,
  /fallback.*client:\d+/,
  /Failed to construct 'WebSocket'.*localhost:undefined/,
  /WebSocket.*token=.*failed/,
  /Uncaught.*SyntaxError.*Failed to construct 'WebSocket'.*localhost:undefined/,
  /wss:\/\/localhost:undefined/,
  /at setupWebSocket.*client:/,
  /at fallback.*client:/,
  /The URL.*localhost:undefined.*is invalid/,
  // Additional Vite HMR patterns
  /WebSocket connection to.*failed.*Error during WebSocket handshake.*Unexpected response code.*400/,
  /WebSocket connection to.*token=.*failed/,
  /Error during WebSocket handshake.*Unexpected response code.*400/,
  /client:\d+.*WebSocket connection.*failed/,
  /client:\d+.*setupWebSocket/,
  /client:\d+.*fallback/,
];

/**
 * Enhanced console.error that filters out development tool WebSocket errors
 * while preserving all other errors and our application's WebSocket logs
 */
function filteredConsoleError(...args: any[]) {
  const message = args.join(' ');
  
  // Check if this is a filtered development tool error
  const isFiltered = FILTERED_ERROR_PATTERNS.some(pattern => 
    pattern.test(message)
  );
  
  // If it's not a filtered error, or it's one of our [WebSocket] prefixed logs, show it
  if (!isFiltered || message.includes('[WebSocket]')) {
    originalConsoleError.apply(console, args);
  }
}

/**
 * Initialize error filtering
 * Call this early in the application lifecycle
 */
export function initializeWebSocketErrorFilter() {
  if (typeof window !== 'undefined' && process.env.NODE_ENV === 'development') {
    console.error = filteredConsoleError;
    console.log('[WebSocket Error Filter] Development tool WebSocket error suppression enabled');
  }
}

/**
 * Restore original console.error
 */
export function restoreConsoleError() {
  if (typeof window !== 'undefined') {
    console.error = originalConsoleError;
  }
}