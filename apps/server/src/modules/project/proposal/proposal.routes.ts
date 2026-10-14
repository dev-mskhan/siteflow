import type { FastifyPluginAsync } from 'fastify';
import { requirePermission } from '../../rbac/permission.middleware.js';
import { requireProjectPermission } from '../core/project.middleware.js';
import {
  handleApproveProposal,
  handleAwardTender,
  handleConvertProposal,
  handleCreateProposal,
  handleCreateTender,
  handleGetProposal,
  handleGetProposalRevision,
  handleGetTender,
  handleIssueProposal,
  handleListClientEvents,
  handleListProposalRevisions,
  handleListProposals,
  handleListTenders,
  handleLostTender,
  handleRecordClientResponse,
  handleRejectProposal,
  handleSubmitProposal,
  handleSubmitTender,
  handleUpdateProposal,
  handleUpdateTender,
  handleWithdrawProposal,
  handleWithdrawTender,
} from './proposal.handler.js';
import {
  createTenderSchemaDoc,
  listTendersSchemaDoc,
  getTenderSchemaDoc,
  updateTenderSchemaDoc,
  submitTenderSchemaDoc,
  awardTenderSchemaDoc,
  lostTenderSchemaDoc,
  withdrawTenderSchemaDoc,
  createProposalSchemaDoc,
  listProposalsSchemaDoc,
  getProposalSchemaDoc,
  updateProposalSchemaDoc,
  submitProposalSchemaDoc,
  approveProposalSchemaDoc,
  rejectProposalSchemaDoc,
  issueProposalSchemaDoc,
  recordClientResponseSchemaDoc,
  withdrawProposalSchemaDoc,
  listProposalRevisionsSchemaDoc,
  getProposalRevisionSchemaDoc,
  listClientEventsSchemaDoc,
  convertProposalSchemaDoc,
} from '../docs/preconstruction.api.schemas.js';

// ── Tender routes (org-scoped — no projectId required) ───────────────────────
const tenderBase = '/:organizationId/tenders';

export const tenderRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.post(tenderBase, {
    schema: createTenderSchemaDoc,
    preHandler: [requirePermission('project:write:any')],
  }, handleCreateTender);

  fastify.get(tenderBase, {
    schema: listTendersSchemaDoc,
    preHandler: [requirePermission('project:read:any')],
  }, handleListTenders);

  fastify.get(`${tenderBase}/:tenderId`, {
    schema: getTenderSchemaDoc,
    preHandler: [requirePermission('project:read:any')],
  }, handleGetTender);

  fastify.patch(`${tenderBase}/:tenderId`, {
    schema: updateTenderSchemaDoc,
    preHandler: [requirePermission('project:write:any')],
  }, handleUpdateTender);

  fastify.post(`${tenderBase}/:tenderId/submit`, {
    schema: submitTenderSchemaDoc,
    preHandler: [requirePermission('project:write:any')],
  }, handleSubmitTender);

  fastify.post(`${tenderBase}/:tenderId/award`, {
    schema: awardTenderSchemaDoc,
    preHandler: [requirePermission('project:write:any')],
  }, handleAwardTender);

  fastify.post(`${tenderBase}/:tenderId/lost`, {
    schema: lostTenderSchemaDoc,
    preHandler: [requirePermission('project:write:any')],
  }, handleLostTender);

  fastify.post(`${tenderBase}/:tenderId/withdraw`, {
    schema: withdrawTenderSchemaDoc,
    preHandler: [requirePermission('project:write:any')],
  }, handleWithdrawTender);
};

// ── Proposal routes (project-scoped) ─────────────────────────────────────────
const proposalBase = '/:organizationId/projects/:projectId/proposals';

export const projectProposalRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.post(proposalBase, {
    schema: createProposalSchemaDoc,
    preHandler: [requireProjectPermission('project.proposal.create')],
  }, handleCreateProposal);

  fastify.get(proposalBase, {
    schema: listProposalsSchemaDoc,
    preHandler: [requireProjectPermission('project.proposal.read')],
  }, handleListProposals);

  fastify.get(`${proposalBase}/:proposalId`, {
    schema: getProposalSchemaDoc,
    preHandler: [requireProjectPermission('project.proposal.read')],
  }, handleGetProposal);

  fastify.patch(`${proposalBase}/:proposalId`, {
    schema: updateProposalSchemaDoc,
    preHandler: [requireProjectPermission('project.proposal.update')],
  }, handleUpdateProposal);

  fastify.post(`${proposalBase}/:proposalId/submit`, {
    schema: submitProposalSchemaDoc,
    preHandler: [requireProjectPermission('project.proposal.submit')],
  }, handleSubmitProposal);

  fastify.post(`${proposalBase}/:proposalId/approve`, {
    schema: approveProposalSchemaDoc,
    preHandler: [requireProjectPermission('project.proposal.approve')],
  }, handleApproveProposal);

  fastify.post(`${proposalBase}/:proposalId/reject`, {
    schema: rejectProposalSchemaDoc,
    preHandler: [requireProjectPermission('project.proposal.approve')],
  }, handleRejectProposal);

  fastify.post(`${proposalBase}/:proposalId/issue`, {
    schema: issueProposalSchemaDoc,
    preHandler: [requireProjectPermission('project.proposal.issue')],
  }, handleIssueProposal);

  fastify.post(`${proposalBase}/:proposalId/respond`, {
    schema: recordClientResponseSchemaDoc,
    preHandler: [requireProjectPermission('project.proposal.respond')],
  }, handleRecordClientResponse);

  fastify.post(`${proposalBase}/:proposalId/withdraw`, {
    schema: withdrawProposalSchemaDoc,
    preHandler: [requireProjectPermission('project.proposal.withdraw')],
  }, handleWithdrawProposal);

  fastify.get(`${proposalBase}/:proposalId/revisions`, {
    schema: listProposalRevisionsSchemaDoc,
    preHandler: [requireProjectPermission('project.proposal.read')],
  }, handleListProposalRevisions);

  fastify.get(`${proposalBase}/:proposalId/revisions/:revisionId`, {
    schema: getProposalRevisionSchemaDoc,
    preHandler: [requireProjectPermission('project.proposal.read')],
  }, handleGetProposalRevision);

  fastify.get(`${proposalBase}/:proposalId/client-events`, {
    schema: listClientEventsSchemaDoc,
    preHandler: [requireProjectPermission('project.proposal.read')],
  }, handleListClientEvents);

  fastify.post(`${proposalBase}/:proposalId/convert`, {
    schema: convertProposalSchemaDoc,
    preHandler: [requireProjectPermission('project.proposal.convert')],
  }, handleConvertProposal);
};
