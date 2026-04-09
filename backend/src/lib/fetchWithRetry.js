/**
 * Resilient HTTP Client with Retry Logic
 * 
 * Provides fetch with:
 * - 30-second timeout via AbortController
 * - Exponential backoff (max 3 retries)
 * - Configurable retry conditions
 * 
 * @module lib/fetchWithRetry
 */

const DEFAULT_TIMEOUT = 30000; // 30 seconds
const MAX_RETRIES = 3;
const RETRY_DELAY_BASE = 1000; // 1 second base delay

/**
 * Sleep utility for delay between retries
 * @param {number} ms - Milliseconds to sleep
 */
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Check if error is retryable
 * @param {Error} error - The error object
 * @param {Response} response - The fetch response (if any)
 * @returns {boolean}
 */
const isRetryableError = (error, response) => {
    // Network errors, timeouts, and 5xx server errors are retryable
    if (!response) return true;
    if (response.status >= 500 && response.status < 600) return true;
    if (response.status === 408) return true; // Request Timeout
    if (response.status === 429) return true; // Too Many Requests
    return false;
};

/**
 * Fetch with retry logic, timeout, and exponential backoff
 * 
 * @param {string} url - The URL to fetch
 * @param {Object} options - Fetch options
 * @param {Object} retryOptions - Retry configuration
 * @param {number} retryOptions.maxRetries - Max retry attempts (default: 3)
 * @param {number} retryOptions.timeout - Request timeout in ms (default: 30000)
 * @returns {Promise<Response>} - Fetch response
 */
const fetchWithRetry = async (url, options = {}, retryOptions = {}) => {
    const { maxRetries = MAX_RETRIES, timeout = DEFAULT_TIMEOUT } = retryOptions;
    let lastError;
    let lastResponse;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeout);

        try {
            console.log(`[fetchWithRetry] Attempt ${attempt + 1}/${maxRetries + 1} for ${url}`);
            
            const response = await fetch(url, {
                ...options,
                signal: controller.signal
            });

            clearTimeout(timeoutId);

            // If response is ok, return immediately
            if (response.ok) {
                if (attempt > 0) {
                    console.log(`[fetchWithRetry] Success on attempt ${attempt + 1}`);
                }
                return response;
            }

            // Check if we should retry
            if (!isRetryableError(null, response) || attempt === maxRetries) {
                return response; // Return non-ok response if not retryable or max retries reached
            }

            lastResponse = response;
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);

        } catch (error) {
            clearTimeout(timeoutId);
            lastError = error;

            if (error.name === 'AbortError') {
                console.warn(`[fetchWithRetry] Timeout on attempt ${attempt + 1} (${timeout}ms)`);
                lastError = new Error(`Request timeout after ${timeout}ms`);
            } else {
                console.warn(`[fetchWithRetry] Error on attempt ${attempt + 1}: ${error.message}`);
            }

            // Don't retry if max retries reached
            if (attempt === maxRetries) {
                break;
            }

            // Exponential backoff: 1s, 2s, 4s
            const delay = RETRY_DELAY_BASE * Math.pow(2, attempt);
            console.log(`[fetchWithRetry] Retrying in ${delay}ms...`);
            await sleep(delay);
        }
    }

    // All retries exhausted
    const finalError = new Error(
        `Failed after ${maxRetries + 1} attempts: ${lastError.message}`
    );
    finalError.attempts = maxRetries + 1;
    finalError.lastResponse = lastResponse;
    throw finalError;
};

module.exports = {
    fetchWithRetry,
    DEFAULT_TIMEOUT,
    MAX_RETRIES
};
