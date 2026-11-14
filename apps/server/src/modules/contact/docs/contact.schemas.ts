import { z } from 'zod';

// ─── Contact Form Submit Schema ───────────────────────────────────────────────
export const contactSubmitSchema = z.object({
  name: z
    .string()
    .min(2, 'Please enter your full name.')
    .max(100, 'Name is too long.'),
  
  workEmail: z
    .string()
    .email('Please enter a valid work email address.')
    .max(255, 'Email is too long.'),
  
  phone: z
    .string()
    .max(50, 'Phone number is too long.')
    .optional(),
  
  companyName: z
    .string()
    .min(2, 'Please enter your company or contracting firm name.')
    .max(255, 'Company name is too long.'),
  
  companySize: z.enum(['1-10', '11-50', '51-200', '200+'], {
    errorMap: () => ({ message: 'Please select your approximate company size.' }),
  }),
  
  country: z
    .string()
    .min(1, 'Please select your operating country.')
    .max(100, 'Country name is too long.'),
  
  intent: z.enum(['trial', 'demo', 'pricing', 'subcontractor', 'other'], {
    errorMap: () => ({ message: 'Please select how we can help you.' }),
  }),
  
  message: z
    .string()
    .min(10, 'Please write at least one sentence about your current projects.')
    .max(2000, 'Message is too long. Please keep it under 2000 characters.'),
  
  // Honeypot field for spam detection
  honeyPot: z
    .string()
    .max(0, 'Spam detected.')
    .optional(),
});

export type ContactSubmitDto = z.infer<typeof contactSubmitSchema>;

// ─── OpenAPI Spec ──────────────────────────────────────────────────────────────
export const contactApiSpec = {
  '/api/contact/submit': {
    post: {
      tags: ['Contact'],
      summary: 'Submit contact or demo request',
      description: 'Submit a contact form for demo requests, trial signups, pricing inquiries, or general questions.',
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              required: ['name', 'workEmail', 'companyName', 'companySize', 'country', 'intent', 'message'],
              properties: {
                name: {
                  type: 'string',
                  minLength: 2,
                  maxLength: 100,
                  example: 'Tariq Mehmood',
                },
                workEmail: {
                  type: 'string',
                  format: 'email',
                  example: 'tariq@contractors.com',
                },
                phone: {
                  type: 'string',
                  maxLength: 50,
                  example: '+92 300 1234567',
                },
                companyName: {
                  type: 'string',
                  minLength: 2,
                  maxLength: 255,
                  example: 'Mehmood Civil Construction',
                },
                companySize: {
                  type: 'string',
                  enum: ['1-10', '11-50', '51-200', '200+'],
                  example: '11-50',
                },
                country: {
                  type: 'string',
                  example: 'Pakistan',
                },
                intent: {
                  type: 'string',
                  enum: ['trial', 'demo', 'pricing', 'subcontractor', 'other'],
                  example: 'demo',
                },
                message: {
                  type: 'string',
                  minLength: 10,
                  maxLength: 2000,
                  example: 'We have 2 commercial plazas and 3 villas under construction. Looking to replace Excel for BOQs and daily field logs.',
                },
                honeyPot: {
                  type: 'string',
                  maxLength: 0,
                  description: 'Spam detection field - must be empty',
                },
              },
            },
          },
        },
      },
      responses: {
        200: {
          description: 'Contact request submitted successfully',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  success: {
                    type: 'boolean',
                    example: true,
                  },
                  requestId: {
                    type: 'string',
                    example: 'V1StGXR8_Z5jdHi6B-myT',
                  },
                  message: {
                    type: 'string',
                    example: 'Thank you! We will reach out within one business day to schedule your demo.',
                  },
                },
              },
            },
          },
        },
        400: {
          description: 'Validation error',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  error: {
                    type: 'string',
                    example: 'Please enter a valid work email address.',
                  },
                  errors: {
                    type: 'array',
                    items: {
                      type: 'object',
                      properties: {
                        path: { type: 'string' },
                        message: { type: 'string' },
                      },
                    },
                  },
                },
              },
            },
          },
        },
        429: {
          description: 'Rate limit exceeded',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  error: {
                    type: 'string',
                    example: 'You have recently submitted a request. Please wait before submitting again.',
                  },
                },
              },
            },
          },
        },
      },
    },
  },
};
