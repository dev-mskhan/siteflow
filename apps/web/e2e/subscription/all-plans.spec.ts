/**
 * E2E Tests: All Subscription Plans (Monthly & Yearly)
 * Tests complete signup flow with real Stripe checkout and Ethereal emails
 * 
 * Test Flow:
 * 1. Visit pricing page
 * 2. Click plan CTA
 * 3. Register with unique Ethereal email
 * 4. Verify email (fetch from Ethereal)
 * 5. Complete Stripe checkout
 * 6. Verify subscription created
 * 7. Test plan limits and features
 */

import { test, expect } from '@playwright/test';
import { generateTestEmail, getVerificationLinkFromEthereal } from '../fixtures/ethereal';
import { completeStripeCheckout, waitForStripeWebhook, verifySubscription } from '../fixtures/stripe';
import { getAuthToken, createAPIHelper } from '../fixtures/api';

const API_BASE_URL = process.env.API_URL || 'http://localhost:3000/api/v1';

test.describe('Subscription Plans - Complete Flow', () => {
  
  // Trial Plan Test
  test('Trial: Start 14-day free trial with full Professional features', async ({ page }) => {
    const email = generateTestEmail();
    const password = 'TestPassword123!';
    
    console.log(`\n====== TRIAL TEST ======`);
    console.log(`Email: ${email}`);
    
    // 1. Visit pricing page
    await page.goto('/pricing');
    await expect(page).toHaveURL(/\/pricing/);
    
    // 2. Click "Start free trial" on Trial card
    await page.click('[data-plan="trial"] >> text=Start free trial');
    
    // 3. Should land on register page with plan=trial
    await expect(page).toHaveURL(/\/register/);
    const url = page.url();
    expect(url).toContain('plan=trial');
    
    // 4. Fill registration form
    await page.fill('input[name="firstName"]', 'Trial');
    await page.fill('input[name="lastName"]', 'User');
    await page.fill('input[name="email"]', email);
    await page.fill('input[name="password"]', password);
    
    // 5. Submit registration
    await page.click('button[type="submit"]');
    
    // 6. Should land on email verification page
    await expect(page).toHaveURL(/\/verify-email\/pending/, { timeout: 10000 });
    
    // 7. Get verification link from Ethereal
    console.log('Fetching verification email from Ethereal...');
    const verificationLink = await getVerificationLinkFromEthereal(email);
    
    // 8. Visit verification link
    await page.goto(verificationLink);
    await expect(page).toHaveURL(/\/verify-email\/success|\/onboarding/, { timeout: 15000 });
    
    // 9. Complete org creation
    await page.fill('input[name="organizationName"]', 'Trial Org');
    await page.click('button[type="submit"]');
    
    // 10. Should land on billing page with flow=trial
    await expect(page).toHaveURL(/\/billing.*flow=trial/, { timeout: 10000 });
    
    // 11. Click "Start Free Trial" button
    await page.click('text=Start free trial');
    
    // 12. Wait for trial to be provisioned
    await page.waitForTimeout(2000);
    
    // 13. Get auth token and verify trial
    const token = await getAuthToken(page);
    expect(token).toBeTruthy();
    
    const api = createAPIHelper(API_BASE_URL, token!);
    const orgId = page.url().match(/\/org\/([^\/]+)/)?.[1];
    expect(orgId).toBeTruthy();
    
    // 14. Verify trial billing status
    const billingStatus = await api.get(`/org/${orgId}/billing/status`);
    expect(billingStatus.data.billingState).toBe('trial');
    expect(billingStatus.data.trial).toBeDefined();
    expect(billingStatus.data.trial.daysRemaining).toBe(14);
    
    // 15. Verify trial limits (same as Professional features)
    const limits = billingStatus.data.limits;
    expect(limits.activeProjects).toBe(2);
    expect(limits.teamMembers).toBe(5);
    expect(limits.storageGb).toBe(5);
    expect(limits.aiTokensMonthly).toBe(100_000);
    expect(limits.features.conversationalAi).toBe(true);
    expect(limits.features.procurementChain).toBe(true);
    expect(limits.features.subcontractorMgmt).toBe(true);
    
    console.log('✅ Trial test completed successfully!');
  });
  
  // Starter Monthly Test
  test('Starter Monthly: Direct purchase with Stripe checkout', async ({ page }) => {
    const email = generateTestEmail();
    const password = 'TestPassword123!';
    
    console.log(`\n====== STARTER MONTHLY TEST ======`);
    console.log(`Email: ${email}`);
    
    // 1-8. Same registration and verification flow
    await page.goto('/pricing');
    await page.click('[data-plan="starter"] >> text=Get started');
    
    await page.fill('input[name="firstName"]', 'Starter');
    await page.fill('input[name="lastName"]', 'Monthly');
    await page.fill('input[name="email"]', email);
    await page.fill('input[name="password"]', password);
    await page.click('button[type="submit"]');
    
    await expect(page).toHaveURL(/\/verify-email\/pending/);
    const verificationLink = await getVerificationLinkFromEthereal(email);
    await page.goto(verificationLink);
    
    await page.fill('input[name="organizationName"]', 'Starter Monthly Org');
    await page.click('button[type="submit"]');
    
    // 9. Should land on checkout flow
    await expect(page).toHaveURL(/\/billing.*flow=checkout.*plan=starter/, { timeout: 10000 });
    
    // 10. Verify checkout card shows Starter details
    await expect(page.locator('text=Complete your Starter purchase')).toBeVisible();
    
    // 11. Ensure Monthly is selected
    await page.click('text=Monthly');
    
    // 12. Click "Continue to payment"
    await page.click('text=Continue to payment');
    
    // 13. Complete Stripe checkout
    await completeStripeCheckout(page);
    
    // 14. Get auth token and org ID
    const token = await getAuthToken(page);
    const orgId = page.url().match(/organizationId=([^&]+)/)?.[1];
    expect(orgId).toBeTruthy();
    
    // 15. Wait for Stripe webhook to process
    await waitForStripeWebhook(API_BASE_URL, orgId!, token!, 'active');
    
    // 16. Verify subscription
    await verifySubscription(API_BASE_URL, orgId!, token!, 'starter', 'month');
    
    // 17. Verify Starter limits
    const api = createAPIHelper(API_BASE_URL, token!);
    const billingStatus = await api.get(`/org/${orgId}/billing/status`);
    
    expect(billingStatus.data.billingState).toBe('active');
    expect(billingStatus.data.subscription.planId).toBe('starter');
    expect(billingStatus.data.subscription.interval).toBe('month');
    expect(billingStatus.data.trial).toBeNull(); // No trial!
    
    const limits = billingStatus.data.limits;
    expect(limits.activeProjects).toBe(3);
    expect(limits.teamMembers).toBe(10);
    expect(limits.storageGb).toBe(50);
    expect(limits.aiTokensMonthly).toBe(100_000);
    expect(limits.features.conversationalAi).toBe(true); // ✅ NEW: Starter has AI
    expect(limits.features.procurementChain).toBe(false); // ❌ Gated
    
    console.log('✅ Starter Monthly test completed successfully!');
  });
  
  // Starter Yearly Test
  test('Starter Yearly: Purchase with annual billing (20% discount)', async ({ page }) => {
    const email = generateTestEmail();
    const password = 'TestPassword123!';
    
    console.log(`\n====== STARTER YEARLY TEST ======`);
    console.log(`Email: ${email}`);
    
    // Registration and verification (same flow)
    await page.goto('/pricing');
    await page.click('[data-plan="starter"] >> text=Get started');
    
    await page.fill('input[name="firstName"]', 'Starter');
    await page.fill('input[name="lastName"]', 'Yearly');
    await page.fill('input[name="email"]', email);
    await page.fill('input[name="password"]', password);
    await page.click('button[type="submit"]');
    
    await expect(page).toHaveURL(/\/verify-email\/pending/);
    const verificationLink = await getVerificationLinkFromEthereal(email);
    await page.goto(verificationLink);
    
    await page.fill('input[name="organizationName"]', 'Starter Yearly Org');
    await page.click('button[type="submit"]');
    
    await expect(page).toHaveURL(/\/billing.*flow=checkout.*plan=starter/);
    
    // Select YEARLY billing
    await page.click('text=Yearly');
    await expect(page.locator('text=−20%')).toBeVisible(); // Verify discount shown
    
    await page.click('text=Continue to payment');
    await completeStripeCheckout(page);
    
    const token = await getAuthToken(page);
    const orgId = page.url().match(/organizationId=([^&]+)/)?.[1];
    
    await waitForStripeWebhook(API_BASE_URL, orgId!, token!, 'active');
    await verifySubscription(API_BASE_URL, orgId!, token!, 'starter', 'year');
    
    console.log('✅ Starter Yearly test completed successfully!');
  });
  
  // Professional Monthly Test
  test('Professional Monthly: Full feature access with 500K AI tokens', async ({ page }) => {
    const email = generateTestEmail();
    const password = 'TestPassword123!';
    
    console.log(`\n====== PROFESSIONAL MONTHLY TEST ======`);
    console.log(`Email: ${email}`);
    
    await page.goto('/pricing');
    await page.click('[data-plan="professional"] >> text=Get started');
    
    await page.fill('input[name="firstName"]', 'Pro');
    await page.fill('input[name="lastName"]', 'Monthly');
    await page.fill('input[name="email"]', email);
    await page.fill('input[name="password"]', password);
    await page.click('button[type="submit"]');
    
    await expect(page).toHaveURL(/\/verify-email\/pending/);
    const verificationLink = await getVerificationLinkFromEthereal(email);
    await page.goto(verificationLink);
    
    await page.fill('input[name="organizationName"]', 'Pro Monthly Org');
    await page.click('button[type="submit"]');
    
    await expect(page).toHaveURL(/\/billing.*flow=checkout.*plan=professional/);
    
    await page.click('text=Monthly');
    await page.click('text=Continue to payment');
    await completeStripeCheckout(page);
    
    const token = await getAuthToken(page);
    const orgId = page.url().match(/organizationId=([^&]+)/)?.[1];
    
    await waitForStripeWebhook(API_BASE_URL, orgId!, token!, 'active');
    await verifySubscription(API_BASE_URL, orgId!, token!, 'professional', 'month');
    
    // Verify Professional limits (all features unlocked)
    const api = createAPIHelper(API_BASE_URL, token!);
    const billingStatus = await api.get(`/org/${orgId}/billing/status`);
    
    const limits = billingStatus.data.limits;
    expect(limits.activeProjects).toBe(15);
    expect(limits.teamMembers).toBe(50);
    expect(limits.storageGb).toBe(250);
    expect(limits.aiTokensMonthly).toBe(500_000); // 5x Starter
    expect(limits.features.conversationalAi).toBe(true);
    expect(limits.features.procurementChain).toBe(true); // ✅ Unlocked
    expect(limits.features.subcontractorMgmt).toBe(true); // ✅ Unlocked
    expect(limits.features.changeOrders).toBe(true);
    expect(limits.features.aiaPaymentApps).toBe(true);
    expect(limits.features.costControl).toBe(true);
    expect(limits.features.advancedReporting).toBe(true);
    
    console.log('✅ Professional Monthly test completed successfully!');
  });
  
  // Professional Yearly Test
  test('Professional Yearly: Annual subscription with 20% discount', async ({ page }) => {
    const email = generateTestEmail();
    const password = 'TestPassword123!';
    
    console.log(`\n====== PROFESSIONAL YEARLY TEST ======`);
    console.log(`Email: ${email}`);
    
    await page.goto('/pricing');
    await page.click('[data-plan="professional"] >> text=Get started');
    
    await page.fill('input[name="firstName"]', 'Pro');
    await page.fill('input[name="lastName"]', 'Yearly');
    await page.fill('input[name="email"]', email);
    await page.fill('input[name="password"]', password);
    await page.click('button[type="submit"]');
    
    await expect(page).toHaveURL(/\/verify-email\/pending/);
    const verificationLink = await getVerificationLinkFromEthereal(email);
    await page.goto(verificationLink);
    
    await page.fill('input[name="organizationName"]', 'Pro Yearly Org');
    await page.click('button[type="submit"]');
    
    await expect(page).toHaveURL(/\/billing.*flow=checkout.*plan=professional/);
    
    await page.click('text=Yearly');
    await page.click('text=Continue to payment');
    await completeStripeCheckout(page);
    
    const token = await getAuthToken(page);
    const orgId = page.url().match(/organizationId=([^&]+)/)?.[1];
    
    await waitForStripeWebhook(API_BASE_URL, orgId!, token!, 'active');
    await verifySubscription(API_BASE_URL, orgId!, token!, 'professional', 'year');
    
    console.log('✅ Professional Yearly test completed successfully!');
  });
  
  // Enterprise Monthly Test
  test('Enterprise Monthly: Maximum limits (100 projects, 500 members, 2M tokens)', async ({ page }) => {
    const email = generateTestEmail();
    const password = 'TestPassword123!';
    
    console.log(`\n====== ENTERPRISE MONTHLY TEST ======`);
    console.log(`Email: ${email}`);
    
    await page.goto('/pricing');
    await page.click('[data-plan="enterprise"] >> text=Get started');
    
    await page.fill('input[name="firstName"]', 'Enterprise');
    await page.fill('input[name="lastName"]', 'Monthly');
    await page.fill('input[name="email"]', email);
    await page.fill('input[name="password"]', password);
    await page.click('button[type="submit"]');
    
    await expect(page).toHaveURL(/\/verify-email\/pending/);
    const verificationLink = await getVerificationLinkFromEthereal(email);
    await page.goto(verificationLink);
    
    await page.fill('input[name="organizationName"]', 'Enterprise Monthly Org');
    await page.click('button[type="submit"]');
    
    await expect(page).toHaveURL(/\/billing.*flow=checkout.*plan=enterprise/);
    
    await page.click('text=Monthly');
    await page.click('text=Continue to payment');
    await completeStripeCheckout(page);
    
    const token = await getAuthToken(page);
    const orgId = page.url().match(/organizationId=([^&]+)/)?.[1];
    
    await waitForStripeWebhook(API_BASE_URL, orgId!, token!, 'active');
    await verifySubscription(API_BASE_URL, orgId!, token!, 'enterprise', 'month');
    
    // Verify Enterprise limits (massive scale)
    const api = createAPIHelper(API_BASE_URL, token!);
    const billingStatus = await api.get(`/org/${orgId}/billing/status`);
    
    const limits = billingStatus.data.limits;
    expect(limits.activeProjects).toBe(100); // 100 projects!
    expect(limits.teamMembers).toBe(500); // 500 members!
    expect(limits.storageGb).toBe(1000); // 1TB storage!
    expect(limits.aiTokensMonthly).toBe(2_000_000); // 2M tokens!
    
    console.log('✅ Enterprise Monthly test completed successfully!');
  });
  
  // Enterprise Yearly Test
  test('Enterprise Yearly: Annual subscription for large organizations', async ({ page }) => {
    const email = generateTestEmail();
    const password = 'TestPassword123!';
    
    console.log(`\n====== ENTERPRISE YEARLY TEST ======`);
    console.log(`Email: ${email}`);
    
    await page.goto('/pricing');
    await page.click('[data-plan="enterprise"] >> text=Get started');
    
    await page.fill('input[name="firstName"]', 'Enterprise');
    await page.fill('input[name="lastName"]', 'Yearly');
    await page.fill('input[name="email"]', email);
    await page.fill('input[name="password"]', password);
    await page.click('button[type="submit"]');
    
    await expect(page).toHaveURL(/\/verify-email\/pending/);
    const verificationLink = await getVerificationLinkFromEthereal(email);
    await page.goto(verificationLink);
    
    await page.fill('input[name="organizationName"]', 'Enterprise Yearly Org');
    await page.click('button[type="submit"]');
    
    await expect(page).toHaveURL(/\/billing.*flow=checkout.*plan=enterprise/);
    
    await page.click('text=Yearly');
    await page.click('text=Continue to payment');
    await completeStripeCheckout(page);
    
    const token = await getAuthToken(page);
    const orgId = page.url().match(/organizationId=([^&]+)/)?.[1];
    
    await waitForStripeWebhook(API_BASE_URL, orgId!, token!, 'active');
    await verifySubscription(API_BASE_URL, orgId!, token!, 'enterprise', 'year');
    
    console.log('✅ Enterprise Yearly test completed successfully!');
  });
  
});
