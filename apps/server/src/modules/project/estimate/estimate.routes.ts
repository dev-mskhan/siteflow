import type { FastifyPluginAsync } from 'fastify';
import { requireProjectPermission } from '../core/project.middleware.js';
import {
  handleApproveEstimate,
  handleCompareEstimate,
  handleCreateEstimate,
  handleGetEstimate,
  handleListEstimates,
  handleRejectEstimate,
  handleSubmitEstimate,
  handleUpdateEstimate,
} from './estimate.handler.js';

const base = '/:organizationId/projects/:projectId/estimates';

export const projectEstimateRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.post(base, {
    preHandler: [requireProjectPermission('project.estimate.create')],
  }, handleCreateEstimate);
  fastify.get(base, {
    preHandler: [requireProjectPermission('project.estimate.read')],
  }, handleListEstimates);
  fastify.get(`${base}/:estimateId`, {
    preHandler: [requireProjectPermission('project.estimate.read')],
  }, handleGetEstimate);
  fastify.patch(`${base}/:estimateId`, {
    preHandler: [requireProjectPermission('project.estimate.update')],
  }, handleUpdateEstimate);
  fastify.get(`${base}/:estimateId/compare`, {
    preHandler: [requireProjectPermission('project.estimate.actuals.read')],
  }, handleCompareEstimate);
  fastify.post(`${base}/:estimateId/submit`, {
    preHandler: [requireProjectPermission('project.estimate.submit')],
  }, handleSubmitEstimate);
  fastify.post(`${base}/:estimateId/approve`, {
    preHandler: [requireProjectPermission('project.estimate.review')],
  }, handleApproveEstimate);
  fastify.post(`${base}/:estimateId/reject`, {
    preHandler: [requireProjectPermission('project.estimate.review')],
  }, handleRejectEstimate);
};
