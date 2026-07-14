import { Router, Response } from 'express';
import { auth, AuthRequest } from '../middleware/auth';
import { asyncHandler } from '../middleware/asyncHandler';
import { getSession } from '../neo4j';

const router = Router();
router.use(auth);

/**
 * @openapi
 * /graph/all:
 *   get:
 *     tags: [Graph]
 *     summary: Get all nodes and edges connected to the logged-in user
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Graph data with nodes and edges
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 nodes:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id:
 *                         type: string
 *                       labels:
 *                         type: array
 *                         items:
 *                           type: string
 *                       properties:
 *                         type: object
 *                 edges:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id:
 *                         type: string
 *                       type:
 *                         type: string
 *                       source:
 *                         type: string
 *                       target:
 *                         type: string
 *                       properties:
 *                         type: object
 */
router.get('/all', asyncHandler(async (req: AuthRequest, res: Response) => {
  const userId = req.userId!;
  const session = getSession();

  try {
    // Step 1: Get all reachable nodes (excluding auth internals)
    const nodesResult = await session.run(
      `MATCH (u:User {id: $userId})-[*1..10]-(n)
       WHERE NOT n:User AND NOT n:AuthProvider AND NOT n:PushToken
       RETURN DISTINCT n.id AS id, labels(n) AS labels, properties(n) AS props`,
      { userId }
    );

    const nodeMap = new Map<string, { id: string; labels: string[]; properties: Record<string, any> }>();

    // Add the user node itself
    nodeMap.set(userId, {
      id: userId,
      labels: ['User'],
      properties: {},
    });

    for (const record of nodesResult.records) {
      const id = record.get('id') as string;
      const labels = record.get('labels') as string[];
      const props = record.get('props') as Record<string, any>;
      if (id) {
        nodeMap.set(id, { id, labels, properties: props || {} });
      }
    }

    // Step 2: Get all relationships between reachable nodes
    const nodeIds = Array.from(nodeMap.keys());

    if (nodeIds.length <= 1) {
      // No connected nodes found, return just the user
      return res.json({ nodes: Array.from(nodeMap.values()), edges: [] });
    }

    const edgesResult = await session.run(
      `MATCH (u:User {id: $userId})-[*1..10]-(n)
       WHERE NOT n:User AND NOT n:AuthProvider AND NOT n:PushToken
       WITH COLLECT(DISTINCT n) AS nodeList
       MATCH (a)-[r]->(b)
       WHERE (a IN nodeList OR a.id = $userId) AND (b IN nodeList OR b.id = $userId)
         AND a.id IS NOT NULL AND b.id IS NOT NULL
       RETURN DISTINCT
         id(r) AS edgeId,
         type(r) AS edgeType,
         a.id AS sourceId,
         b.id AS targetId,
         properties(r) AS edgeProps`,
      { userId }
    );

    const edges = edgesResult.records.map(record => ({
      id: record.get('edgeId') as string,
      type: record.get('edgeType') as string,
      source: record.get('sourceId') as string,
      target: record.get('targetId') as string,
      properties: record.get('edgeProps') as Record<string, any> || {},
    }));

    res.json({
      nodes: Array.from(nodeMap.values()),
      edges,
    });
  } finally {
    await session.close();
  }
}));

export default router;
