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
import { boqRouteDocs } from './boq.schemas.js';

const base = '/:organizationId/projects/:projectId/boqs';

export const projectBoqRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.post(base, {
    schema: boqRouteDocs.create,
    preHandler: [requireProjectPermission('project.boq.create')],
  }, handleCreateBoq);
  fastify.get(base, {
    schema: boqRouteDocs.list,
    preHandler: [requireProjectPermission('project.boq.read')],
  }, handleListBoqs);
  fastify.get(`${base}/:boqId`, {
    schema: boqRouteDocs.get,
    preHandler: [requireProjectPermission('project.boq.read')],
  }, handleGetBoq);
  fastify.post(`${base}/:boqId/revisions`, {
    schema: boqRouteDocs.revise,
    preHandler: [requireProjectPermission('project.boq.update')],
  }, handleReviseBoq);
  fastify.get(`${base}/:boqId/revisions`, {
    schema: boqRouteDocs.listRevisions,
    preHandler: [requireProjectPermission('project.boq.read')],
  }, handleListBoqRevisions);
  fastify.get(`${base}/:boqId/revisions/:revisionId`, {
    schema: boqRouteDocs.getRevision,
    preHandler: [requireProjectPermission('project.boq.read')],
  }, handleGetBoqRevision);
  fastify.post(`${base}/:boqId/imports/preview`, {
    schema: boqRouteDocs.previewImport,
    preHandler: [requireProjectPermission('project.boq.import')],
  }, handlePreviewBoqImport);
  fastify.post(`${base}/:boqId/imports/commit`, {
    schema: boqRouteDocs.commitImport,
    preHandler: [requireProjectPermission('project.boq.import')],
  }, handleCommitBoqImport);
  fastify.post(`${base}/:boqId/submit`, {
    schema: boqRouteDocs.submit,
    preHandler: [requireProjectPermission('project.boq.update')],
  }, handleSubmitBoq);
  fastify.post(`${base}/:boqId/approve`, {
    schema: boqRouteDocs.approve,
    preHandler: [requireProjectPermission('project.boq.approve')],
  }, handleApproveBoq);
  fastify.post(`${base}/:boqId/lock`, {
    schema: boqRouteDocs.lock,
    preHandler: [requireProjectPermission('project.boq.approve')],
  }, handleLockBoq);
  fastify.put(`${base}/:boqId/items/:itemId/mapping`, {
    schema: boqRouteDocs.mapItem,
    preHandler: [requireProjectPermission('project.boq.map')],
  }, handleMapBoqItem);
  fastify.get(`${base}/:boqId/export`, {
    schema: boqRouteDocs.exportCsv,
    preHandler: [requireProjectPermission('project.boq.export')],
  }, handleExportBoqCsv);
};
