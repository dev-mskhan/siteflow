// apps/server/src/modules/auth/docs/auth.schemas.ts
// OpenAPI / Swagger JSON-Schema definitions for the auth module.
// Each route in auth.routes.ts imports its schema object from here.
// Fastify uses these for request/response validation and Swagger UI display.

// ─── Reusable component schemas ───────────────────────────────────────────────

const errorDetailSchema = {
  type: 'object',
  properties: {
    code: { type: 'string', example: 'UNAUTHORIZED' },
    message: { type: 'string', example: 'Authentication token missing' },
    requestId: { type: 'string', example: 'uuid-request-id' },
  },
  required: ['code', 'message'],
} as const;

const apiErrorSchema = {
  type: 'object',
  properties: {
    success: { type: 'boolean', enum: [false], example: false },
    error: errorDetailSchema,
  },
  required: ['success', 'error'],
} as const;

const userSchema = {
  type: 'object',
  properties: {
    id: { type: 'string', example: 'usr_01J9Z0F8QPXKMPQ1VRFP1D5K3B' },
    email: { type: 'string', format: 'email', example: 'jane@example.com' },
    firstName: { type: 'string', example: 'Jane' },
    lastName: { type: 'string', nullable: true, example: 'Doe' },
    status: { type: 'string', enum: ['ACTIVE', 'INACTIVE', 'SUSPENDED'], example: 'ACTIVE' },
    emailVerifiedAt: { type: 'string', format: 'date-time', nullable: true, example: '2024-01-15T10:30:00.000Z' },
    lastLoginAt: { type: 'string', format: 'date-time', nullable: true, example: '2024-01-15T10:30:00.000Z' },
    createdAt: { type: 'string', format: 'date-time', example: '2024-01-01T00:00:00.000Z' },
    updatedAt: { type: 'string', format: 'date-time', example: '2024-01-15T10:30:00.000Z' },
  },
  required: ['id', 'email', 'firstName', 'status'],
} as const;

const sessionSchema = {
  type: 'object',
  properties: {
    id: { type: 'string', example: 'ses_01J9Z0F8QPXKMPQ1VRFP1D5K3C' },
    userId: { type: 'string', example: 'usr_01J9Z0F8QPXKMPQ1VRFP1D5K3B' },
    ipAddress: { type: 'string', nullable: true, example: '192.168.1.100' },
    userAgent: { type: 'string', nullable: true, example: 'Mozilla/5.0 (Macintosh; ...)' },
    lastUsedAt: { type: 'string', format: 'date-time', example: '2024-01-15T10:30:00.000Z' },
    expiresAt: { type: 'string', format: 'date-time', example: '2024-02-15T10:30:00.000Z' },
    isCurrent: { type: 'boolean', example: true },
    createdAt: { type: 'string', format: 'date-time', example: '2024-01-01T00:00:00.000Z' },
  },
  required: ['id', 'userId', 'expiresAt', 'createdAt'],
} as const;

// ─── Common response wrappers ─────────────────────────────────────────────────

const authTokensResponse = (description: string) => ({
  type: 'object',
  description,
  properties: {
    success: { type: 'boolean', enum: [true], example: true },
    data: {
      type: 'object',
      properties: {
        user: userSchema,
      },
      required: ['user'],
    },
    meta: {
      type: 'object',
      properties: { timestamp: { type: 'string', format: 'date-time' } },
    },
  },
  required: ['success', 'data'],
});

const messageResponse = (msg: string) => ({
  type: 'object',
  properties: {
    success: { type: 'boolean', enum: [true], example: true },
    data: {
      type: 'object',
      properties: { message: { type: 'string', example: msg } },
      required: ['message'],
    },
    meta: {
      type: 'object',
      properties: { timestamp: { type: 'string', format: 'date-time' } },
    },
  },
  required: ['success', 'data'],
});

const responses = {
  400: { description: 'Bad request', ...apiErrorSchema },
  401: { description: 'Unauthorized', ...apiErrorSchema },
  403: { description: 'Forbidden', ...apiErrorSchema },
  404: { description: 'Not found', ...apiErrorSchema },
  409: { description: 'Conflict (e.g. email already taken)', ...apiErrorSchema },
  422: { description: 'Validation error', ...apiErrorSchema },
  429: { description: 'Too many requests', ...apiErrorSchema },
  500: { description: 'Internal server error', ...apiErrorSchema },
} as const;

