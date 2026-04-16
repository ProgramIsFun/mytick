import { Router, Response } from 'express';
import Project from '../models/Project';
import { auth, AuthRequest } from '../middleware/auth';

const router = Router();
router.use(auth);

// List projects (owned or member of)
router.get('/', async (req: AuthRequest, res: Response) => {
  try {
    const projects = await Project.find({
      $or: [
        { userId: req.userId },
        { 'members.userId': req.userId },
      ],
    }).sort({ createdAt: -1 });
    res.json(projects);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Get project by ID (populated with account details)
router.get('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const project = await Project.findOne({ _id: req.params.id, userId: req.userId })
      .populate('services.accountId');
    if (!project) return res.status(404).json({ error: 'Not found' });
    res.json(project);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Create project
router.post('/', async (req: AuthRequest, res: Response) => {
  try {
    const { name, description, repoUrl, localPath, services, type, environments } = req.body;
    if (!name) return res.status(400).json({ error: 'name required' });
    const project = await Project.create({
      userId: req.userId, name,
      description: description || '',
      type: type || 'software',
      repoUrl: repoUrl || '',
      localPath: localPath || '',
      environments: environments || [],
      services: services || [],
    });
    res.status(201).json(project);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Update project
router.patch('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const project = await Project.findOne({ _id: req.params.id, userId: req.userId });
    if (!project) return res.status(404).json({ error: 'Not found' });
    const allowed = ['name', 'description', 'repoUrl', 'localPath', 'services', 'type', 'environments'];
    for (const key of allowed) {
      if (req.body[key] !== undefined) (project as any)[key] = req.body[key];
    }
    await project.save();
    res.json(project);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Delete project
router.delete('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const project = await Project.findOneAndDelete({ _id: req.params.id, userId: req.userId });
    if (!project) return res.status(404).json({ error: 'Not found' });
    res.json({ message: 'Deleted' });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Get all projects using a specific account
router.get('/by-account/:accountId', async (req: AuthRequest, res: Response) => {
  try {
    const projects = await Project.find({
      userId: req.userId,
      'services.accountId': req.params.accountId,
    });
    res.json(projects);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Add member to project (owner only)
router.post('/:id/members', async (req: AuthRequest, res: Response) => {
  try {
    const project = await Project.findOne({ _id: req.params.id, userId: req.userId });
    if (!project) return res.status(404).json({ error: 'Not found' });
    const { userId, role } = req.body;
    if (!userId) return res.status(400).json({ error: 'userId required' });
    const existing = project.members.find(m => m.userId.toString() === userId);
    if (existing) {
      existing.role = role || existing.role;
    } else {
      project.members.push({ userId, role: role || 'viewer' });
    }
    await project.save();
    res.json(project);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Remove member from project (owner only)
router.delete('/:id/members/:userId', async (req: AuthRequest, res: Response) => {
  try {
    const project = await Project.findOne({ _id: req.params.id, userId: req.userId });
    if (!project) return res.status(404).json({ error: 'Not found' });
    project.members = project.members.filter(m => m.userId.toString() !== req.params.userId);
    await project.save();
    res.json(project);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

export default router;
