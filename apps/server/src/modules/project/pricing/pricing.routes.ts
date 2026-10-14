import type { FastifyPluginAsync } from 'fastify';
import { requireProjectPermission } from '../core/project.middleware.js';
import {
  handleApproveRateVersion,
  handleCreateRateVersion,
  handleGetRateVersion,
  handleListRateVersions,
  handleResolveRate,
  handleRetireRateVersion,
} from './pricing.handler.js';
import { pricingRouteDocs } from './pricing.schemas.js';

const base = '/:organizationId/projects/:projectId/pricing';
const rate = `${base}/rates/:rateId`;

export const projectPricingRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.post(`${base}/rates`, {
    schema: pricingRouteDocs.create,
    preHandler: [requireProjectPermission('project.pricing.manage')],
  }, handleCreateRateVersion);
  fastify.get(`${base}/rates`, {
    schema: pricingRouteDocs.list,
    preHandler: [requireProjectPermission('project.pricing.read')],
  }, handleListRateVersions);
  fastify.get(rate, {
    schema: pricingRouteDocs.get,
    preHandler: [requireProjectPermission('project.pricing.read')],
  }, handleGetRateVersion);
  fastify.post(`${rate}/approve`, {
    schema: pricingRouteDocs.approve,
    preHandler: [requireProjectPermission('project.pricing.approve')],
  }, handleApproveRateVersion);
  fastify.post(`${rate}/retire`, {
    schema: pricingRouteDocs.retire,
    preHandler: [requireProjectPermission('project.pricing.manage')],
  }, handleRetireRateVersion);
  fastify.get(`${base}/resolve`, {
    schema: pricingRouteDocs.resolve,
    preHandler: [requireProjectPermission('project.pricing.read')],
  }, handleResolveRate);
};
