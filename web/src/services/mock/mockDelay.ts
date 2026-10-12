/**
 * Helper to simulate realistic network latency (400-800ms)
 * Allows developers and users to verify skeleton loaders and loading transitions.
 */
export async function mockDelay(minMs = 400, maxMs = 800): Promise<void> {
  const delay = Math.floor(Math.random() * (maxMs - minMs + 1)) + minMs;
  return new Promise((resolve) => setTimeout(resolve, delay));
}
