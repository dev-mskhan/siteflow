import type { FastifyPluginAsync } from 'fastify';
import { requireProjectPermission } from '../core/project.middleware.js';
import {
  handleApproveBoq,
  handleCommitBoqImport,
  handleCreateBoq,
  handleExportBoqCsv,
  handleGetBoq,
  handleGetBoqRevision,
  handleListBoqRevisions,
  handleListBoqs,
  handleLockBoq,
  handleMapBoqItem,
  handlePreviewBoqImport,
  handleReviseBoq,
  handleSubmitBoq,
} from './boq.handler.js';

const base = '/:organizationId/projects/:projectId/boqs';

export const projectBoqRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.post(base, {
    preHandler: [requireProjectPermission('project.boq.create')],
  }, handleCreateBoq);
  fastify.get(base, {
    preHandler: [requireProjectPermission('project.boq.read')],
  }, handleListBoqs);
  fastify.get(`${base}/:boqId`, {
    preHandler: [requireProjectPermission('project.boq.read')],
  }, handleGetBoq);
  fastify.post(`${base}/:boqId/revisions`, {
    preHandler: [requireProjectPermission('project.boq.update')],
  }, handleReviseBoq);
  fastify.get(`${base}/:boqId/revisions`, {
    preHandler: [requireProjectPermission('project.boq.read')],
  }, handleListBoqRevisions);
  fastify.get(`${base}/:boqId/revisions/:revisionId`, {
    preHandler: [requireProjectPermission('project.boq.read')],
  }, handleGetBoqRevision);
  fastify.post(`${base}/:boqId/imports/preview`, {
    preHandler: [requireProjectPermission('project.boq.import')],
  }, handlePreviewBoqImport);
  fastify.post(`${base}/:boqId/imports/commit`, {
    preHandler: [requireProjectPermission('project.boq.import')],
  }, handleCommitBoqImport);
  fastify.post(`${base}/:boqId/submit`, {
    preHandler: [requireProjectPermission('project.boq.update')],
  }, handleSubmitBoq);
  fastify.post(`${base}/:boqId/approve`, {
    preHandler: [requireProjectPermission('project.boq.approve')],
  }, handleApproveBoq);
  fastify.post(`${base}/:boqId/lock`, {
    preHandler: [requireProjectPermission('project.boq.approve')],
  }, handleLockBoq);
  fastify.put(`${base}/:boqId/items/:itemId/mapping`, {
    preHandler: [requireProjectPermission('project.boq.map')],
  }, handleMapBoqItem);
  fastify.get(`${base}/:boqId/export`, {
    preHandler: [requireProjectPermission('project.boq.export')],
  }, handleExportBoqCsv);
};