// ─── Route schemas ────────────────────────────────────────────────────────────

export const registerSchema = {
  tags: ['auth'],
  summary: 'Register a new user account',
  description: 'Creates a new user, sends email verification, and returns JWT + refresh token as HttpOnly cookies.',
  body: {
    type: 'object',
    required: ['email', 'password', 'firstName'],
    properties: {
      email: { type: 'string', format: 'email', example: 'jane@example.com' },
      password: { type: 'string', minLength: 8, description: 'Min 8 chars, must include uppercase, number, and special character', example: 'Secret123!' },
      firstName: { type: 'string', minLength: 1, example: 'Jane' },
      lastName: { type: 'string', minLength: 1, nullable: true, example: 'Doe' },
    },
  },
  response: {
    201: authTokensResponse('User registered successfully'),
    409: { description: 'Email already in use', ...apiErrorSchema },
    422: responses[422],
    500: responses[500],
  },
};

export const loginSchema = {
  tags: ['auth'],
  summary: 'Login with email and password',
  description: 'Authenticates user credentials and returns JWT + refresh token as HttpOnly cookies. Rate limited to 5 attempts per 15 minutes.',
  body: {
    type: 'object',
    required: ['email', 'password'],
    properties: {
      email: { type: 'string', format: 'email', example: 'jane@example.com' },
      password: { type: 'string', example: 'Secret123!' },
    },
  },
  response: {
    200: authTokensResponse('Login successful'),
    401: { description: 'Invalid credentials', ...apiErrorSchema },
    422: responses[422],
    429: { description: 'Too many login attempts', ...apiErrorSchema },
  },
};

export const googleAuthSchema = {
  tags: ['auth'],
  summary: 'Get Google OAuth 2.0 Authorization URL',
  description: 'Returns the Google OAuth login consent URL for client redirection.',
  response: {
    200: {
      type: 'object',
      properties: {
        success: { type: 'boolean', enum: [true], example: true },
        data: {
          type: 'object',
          properties: {
            url: { type: 'string', example: 'https://accounts.google.com/o/oauth2/v2/auth?...' },
          },
          required: ['url'],
        },
        meta: { type: 'object', properties: { timestamp: { type: 'string' } } },
      },
    },
    422: responses[422],
  },
};

export const googleCallbackSchema = {
  tags: ['auth'],
  summary: 'Google OAuth 2.0 Callback',
  description: 'Exchanges the authorization code from Google for user profile & tokens. Creates or links account and sets HttpOnly cookies.',
  querystring: {
    type: 'object',
    required: ['code'],
    properties: {
      code: { type: 'string', description: 'Authorization code returned by Google OAuth prompt', example: '4/0AVG7fi...' },
    },
  },
  response: {
    200: authTokensResponse('Google OAuth login successful'),
    400: responses[400],
    422: responses[422],
  },
};

export const refreshSchema = {
  tags: ['auth'],
  summary: 'Refresh access token',
  description: 'Uses the refresh_token HttpOnly signed cookie to issue new signed cookies.',
  response: {
    200: messageResponse('Token refreshed successfully'),
    401: responses[401],
  },
};

export const logoutSchema = {
  tags: ['auth'],
  summary: 'Logout current session',
  description: 'Revokes the current session and clears auth cookies. Requires authentication.',
  security: [{ bearerAuth: [] }],
  response: {
    200: messageResponse('Logged out successfully'),
    401: responses[401],
  },
};

export const verifyEmailSchema = {
  tags: ['auth'],
  summary: 'Verify email address',
  description: 'Verifies the email using the one-time token sent to the user\'s inbox.',
  body: {
    type: 'object',
    required: ['token'],
    properties: {
      token: { type: 'string', example: 'a1b2c3d4e5f6...64-char-hex-token' },
    },
  },
  response: {
    200: messageResponse('Email verified successfully'),
    400: { description: 'Token expired or already used', ...apiErrorSchema },
    422: responses[422],
  },
};

export const resendVerificationSchema = {
  tags: ['auth'],
  summary: 'Resend email verification',
  description: 'Re-sends the verification email. Response is always 200 regardless of whether the email exists (to prevent enumeration).',
  body: {
    type: 'object',
    required: ['email'],
    properties: {
      email: { type: 'string', format: 'email', example: 'jane@example.com' },
    },
  },
  response: {
    200: messageResponse('If the email exists and is unverified, a verification link has been sent'),
    422: responses[422],
  },
};

