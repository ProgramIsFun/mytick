import { Db } from 'mongodb';

export async function up(db: Db) {
  const tasks = db.collection('tasks');

  // Set type='task' on all existing tasks that don't have a type field
  const result = await tasks.updateMany(
    { type: { $exists: false } },
    { $set: { type: 'task', metadata: null } },
  );
  console.log(`  Set type='task' on ${result.modifiedCount} existing tasks`);

  // Remove projectIds field from all tasks
  await tasks.updateMany({}, { $unset: { projectIds: '' } });
  console.log('  Removed projectIds from all tasks');

  // Migrate existing projects into tasks with type='project'
  const projects = db.collection('projects');
  const existingProjects = await projects.find({}).toArray();
  if (existingProjects.length > 0) {
    const { nanoid } = await import('nanoid');
    const projectTasks = existingProjects.map(p => ({
      userId: p.userId,
      title: p.name,
      description: p.description || '',
      type: 'project',
      status: 'pending',
      visibility: 'private',
      groupIds: [],
      shareToken: nanoid(12),
      blockedBy: [],
      deadline: null,
      recurrence: null,
      metadata: {
        projectType: p.type || 'software',
        repoUrl: p.repoUrl || '',
        localPath: p.localPath || '',
        environments: p.environments || [],
        services: p.services || [],
        members: p.members || [],
      },
      descriptionHistory: [],
      createdAt: p.createdAt || new Date(),
      updatedAt: p.updatedAt || new Date(),
    }));
    const insertResult = await tasks.insertMany(projectTasks);
    console.log(`  Migrated ${insertResult.insertedCount} projects into tasks`);
  } else {
    console.log('  No existing projects to migrate');
  }

  // Create index on type for filtered queries
  await tasks.createIndex({ type: 1 });
  console.log('  Created index on type');
}
