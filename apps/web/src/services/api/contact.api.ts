/**
 * Contact API service
 * Handles contact form and demo request submissions
 */

export interface ContactSubmissionData {
  name: string;
  workEmail: string;
  phone?: string;
  companyName: string;
  companySize: string;
  country: string;
  whatTheyWant: 'trial' | 'demo' | 'pricing' | 'subcontractor' | 'other';
  message: string;
  honeyPot?: string;
}

export interface ContactSubmissionResult {
  success: boolean;
  requestId: string;
  message: string;
}

export interface ContactApiError {
  error: string;
  errors?: Array<{
    path: string;
    message: string;
  }>;
}

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

/**
 * Submit a contact/demo request
 */
export async function submitContactRequest(
  data: ContactSubmissionData,
): Promise<ContactSubmissionResult> {
  const response = await fetch(`${API_BASE_URL}/api/contact/submit`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      name: data.name,
      workEmail: data.workEmail,
      phone: data.phone,
      companyName: data.companyName,
      companySize: data.companySize,
      country: data.country,
      intent: data.whatTheyWant, // Map frontend field name to backend
      message: data.message,
      honeyPot: data.honeyPot,
    }),
  });

  if (!response.ok) {
    const errorData: ContactApiError = await response.json().catch(() => ({
      error: 'An unexpected error occurred. Please try again.',
    }));
    throw new Error(errorData.error);
  }

  const result: ContactSubmissionResult = await response.json();
  return result;
}
