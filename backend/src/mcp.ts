import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { nanoid } from 'nanoid';
import Task from './models/Task';
import Group from './models/Group';
import User from './models/User';

dotenv.config();

const server = new McpServer({
  name: 'mytick',
  version: '1.0.0',
});

// --- Tasks ---

server.tool('list_tasks', 'List tasks for a user', {
  userEmail: z.string().describe('Email of the user'),
}, async ({ userEmail }) => {
  const user = await User.findOne({ email: userEmail });
  if (!user) return { content: [{ type: 'text', text: 'User not found' }] };

  const userGroups = await Group.find({ 'members.userId': user._id }).select('_id');
  const groupIds = userGroups.map(g => g._id);

  const tasks = await Task.find({
    $or: [
      { userId: user._id },
      { visibility: 'group', groupIds: { $in: groupIds } },
    ],
  }).sort({ createdAt: -1 });

  return { content: [{ type: 'text', text: JSON.stringify(tasks, null, 2) }] };
});

server.tool('get_task', 'Get a task by ID', {
  taskId: z.string().describe('Task ID'),
}, async ({ taskId }) => {
  const task = await Task.findById(taskId);
  if (!task) return { content: [{ type: 'text', text: 'Task not found' }] };
  return { content: [{ type: 'text', text: JSON.stringify(task, null, 2) }] };
});

server.tool('create_task', 'Create a new task', {
  userEmail: z.string().describe('Email of the task owner'),
  title: z.string().describe('Task title'),
  description: z.string().optional().describe('Task description'),
  visibility: z.enum(['private', 'group', 'public']).optional().describe('Task visibility'),
}, async ({ userEmail, title, description, visibility }) => {
  const user = await User.findOne({ email: userEmail });
  if (!user) return { content: [{ type: 'text', text: 'User not found' }] };

  const task = await Task.create({
    userId: user._id,
    title,
    description: description || '',
    visibility: visibility || 'private',
    groupIds: [],
    shareToken: nanoid(12),
  });

  return { content: [{ type: 'text', text: JSON.stringify(task, null, 2) }] };
});

server.tool('update_task', 'Update a task', {
  taskId: z.string().describe('Task ID'),
  title: z.string().optional().describe('New title'),
  description: z.string().optional().describe('New description'),
  status: z.enum(['pending', 'in_progress', 'done']).optional().describe('New status'),
  visibility: z.enum(['private', 'group', 'public']).optional().describe('New visibility'),
}, async ({ taskId, ...updates }) => {
  const task = await Task.findById(taskId);
  if (!task) return { content: [{ type: 'text', text: 'Task not found' }] };

  for (const [key, value] of Object.entries(updates)) {
    if (value !== undefined) (task as any)[key] = value;
  }
  await task.save();

  return { content: [{ type: 'text', text: JSON.stringify(task, null, 2) }] };
});

server.tool('delete_task', 'Delete a task', {
  taskId: z.string().describe('Task ID'),
}, async ({ taskId }) => {
  const task = await Task.findByIdAndDelete(taskId);
  if (!task) return { content: [{ type: 'text', text: 'Task not found' }] };
  return { content: [{ type: 'text', text: 'Deleted' }] };
});

// --- Groups ---

server.tool('list_groups', 'List groups for a user', {
  userEmail: z.string().describe('Email of the user'),
}, async ({ userEmail }) => {
  const user = await User.findOne({ email: userEmail });
  if (!user) return { content: [{ type: 'text', text: 'User not found' }] };

  const groups = await Group.find({
    $or: [{ ownerId: user._id }, { 'members.userId': user._id }],
  });

  return { content: [{ type: 'text', text: JSON.stringify(groups, null, 2) }] };
});

server.tool('create_group', 'Create a new group', {
  userEmail: z.string().describe('Email of the group owner'),
  name: z.string().describe('Group name'),
}, async ({ userEmail, name }) => {
  const user = await User.findOne({ email: userEmail });
  if (!user) return { content: [{ type: 'text', text: 'User not found' }] };

  const group = await Group.create({
    name,
    ownerId: user._id,
    members: [{ userId: user._id, role: 'editor' }],
  });

  return { content: [{ type: 'text', text: JSON.stringify(group, null, 2) }] };
});

// --- Start ---

async function main() {
  await mongoose.connect(process.env.MONGODB_URI!);
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch(console.error);
