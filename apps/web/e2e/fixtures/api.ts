/**
 * API Request Helpers for E2E Tests
 */

export interface APIContext {
  baseURL: string;
  token?: string;
}

/**
 * Create authenticated API request helper
 */
export function createAPIHelper(baseURL: string, token?: string) {
  return {
    async get<T = any>(path: string): Promise<T> {
      const response = await fetch(`${baseURL}${path}`, {
        headers: {
          ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
          'Content-Type': 'application/json',
        },
      });
      
      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(`API ${response.status}: ${JSON.stringify(error)}`);
      }
      
      return response.json();
    },
    
    async post<T = any>(path: string, data?: any): Promise<T> {
      const response = await fetch(`${baseURL}${path}`, {
        method: 'POST',
        headers: {
          ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
          'Content-Type': 'application/json',
        },
        body: data ? JSON.stringify(data) : undefined,
      });
      
      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(`API ${response.status}: ${JSON.stringify(error)}`);
      }
      
      return response.json();
    },
    
    setToken(newToken: string) {
      token = newToken;
    },
  };
}

/**
 * Extract auth token from browser storage
 */
export async function getAuthToken(page: any): Promise<string | null> {
  // Check localStorage
  const token = await page.evaluate(() => {
    return localStorage.getItem('auth_token') || sessionStorage.getItem('auth_token');
  });
  
  return token;
}

/**
 * Wait for API response with polling
 */
export async function waitForAPICondition<T>(
  fn: () => Promise<T>,
  condition: (result: T) => boolean,
  options: {
    timeout?: number;
    interval?: number;
    errorMessage?: string;
  } = {}
): Promise<T> {
  const { 
    timeout = 30000, 
    interval = 1000,
    errorMessage = 'Condition not met within timeout'
  } = options;
  
  const startTime = Date.now();
  
  while (Date.now() - startTime < timeout) {
    try {
      const result = await fn();
      if (condition(result)) {
        return result;
      }
    } catch (error) {
      // Ignore errors during polling
    }
    
    await new Promise(resolve => setTimeout(resolve, interval));
  }
  
  throw new Error(errorMessage);
}
