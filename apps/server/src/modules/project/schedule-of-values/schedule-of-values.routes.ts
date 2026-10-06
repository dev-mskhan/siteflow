import type { FastifyPluginAsync } from 'fastify';
import { requireProjectPermission } from '../core/project.middleware.js';
import {
  handleApproveScheduleOfValues,
  handleCreateScheduleOfValues,
  handleGetScheduleOfValues,
  handleListScheduleOfValues,
  handleScheduleOfValuesProgress,
  handleSubmitScheduleOfValues,
  handleUpdateScheduleOfValues,
} from './schedule-of-values.handler.js';

const base = '/:organizationId/projects/:projectId/schedule-of-values';
const params = {
  type: 'object',
  required: ['organizationId', 'projectId'],
  properties: {
    organizationId: { type: 'string' },
    projectId: { type: 'string' },
    scheduleOfValuesId: { type: 'string' },
  },
} as const;
const body = {
  type: 'object',
  required: ['expectedVersion'],
  properties: { expectedVersion: { type: 'integer', minimum: 1 } },
} as const;
const response = { type: 'object', additionalProperties: true } as const;

export const scheduleOfValuesRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.post(base, {
    schema: { tags: ['commercial'], summary: 'Create a schedule of values', params, response: { 201: response } },
    preHandler: [requireProjectPermission('project.schedule_of_values.create')],
  }, handleCreateScheduleOfValues);
  fastify.get(base, {
    schema: { tags: ['commercial'], summary: 'List project schedules of values', params, response: { 200: response } },
    preHandler: [requireProjectPermission('project.schedule_of_values.read')],
  }, handleListScheduleOfValues);
  fastify.get(`${base}/:scheduleOfValuesId`, {
    schema: { tags: ['commercial'], summary: 'Get a schedule of values', params, response: { 200: response } },
    preHandler: [requireProjectPermission('project.schedule_of_values.read')],
  }, handleGetScheduleOfValues);
  fastify.patch(`${base}/:scheduleOfValuesId`, {
    schema: { tags: ['commercial'], summary: 'Update a schedule-of-values revision', params, response: { 200: response } },
    preHandler: [requireProjectPermission('project.schedule_of_values.update')],
  }, handleUpdateScheduleOfValues);
  fastify.post(`${base}/:scheduleOfValuesId/submit`, {
    schema: { tags: ['commercial'], summary: 'Submit a schedule-of-values revision', params, body, response: { 200: response } },
    preHandler: [requireProjectPermission('project.schedule_of_values.submit')],
  }, handleSubmitScheduleOfValues);
  fastify.post(`${base}/:scheduleOfValuesId/approve`, {
    schema: { tags: ['commercial'], summary: 'Approve a schedule-of-values revision', params, body, response: { 200: response } },
    preHandler: [requireProjectPermission('project.schedule_of_values.approve')],
  }, handleApproveScheduleOfValues);
  fastify.get(`${base}/:scheduleOfValuesId/progress`, {
    schema: { tags: ['commercial'], summary: 'Read schedule-of-values progress', params, response: { 200: response } },
    preHandler: [requireProjectPermission('project.schedule_of_values.read')],
  }, handleScheduleOfValuesProgress);
};
