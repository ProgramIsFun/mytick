import express from 'express';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { z } from 'zod';
import dotenv from 'dotenv';

import { logger } from './utils/logger';

dotenv.config();

const API_URL = process.env.API_URL || 'http://localhost:4000/api';
const ADMIN_KEY = process.env.ADMIN_API_KEY!;

async function api(path: string, options: RequestInit = {}) {
  const res = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      'x-admin-key': ADMIN_KEY,
      ...options.headers,
    },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Request failed' }));
    throw new Error(err.error || `HTTP ${res.status}`);
  }
  return res.json();
}

async function getUserId(email: string): Promise<string> {
  // Use the user tasks endpoint which looks up by userId, so we need a lookup endpoint
  // For now, use a dedicated admin endpoint
  const users = await api(`/auth/lookup?email=${encodeURIComponent(email)}`);
  return users.id;
}

function createServer() {
  const server = new McpServer({ name: 'mytick', version: '1.0.0' });

  server.tool('list_tasks', 'List tasks for a user', {
    userEmail: z.string().describe('Email of the user'),
    status: z.enum(['pending', 'in_progress', 'done']).optional().describe('Filter by status'),
  }, async ({ userEmail, status }) => {
    try {
      const { id } = await api(`/auth/lookup?email=${encodeURIComponent(userEmail)}`);
      const res = await api('/tasks?limit=100', { headers: { 'x-admin-user-id': id } as any });
      const tasks = status ? res.tasks.filter((t: any) => t.status === status) : res.tasks;
      return { content: [{ type: 'text', text: JSON.stringify(tasks, null, 2) }] };
    } catch (e: any) {
      return { content: [{ type: 'text', text: e.message }] };
    }
  });

  server.tool('get_task', 'Get a task by ID', {
    taskId: z.string().describe('Task ID'),
    userEmail: z.string().describe('Email of the requesting user'),
  }, async ({ taskId, userEmail }) => {
    try {
      const { id } = await api(`/auth/lookup?email=${encodeURIComponent(userEmail)}`);
      const task = await api(`/tasks/${taskId}`, { headers: { 'x-admin-user-id': id } as any });
      return { content: [{ type: 'text', text: JSON.stringify(task, null, 2) }] };
    } catch (e: any) {
      return { content: [{ type: 'text', text: e.message }] };
    }
  });

  server.tool('create_task', 'Create a new task', {
    userEmail: z.string().describe('Email of the task owner'),
    title: z.string().describe('Task title'),
    description: z.string().optional().describe('Task description'),
    visibility: z.enum(['private', 'group', 'public']).optional().describe('Task visibility'),
    blockedBy: z.array(z.string()).optional().describe('Array of task IDs this task is blocked by'),
    deadline: z.string().optional().describe('Deadline in ISO 8601 format'),
  }, async ({ userEmail, title, description, visibility, blockedBy, deadline }) => {
    try {
      const { id } = await api(`/auth/lookup?email=${encodeURIComponent(userEmail)}`);
      const task = await api('/tasks', {
        method: 'POST',
        headers: { 'x-admin-user-id': id } as any,
        body: JSON.stringify({ title, description, visibility, blockedBy, deadline }),
      });
      return { content: [{ type: 'text', text: JSON.stringify(task, null, 2) }] };
    } catch (e: any) {
      return { content: [{ type: 'text', text: e.message }] };
    }
  });

  server.tool('update_task', 'Update a task', {
    taskId: z.string().describe('Task ID'),
    userEmail: z.string().describe('Email of the task owner'),
    title: z.string().optional().describe('New title'),
    description: z.string().optional().describe('New description'),
    status: z.enum(['pending', 'in_progress', 'done']).optional().describe('New status'),
    visibility: z.enum(['private', 'group', 'public']).optional().describe('New visibility'),
    blockedBy: z.array(z.string()).optional().describe('Array of task IDs this task is blocked by'),
    deadline: z.string().optional().nullable().describe('Deadline in ISO 8601 format, or null to clear'),
  }, async ({ taskId, userEmail, ...updates }) => {
    try {
      const { id } = await api(`/auth/lookup?email=${encodeURIComponent(userEmail)}`);
      const task = await api(`/tasks/${taskId}`, {
        method: 'PATCH',
        headers: { 'x-admin-user-id': id } as any,
        body: JSON.stringify(updates),
      });
      return { content: [{ type: 'text', text: JSON.stringify(task, null, 2) }] };
    } catch (e: any) {
      return { content: [{ type: 'text', text: e.message }] };
    }
  });

  server.tool('delete_task', 'Delete a task', {
    taskId: z.string().describe('Task ID'),
    userEmail: z.string().describe('Email of the task owner'),
  }, async ({ taskId, userEmail }) => {
    try {
      const { id } = await api(`/auth/lookup?email=${encodeURIComponent(userEmail)}`);
      await api(`/tasks/${taskId}`, { method: 'DELETE', headers: { 'x-admin-user-id': id } as any });
      return { content: [{ type: 'text', text: 'Deleted' }] };
    } catch (e: any) {
      return { content: [{ type: 'text', text: e.message }] };
    }
  });

  server.tool('search_tasks', 'Search tasks by title', {
    userEmail: z.string().describe('Email of the user'),
    query: z.string().describe('Search query to match against task titles'),
  }, async ({ userEmail, query }) => {
    try {
      const { id } = await api(`/auth/lookup?email=${encodeURIComponent(userEmail)}`);
      const res = await api('/tasks?limit=100', { headers: { 'x-admin-user-id': id } as any });
      const tasks = res.tasks.filter((t: any) => t.title.toLowerCase().includes(query.toLowerCase()));
      return { content: [{ type: 'text', text: JSON.stringify(tasks, null, 2) }] };
    } catch (e: any) {
      return { content: [{ type: 'text', text: e.message }] };
    }
  });

  server.tool('get_blocking', 'Get tasks that are blocked by a specific task', {
    taskId: z.string().describe('Task ID'),
    userEmail: z.string().describe('Email of the user'),
  }, async ({ taskId, userEmail }) => {
    try {
      const { id } = await api(`/auth/lookup?email=${encodeURIComponent(userEmail)}`);
      const tasks = await api(`/tasks/${taskId}/blocking`, { headers: { 'x-admin-user-id': id } as any });
      return { content: [{ type: 'text', text: JSON.stringify(tasks, null, 2) }] };
    } catch (e: any) {
      return { content: [{ type: 'text', text: e.message }] };
    }
  });

  server.tool('list_groups', 'List groups for a user', {
    userEmail: z.string().describe('Email of the user'),
  }, async ({ userEmail }) => {
    try {
      const { id } = await api(`/auth/lookup?email=${encodeURIComponent(userEmail)}`);
      const groups = await api('/groups', { headers: { 'x-admin-user-id': id } as any });
      return { content: [{ type: 'text', text: JSON.stringify(groups, null, 2) }] };
    } catch (e: any) {
      return { content: [{ type: 'text', text: e.message }] };
    }
  });

  server.tool('create_group', 'Create a new group', {
    userEmail: z.string().describe('Email of the group owner'),
    name: z.string().describe('Group name'),
  }, async ({ userEmail, name }) => {
    try {
      const { id } = await api(`/auth/lookup?email=${encodeURIComponent(userEmail)}`);
      const group = await api('/groups', {
        method: 'POST',
        headers: { 'x-admin-user-id': id } as any,
        body: JSON.stringify({ name }),
      });
      return { content: [{ type: 'text', text: JSON.stringify(group, null, 2) }] };
    } catch (e: any) {
      return { content: [{ type: 'text', text: e.message }] };
    }
  });

  return server;
}

const MCP_PORT = Number(process.env.MCP_PORT) || 3100;

async function main() {
  logger.info({ apiUrl: API_URL, adminKey: ADMIN_KEY ? '***set***' : 'NOT SET' }, 'MCP config');

  const app = express();

  app.post('/mcp', async (req, res) => {
    const server = createServer();
    const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });
    res.on('close', () => { transport.close(); server.close(); });
    await server.connect(transport);
    await transport.handleRequest(req, res);
  });

  app.get('/mcp', async (_req, res) => {
    res.writeHead(405).end(JSON.stringify({ error: 'Method not allowed. Use POST.' }));
  });

  app.delete('/mcp', async (_req, res) => {
    res.writeHead(405).end(JSON.stringify({ error: 'Method not allowed.' }));
  });

  app.listen(MCP_PORT, () => {
    console.log(`MCP server listening on http://localhost:${MCP_PORT}/mcp`);
  });
}

main().catch(console.error);
