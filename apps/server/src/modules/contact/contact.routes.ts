import { type FastifyInstance, type FastifyRequest, type FastifyReply } from 'fastify';
import { createLogger } from '@siteflow/observability/server';
import { ContactService } from './contact.service.js';
import { ContactRepository } from './contact.repository.js';
import { EmailService } from '../../lib/email/email.service.js';
import { contactSubmitSchema } from './docs/contact.schemas.js';

const logger = createLogger({ name: 'contact-routes' });

// Initialize services
const contactRepo = new ContactRepository();
const emailService = new EmailService();
const contactService = new ContactService(contactRepo, emailService);

/**
 * Contact routes plugin
 */
export async function contactRoutes(fastify: FastifyInstance) {
  /**
   * POST /api/contact/submit
   * Submit a contact/demo request
   */
  fastify.post('/submit', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      // Validate request body
      const validationResult = contactSubmitSchema.safeParse(request.body);
      
      if (!validationResult.success) {
        const firstError = validationResult.error.errors[0];
        logger.warn(
          { errors: validationResult.error.errors },
          'Contact form validation failed',
        );
        
        return reply.status(400).send({
          error: firstError?.message || 'Validation failed',
          errors: validationResult.error.errors.map((err) => ({
            path: err.path.join('.'),
            message: err.message,
          })),
        });
      }

      const data = validationResult.data;

      // Check honeypot (spam detection)
      if (data.honeyPot && data.honeyPot.length > 0) {
        logger.warn({ email: data.workEmail }, 'Honeypot triggered - potential spam');
        // Return success to not reveal spam detection
        return reply.status(200).send({
          success: true,
          requestId: 'spam-detected',
          message: 'Thank you! We will be in touch soon.',
        });
      }

      // Extract metadata
      const userAgent = request.headers['user-agent'];
      const ipAddress = (request.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() || 
                        request.socket.remoteAddress;
      const referrerUrl = request.headers['referer'] || request.headers['referrer'];

      // Submit contact request
      const result = await contactService.submitContactRequest({
        ...data,
        userAgent,
        ipAddress,
        referrerUrl: referrerUrl as string | undefined,
      });

      logger.info(
        { requestId: result.requestId, intent: data.intent },
        'Contact request submitted successfully',
      );

      return reply.status(200).send(result);
    } catch (error) {
      logger.error({ err: error }, 'Error submitting contact request');

      // Handle specific errors
      if (error instanceof Error) {
        if (error.message.includes('recently submitted')) {
          return reply.status(429).send({
            error: error.message,
          });
        }
      }

      return reply.status(500).send({
        error: 'An error occurred while submitting your request. Please try again.',
      });
    }
  });

  /**
   * GET /api/contact/health
   * Health check endpoint
   */
  fastify.get('/health', async (_request: FastifyRequest, reply: FastifyReply) => {
    return reply.status(200).send({ status: 'ok', module: 'contact' });
  });
}
