/**
 * Ethereal Email Helper
 * Fetches verification emails from Ethereal inbox during tests
 */

interface EtherealMessage {
  id: string;
  from: { address: string; name: string };
  to: Array<{ address: string; name: string }>;
  subject: string;
  html: string;
  text: string;
  date: string;
}

/**
 * Get verification link from Ethereal inbox
 * Polls the Ethereal API until verification email arrives
 */
export async function getVerificationLinkFromEthereal(
  email: string,
  maxAttempts = 30,
  delayMs = 2000
): Promise<string> {
  // Extract Ethereal credentials from email
  // Format: test-abc123@ethereal.email
  const username = email;
  const password = process.env.ETHEREAL_PASSWORD || 'test'; // You'll need to set this
  
  console.log(`[Ethereal] Waiting for verification email to ${email}...`);
  
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      // Fetch messages from Ethereal API
      const response = await fetch(`https://api.ethereal.email/api/messages`, {
        headers: {
          'Authorization': 'Basic ' + Buffer.from(`${username}:${password}`).toString('base64'),
        },
      });
      
      if (!response.ok) {
        console.log(`[Ethereal] Attempt ${attempt}: API error ${response.status}`);
        await new Promise(resolve => setTimeout(resolve, delayMs));
        continue;
      }
      
      const messages: EtherealMessage[] = await response.json();
      
      // Find verification email
      const verificationEmail = messages.find(msg => 
        msg.to.some(t => t.address === email) &&
        msg.subject.includes('Verify your email')
      );
      
      if (verificationEmail) {
        console.log(`[Ethereal] Found verification email (attempt ${attempt})`);
        
        // Extract verification link from HTML
        const linkMatch = verificationEmail.html.match(/href="([^"]*verify-email[^"]*)"/);
        if (linkMatch && linkMatch[1]) {
          const verificationLink = linkMatch[1];
          console.log(`[Ethereal] Verification link: ${verificationLink}`);
          return verificationLink;
        }
        
        // Try text version
        const textLinkMatch = verificationEmail.text.match(/(https?:\/\/[^\s]+verify-email[^\s]+)/);
        if (textLinkMatch && textLinkMatch[1]) {
          const verificationLink = textLinkMatch[1];
          console.log(`[Ethereal] Verification link (from text): ${verificationLink}`);
          return verificationLink;
        }
        
        throw new Error('Verification email found but no link extracted');
      }
      
      console.log(`[Ethereal] Attempt ${attempt}: No verification email yet (${messages.length} messages)`);
      
    } catch (error: any) {
      console.log(`[Ethereal] Attempt ${attempt}: Error - ${error.message}`);
    }
    
    // Wait before next attempt
    await new Promise(resolve => setTimeout(resolve, delayMs));
  }
  
  throw new Error(`Verification email not received after ${maxAttempts} attempts`);
}

/**
 * Alternative: Extract verification token from database (faster, but less realistic)
 */
export async function getVerificationTokenFromDB(email: string): Promise<string> {
  // This would query the database directly
  // More reliable but less realistic than email checking
  // Implement if Ethereal approach is too flaky
  throw new Error('Not implemented - use Ethereal approach');
}

/**
 * Generate unique Ethereal-compatible email for testing
 */
export function generateTestEmail(): string {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(7);
  return `test-${timestamp}-${random}@ethereal.email`;
}