export const forgotPasswordSchema = {
  tags: ['auth'],
  summary: 'Request password reset',
  description: 'Sends a password reset link to the email. Always returns 200 to prevent user enumeration.',
  body: {
    type: 'object',
    required: ['email'],
    properties: {
      email: { type: 'string', format: 'email', example: 'jane@example.com' },
    },
  },
  response: {
    200: messageResponse('If an account with that email exists, a password reset link has been sent'),
    422: responses[422],
  },
};

export const resetPasswordSchema = {
  tags: ['auth'],
  summary: 'Reset password using token',
  description: 'Resets the user\'s password using the token from the email. Invalidates all existing sessions.',
  body: {
    type: 'object',
    required: ['token', 'newPassword'],
    properties: {
      token: { type: 'string', example: 'a1b2c3d4e5f6...64-char-hex-token' },
      newPassword: { type: 'string', minLength: 8, example: 'NewSecret123!' },
    },
  },
  response: {
    200: messageResponse('Password reset successfully. Please log in with your new password.'),
    400: { description: 'Token expired or already used', ...apiErrorSchema },
    422: responses[422],
  },
};

export const changePasswordSchema = {
  tags: ['auth'],
  summary: 'Change current password',
  description: 'Changes the authenticated user\'s password. Requires the current password. Clears all sessions after change.',
  security: [{ bearerAuth: [] }],
  body: {
    type: 'object',
    required: ['currentPassword', 'newPassword'],
    properties: {
      currentPassword: { type: 'string', example: 'OldSecret123!' },
      newPassword: { type: 'string', minLength: 8, example: 'NewSecret123!' },
    },
  },
  response: {
    200: messageResponse('Password changed successfully. Please log in again.'),
    401: { description: 'Wrong current password', ...apiErrorSchema },
    422: responses[422],
  },
};

export const getMeSchema = {
  tags: ['auth'],
  summary: 'Get current user profile',
  description: 'Returns the authenticated user\'s profile data.',
  security: [{ bearerAuth: [] }],
  response: {
    200: {
      type: 'object',
      properties: {
        success: { type: 'boolean', enum: [true], example: true },
        data: {
          type: 'object',
          properties: { user: userSchema },
          required: ['user'],
        },
        meta: { type: 'object', properties: { timestamp: { type: 'string' } } },
      },
    },
    401: responses[401],
  },
};

export const getSessionsSchema = {
  tags: ['auth'],
  summary: 'List active sessions',
  description: 'Returns all active (non-revoked, non-expired) sessions for the authenticated user. The current session is flagged.',
  security: [{ bearerAuth: [] }],
  response: {
    200: {
      type: 'object',
      properties: {
        success: { type: 'boolean', enum: [true], example: true },
        data: {
          type: 'object',
          properties: {
            sessions: { type: 'array', items: sessionSchema },
          },
          required: ['sessions'],
        },
        meta: { type: 'object', properties: { timestamp: { type: 'string' } } },
      },
    },
    401: responses[401],
  },
};

export const deleteSessionSchema = {
  tags: ['auth'],
  summary: 'Revoke a specific session',
  description: 'Revokes a session by its ID. Only the owner of the session can revoke it.',
  security: [{ bearerAuth: [] }],
  params: {
    type: 'object',
    required: ['sessionId'],
    properties: {
      sessionId: { type: 'string', description: 'The session ID to revoke', example: 'ses_01J9Z0F8QPXKMPQ1VRFP1D5K3C' },
    },
  },
  response: {
    200: messageResponse('Session revoked successfully'),
    401: responses[401],
    404: { description: 'Session not found', ...apiErrorSchema },
  },
};

export const logoutAllSchema = {
  tags: ['auth'],
  summary: 'Logout all sessions',
  description: 'Revokes all active sessions for the authenticated user across all devices.',
  security: [{ bearerAuth: [] }],
  response: {
    200: {
      type: 'object',
      properties: {
        success: { type: 'boolean', enum: [true], example: true },
        data: {
          type: 'object',
          properties: {
            message: { type: 'string', example: 'Logged out of 3 active session(s)' },
          },
          required: ['message'],
        },
        meta: { type: 'object', properties: { timestamp: { type: 'string' } } },
      },
    },
    401: responses[401],
  },
};
