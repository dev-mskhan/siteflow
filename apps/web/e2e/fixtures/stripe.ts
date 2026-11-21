/**
 * Stripe Test Helpers
 * Fill Stripe checkout forms with test card data
 */

import type { Page } from '@playwright/test';

export const STRIPE_TEST_CARDS = {
  SUCCESS: '4242424242424242',
  DECLINE: '4000000000000002',
  INSUFFICIENT_FUNDS: '4000000000009995',
  REQUIRES_AUTH: '4000002500003155',
};

/**
 * Fill Stripe checkout form with test card
 */
export async function fillStripeCheckout(
  page: Page,
  cardNumber: string = STRIPE_TEST_CARDS.SUCCESS
) {
  console.log('[Stripe] Waiting for checkout page...');
  
  // Wait for Stripe checkout page to load
  await page.waitForURL(/checkout\.stripe\.com/, { timeout: 60000 });
  console.log('[Stripe] On checkout page');
  
  // Wait for card input to be ready
  await page.waitForSelector('input[name="cardNumber"]', { timeout: 30000 });
  
  // Fill card number
  console.log('[Stripe] Filling card number...');
  await page.fill('input[name="cardNumber"]', cardNumber);
  
  // Fill expiry date (any future date)
  console.log('[Stripe] Filling expiry...');
  await page.fill('input[name="cardExpiry"]', '12/34');
  
  // Fill CVC
  console.log('[Stripe] Filling CVC...');
  await page.fill('input[name="cardCvc"]', '123');
  
  // Fill billing details if required
  try {
    await page.fill('input[name="billingName"]', 'Test User', { timeout: 2000 });
  } catch {
    // Billing name might not be required
  }
  
  console.log('[Stripe] Form filled successfully');
}

/**
 * Complete Stripe checkout (fill form + submit)
 */
export async function completeStripeCheckout(
  page: Page,
  cardNumber: string = STRIPE_TEST_CARDS.SUCCESS
) {
  await fillStripeCheckout(page, cardNumber);
  
  // Click submit button
  console.log('[Stripe] Clicking submit button...');
  await page.click('button[type="submit"]');
  
  // Wait for redirect back to app (success page)
  console.log('[Stripe] Waiting for redirect...');
  await page.waitForURL(/\/billing\/checkout\/success/, { timeout: 120000 });
  
  console.log('[Stripe] Checkout completed successfully!');
}

/**
 * Wait for Stripe webhook to process
 * Polls the billing status API until subscription is active
 */
export async function waitForStripeWebhook(
  apiBaseURL: string,
  orgId: string,
  token: string,
  expectedState: 'trial' | 'active' = 'active',
  maxAttempts = 30,
  delayMs = 2000
): Promise<void> {
  console.log(`[Stripe Webhook] Waiting for billing state to become '${expectedState}'...`);
  
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const response = await fetch(`${apiBaseURL}/org/${orgId}/billing/status`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });
      
      if (!response.ok) {
        console.log(`[Stripe Webhook] Attempt ${attempt}: API error ${response.status}`);
        await new Promise(resolve => setTimeout(resolve, delayMs));
        continue;
      }
      
      const data = await response.json();
      const billingState = data.data?.billingState;
      
      if (billingState === expectedState) {
        console.log(`[Stripe Webhook] Billing state is '${expectedState}' (attempt ${attempt})`);
        return;
      }
      
      console.log(`[Stripe Webhook] Attempt ${attempt}: State is '${billingState}', waiting...`);
      
    } catch (error: any) {
      console.log(`[Stripe Webhook] Attempt ${attempt}: Error - ${error.message}`);
    }
    
    await new Promise(resolve => setTimeout(resolve, delayMs));
  }
  
  throw new Error(`Stripe webhook did not update billing state to '${expectedState}' after ${maxAttempts} attempts`);
}

/**
 * Verify subscription details
 */
export async function verifySubscription(
  apiBaseURL: string,
  orgId: string,
  token: string,
  expectedPlan: 'starter' | 'professional' | 'enterprise',
  expectedInterval: 'month' | 'year'
): Promise<void> {
  const response = await fetch(`${apiBaseURL}/org/${orgId}/billing/status`, {
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  });
  
  if (!response.ok) {
    throw new Error(`Failed to fetch billing status: ${response.status}`);
  }
  
  const data = await response.json();
  const subscription = data.data?.subscription;
  
  if (!subscription) {
    throw new Error('No subscription found');
  }
  
  if (subscription.planId !== expectedPlan) {
    throw new Error(`Expected plan '${expectedPlan}' but got '${subscription.planId}'`);
  }
  
  if (subscription.interval !== expectedInterval) {
    throw new Error(`Expected interval '${expectedInterval}' but got '${subscription.interval}'`);
  }
  
  console.log(`[Subscription] Verified: ${expectedPlan} (${expectedInterval})`);
}
