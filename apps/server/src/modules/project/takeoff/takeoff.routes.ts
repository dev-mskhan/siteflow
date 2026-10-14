import type { FastifyPluginAsync } from 'fastify';
import { requireProjectPermission } from '../core/project.middleware.js';
import {
  handleApproveTakeoffSheet,
  handleCompareTakeoffRevisions,
  handleCreateTakeoffMeasurement,
  handleCreateTakeoffRevision,
  handleCreateTakeoffSheet,
  handleCreateTakeoffSource,
  handleGetTakeoffSheet,
  handleListTakeoffMeasurements,
  handleListTakeoffRevisions,
  handleListTakeoffSheets,
  handleListTakeoffSources,
  handlePreviewTakeoffFormula,
  handleRejectTakeoffSheet,
  handleSubmitTakeoffSheet,
  handleTakeoffSummary,
  handleUpdateTakeoffMeasurement,
  handleUpdateTakeoffSheet,
} from './takeoff.handler.js';
import { takeoffRouteDocs } from './takeoff.schemas.js';

const base = '/:organizationId/projects/:projectId/takeoffs';
const sheet = `${base}/sheets/:sheetId`;

export const projectTakeoffRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.post(`${base}/sheets`, {
    schema: takeoffRouteDocs.create,
    preHandler: [requireProjectPermission('project.takeoff.create')],
  }, handleCreateTakeoffSheet);
  fastify.get(`${base}/sheets`, {
    schema: takeoffRouteDocs.list,
    preHandler: [requireProjectPermission('project.takeoff.read')],
  }, handleListTakeoffSheets);
  fastify.get(`${sheet}`, {
    schema: takeoffRouteDocs.get,
    preHandler: [requireProjectPermission('project.takeoff.read')],
  }, handleGetTakeoffSheet);
  fastify.patch(`${sheet}`, {
    schema: takeoffRouteDocs.update,
    preHandler: [requireProjectPermission('project.takeoff.update')],
  }, handleUpdateTakeoffSheet);
  fastify.post(`${sheet}/submit`, {
    schema: takeoffRouteDocs.transition,
    preHandler: [requireProjectPermission('project.takeoff.submit')],
  }, handleSubmitTakeoffSheet);
  fastify.post(`${sheet}/approve`, {
    schema: takeoffRouteDocs.transition,
    preHandler: [requireProjectPermission('project.takeoff.approve')],
  }, handleApproveTakeoffSheet);
  fastify.post(`${sheet}/reject`, {
    schema: takeoffRouteDocs.reject,
    preHandler: [requireProjectPermission('project.takeoff.approve')],
  }, handleRejectTakeoffSheet);
  fastify.post(`${sheet}/revisions`, {
    schema: takeoffRouteDocs.createRevision,
    preHandler: [requireProjectPermission('project.takeoff.revise')],
  }, handleCreateTakeoffRevision);
  fastify.get(`${sheet}/revisions`, {
    schema: takeoffRouteDocs.listRevisions,
    preHandler: [requireProjectPermission('project.takeoff.read')],
  }, handleListTakeoffRevisions);
  fastify.get(`${sheet}/revisions/compare`, {
    schema: takeoffRouteDocs.compareRevisions,
    preHandler: [requireProjectPermission('project.takeoff.read')],
  }, handleCompareTakeoffRevisions);
  fastify.get(`${sheet}/measurements`, {
    schema: takeoffRouteDocs.listMeasurements,
    preHandler: [requireProjectPermission('project.takeoff.read')],
  }, handleListTakeoffMeasurements);
  fastify.post(`${sheet}/measurements`, {
    schema: takeoffRouteDocs.createMeasurement,
    preHandler: [requireProjectPermission('project.takeoff.measure')],
  }, handleCreateTakeoffMeasurement);
  fastify.patch(`${sheet}/measurements/:measurementId`, {
    schema: takeoffRouteDocs.updateMeasurement,
    preHandler: [requireProjectPermission('project.takeoff.measure')],
  }, handleUpdateTakeoffMeasurement);
  fastify.get(`${sheet}/sources`, {
    schema: takeoffRouteDocs.listSources,
    preHandler: [requireProjectPermission('project.takeoff.read')],
  }, handleListTakeoffSources);
  fastify.post(`${sheet}/sources`, {
    schema: takeoffRouteDocs.createSource,
    preHandler: [requireProjectPermission('project.takeoff.source')],
  }, handleCreateTakeoffSource);
  fastify.post(`${base}/formulas/preview`, {
    schema: takeoffRouteDocs.previewFormula,
    preHandler: [requireProjectPermission('project.takeoff.measure')],
  }, handlePreviewTakeoffFormula);
  fastify.get(`${base}/summary`, {
    schema: takeoffRouteDocs.summary,
    preHandler: [requireProjectPermission('project.takeoff.read')],
  }, handleTakeoffSummary);
};
