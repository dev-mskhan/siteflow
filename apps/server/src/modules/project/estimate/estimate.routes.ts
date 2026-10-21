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
import { estimateRouteDocs } from './estimate.schemas.js';

const base = '/:organizationId/projects/:projectId/estimates';

export const projectEstimateRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.post(base, {
    schema: estimateRouteDocs.create,
    preHandler: [requireProjectPermission('project.estimate.create')],
  }, handleCreateEstimate);
  fastify.get(base, {
    schema: estimateRouteDocs.list,
    preHandler: [requireProjectPermission('project.estimate.read')],
  }, handleListEstimates);
  fastify.get(`${base}/:estimateId`, {
    schema: estimateRouteDocs.get,
    preHandler: [requireProjectPermission('project.estimate.read')],
  }, handleGetEstimate);
  fastify.patch(`${base}/:estimateId`, {
    schema: estimateRouteDocs.update,
    preHandler: [requireProjectPermission('project.estimate.update')],
  }, handleUpdateEstimate);
  fastify.get(`${base}/:estimateId/compare`, {
    schema: estimateRouteDocs.compare,
    preHandler: [requireProjectPermission('project.estimate.actuals.read')],
  }, handleCompareEstimate);
  fastify.post(`${base}/:estimateId/submit`, {
    schema: estimateRouteDocs.submit,
    preHandler: [requireProjectPermission('project.estimate.submit')],
  }, handleSubmitEstimate);
  fastify.post(`${base}/:estimateId/approve`, {
    schema: estimateRouteDocs.approve,
    preHandler: [requireProjectPermission('project.estimate.review')],
  }, handleApproveEstimate);
  fastify.post(`${base}/:estimateId/reject`, {
    schema: estimateRouteDocs.reject,
    preHandler: [requireProjectPermission('project.estimate.review')],
  }, handleRejectEstimate);
};
