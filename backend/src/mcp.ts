import express from 'express';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { z } from 'zod';
import dotenv from 'dotenv';

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
  }, async ({ userEmail }) => {
    try {
      const { id } = await api(`/auth/lookup?email=${encodeURIComponent(userEmail)}`);
      const tasks = await api('/tasks', { headers: { 'x-admin-user-id': id } as any });
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
  }, async ({ userEmail, title, description, visibility }) => {
    try {
      const { id } = await api(`/auth/lookup?email=${encodeURIComponent(userEmail)}`);
      const task = await api('/tasks', {
        method: 'POST',
        headers: { 'x-admin-user-id': id } as any,
        body: JSON.stringify({ title, description, visibility }),
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
  console.log('API_URL:', API_URL);
  console.log('ADMIN_API_KEY:', ADMIN_KEY ? '***set***' : 'NOT SET');

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
