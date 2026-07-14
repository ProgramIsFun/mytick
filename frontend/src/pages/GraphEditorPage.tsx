import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api/client';
import Spinner from '../components/Spinner';
import BackButton from '../components/BackButton';

interface GraphNode {
  id: string;
  labels: string[];
  properties: Record<string, any>;
  x?: number;
  y?: number;
  vx?: number;
  vy?: number;
}

interface GraphEdge {
  id: string;
  type: string;
  source: string;
  target: string;
  properties: Record<string, any>;
}

interface GraphData {
  nodes: GraphNode[];
  edges: GraphEdge[];
}

const LABEL_COLORS: Record<string, string> = {
  User: '#6366f1',
  Task: '#22c55e',
  Repo: '#3b82f6',
  Domain: '#f59e0b',
  Account: '#8b5cf6',
  Secret: '#ef4444',
  Database: '#06b6d4',
  Subscription: '#ec4899',
  Group: '#14b8a6',
  Knowledge: '#f97316',
  Context: '#64748b',
};

const NODE_RADIUS = 20;

export default function GraphEditorPage() {
  const navigate = useNavigate();
  const svgRef = useRef<SVGSVGElement>(null);
  const [graph, setGraph] = useState<GraphData | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedNode, setSelectedNode] = useState<GraphNode | null>(null);
  const [dragging, setDragging] = useState<string | null>(null);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [viewBox] = useState({ x: -400, y: -300, w: 800, h: 600 });
  const simulationRef = useRef<number | null>(null);
  const nodesRef = useRef<Map<string, GraphNode>>(new Map());

  useEffect(() => {
    api.getGraph().then((data: GraphData) => {
      // Initialize positions in a circle
      const nodes = data.nodes.map((n, i) => {
        const angle = (2 * Math.PI * i) / data.nodes.length;
        const radius = Math.min(200, 50 + data.nodes.length * 10);
        return {
          ...n,
          x: Math.cos(angle) * radius,
          y: Math.sin(angle) * radius,
          vx: 0,
          vy: 0,
        };
      });
      nodesRef.current = new Map(nodes.map(n => [n.id, n]));
      setGraph({ nodes, edges: data.edges });
    }).finally(() => setLoading(false));
  }, []);

  const simulate = useCallback(() => {
    if (!graph) return;
    const nodes = Array.from(nodesRef.current.values());
    const k = 0.01; // Spring constant
    const repulsion = 5000;
    const damping = 0.9;
    const center = { x: 0, y: 0 };

    // Repulsion between all nodes
    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        const a = nodes[i];
        const b = nodes[j];
        const dx = (a.x || 0) - (b.x || 0);
        const dy = (a.y || 0) - (b.y || 0);
        const dist = Math.sqrt(dx * dx + dy * dy) || 1;
        const force = repulsion / (dist * dist);
        const fx = (dx / dist) * force;
        const fy = (dy / dist) * force;
        a.vx = (a.vx || 0) + fx;
        a.vy = (a.vy || 0) + fy;
        b.vx = (b.vx || 0) - fx;
        b.vy = (b.vy || 0) - fy;
      }
    }

    // Attraction along edges
    for (const edge of graph.edges) {
      const source = nodesRef.current.get(edge.source);
      const target = nodesRef.current.get(edge.target);
      if (!source || !target) continue;
      const dx = (target.x || 0) - (source.x || 0);
      const dy = (target.y || 0) - (source.y || 0);
      const dist = Math.sqrt(dx * dx + dy * dy) || 1;
      const force = k * (dist - 100);
      const fx = (dx / dist) * force;
      const fy = (dy / dist) * force;
      source.vx = (source.vx || 0) + fx;
      source.vy = (source.vy || 0) + fy;
      target.vx = (target.vx || 0) - fx;
      target.vy = (target.vy || 0) - fy;
    }

    // Center gravity
    for (const node of nodes) {
      const dx = center.x - (node.x || 0);
      const dy = center.y - (node.y || 0);
      node.vx = (node.vx || 0) + dx * 0.001;
      node.vy = (node.vy || 0) + dy * 0.001;
    }

    // Apply velocities
    let moved = false;
    for (const node of nodes) {
      if (node.id === dragging) continue;
      node.vx = (node.vx || 0) * damping;
      node.vy = (node.vy || 0) * damping;
      node.x = (node.x || 0) + node.vx;
      node.y = (node.y || 0) + node.vy;
      if (Math.abs(node.vx) > 0.01 || Math.abs(node.vy) > 0.01) moved = true;
    }

    nodesRef.current = new Map(nodes.map(n => [n.id, n]));
    setGraph(prev => prev ? { ...prev, nodes: [...nodes] } : null);

    if (moved) {
      simulationRef.current = requestAnimationFrame(simulate);
    }
  }, [graph, dragging]);

  useEffect(() => {
    if (graph && graph.nodes.length > 0) {
      simulationRef.current = requestAnimationFrame(simulate);
    }
    return () => {
      if (simulationRef.current) cancelAnimationFrame(simulationRef.current);
    };
  }, [graph?.nodes.length]);

  const handleMouseDown = (nodeId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const node = nodesRef.current.get(nodeId);
    if (!node) return;
    setDragging(nodeId);
    const svg = svgRef.current?.getBoundingClientRect();
    if (svg) {
      setOffset({
        x: e.clientX - svg.left - (viewBox.x + (node.x || 0)),
        y: e.clientY - svg.top - (viewBox.y + (node.y || 0)),
      });
    }
    setSelectedNode(node);
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!dragging || !svgRef.current) return;
    const svg = svgRef.current.getBoundingClientRect();
    const node = nodesRef.current.get(dragging);
    if (!node) return;
    node.x = e.clientX - svg.left - viewBox.x - offset.x;
    node.y = e.clientY - svg.top - viewBox.y - offset.y;
    node.vx = 0;
    node.vy = 0;
    nodesRef.current.set(dragging, node);
    setGraph(prev => prev ? { ...prev, nodes: Array.from(nodesRef.current.values()) } : null);
  };

  const handleMouseUp = () => {
    setDragging(null);
  };

  const handleSvgClick = () => {
    setSelectedNode(null);
  };

  const getNodeColor = (labels: string[]) => {
    for (const label of labels) {
      if (LABEL_COLORS[label]) return LABEL_COLORS[label];
    }
    return '#6b7280';
  };

  const navigateToNode = (node: GraphNode) => {
    const label = node.labels[0];
    switch (label) {
      case 'Task': navigate(`/tasks/${node.id}`); break;
      case 'Repo': navigate(`/repos/${node.id}`); break;
      case 'Domain': navigate(`/domains/${node.id}`); break;
      case 'Account': navigate(`/accounts/${node.id}`); break;
      case 'Database': navigate(`/databases/${node.id}`); break;
      case 'Subscription': navigate(`/subscriptions/${node.id}`); break;
      default: break;
    }
  };

  if (loading) return <Spinner />;
  if (!graph) return <div>Failed to load graph</div>;

  return (
    <div className="min-h-screen bg-surface">
      <div className="border-b border-border bg-surface-secondary">
        <div className="max-w-full mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <BackButton to="/" label="Home" />
            <h1 className="text-lg font-semibold text-text-primary">Graph Editor</h1>
            <span className="text-xs text-text-muted">{graph.nodes.length} nodes, {graph.edges.length} edges</span>
          </div>
        </div>
      </div>

      <div className="flex h-[calc(100vh-56px)]">
        {/* Graph Canvas */}
        <div className="flex-1 overflow-hidden">
          <svg
            ref={svgRef}
            className="w-full h-full bg-surface"
            viewBox={`${viewBox.x} ${viewBox.y} ${viewBox.w} ${viewBox.h}`}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
            onClick={handleSvgClick}
          >
            {/* Edges */}
            {graph.edges.map(edge => {
              const source = graph.nodes.find(n => n.id === edge.source);
              const target = graph.nodes.find(n => n.id === edge.target);
              if (!source || !target) return null;
              return (
                <g key={edge.id}>
                  <line
                    x1={source.x || 0}
                    y1={source.y || 0}
                    x2={target.x || 0}
                    y2={target.y || 0}
                    stroke="#374151"
                    strokeWidth={1.5}
                    opacity={0.6}
                  />
                  <text
                    x={((source.x || 0) + (target.x || 0)) / 2}
                    y={((source.y || 0) + (target.y || 0)) / 2 - 5}
                    textAnchor="middle"
                    fill="#9ca3af"
                    fontSize={10}
                  >
                    {edge.type}
                  </text>
                </g>
              );
            })}

            {/* Nodes */}
            {graph.nodes.map(node => (
              <g
                key={node.id}
                transform={`translate(${node.x || 0}, ${node.y || 0})`}
                onMouseDown={(e) => handleMouseDown(node.id, e)}
                className="cursor-pointer"
              >
                <circle
                  r={NODE_RADIUS}
                  fill={getNodeColor(node.labels)}
                  stroke={selectedNode?.id === node.id ? '#fff' : '#1f2937'}
                  strokeWidth={selectedNode?.id === node.id ? 3 : 2}
                  opacity={0.9}
                />
                <text
                  textAnchor="middle"
                  dy={NODE_RADIUS + 14}
                  fill="#d1d5db"
                  fontSize={10}
                  className="pointer-events-none"
                >
                  {node.properties.title || node.properties.name || node.properties.url?.split('/').pop() || node.labels[0]}
                </text>
              </g>
            ))}
          </svg>
        </div>

        {/* Sidebar */}
        <div className="w-80 border-l border-border bg-surface-secondary overflow-y-auto">
          {selectedNode ? (
            <div className="p-4">
              <div className="flex items-center gap-2 mb-4">
                <div
                  className="w-4 h-4 rounded-full"
                  style={{ backgroundColor: getNodeColor(selectedNode.labels) }}
                />
                <h2 className="text-lg font-semibold text-text-primary">
                  {selectedNode.labels.join(': ')}
                </h2>
              </div>

              <div className="space-y-3">
                <div>
                  <label className="text-xs font-medium text-text-muted block mb-1">ID</label>
                  <div className="text-sm text-text-primary font-mono break-all">{selectedNode.id}</div>
                </div>

                {Object.entries(selectedNode.properties).map(([key, value]) => (
                  <div key={key}>
                    <label className="text-xs font-medium text-text-muted block mb-1">{key}</label>
                    <div className="text-sm text-text-primary break-all">
                      {typeof value === 'object' ? JSON.stringify(value) : String(value)}
                    </div>
                  </div>
                ))}

                {/* Connected edges */}
                <div className="pt-2 border-t border-border">
                  <label className="text-xs font-medium text-text-muted block mb-2">Connections</label>
                  {graph.edges
                    .filter(e => e.source === selectedNode.id || e.target === selectedNode.id)
                    .map(edge => {
                      const otherId = edge.source === selectedNode.id ? edge.target : edge.source;
                      const other = graph.nodes.find(n => n.id === otherId);
                      const direction = edge.source === selectedNode.id ? '→' : '←';
                      return (
                        <button
                          key={edge.id}
                          onClick={() => other && setSelectedNode(other)}
                          className="block w-full text-left text-xs text-accent hover:underline mb-1"
                        >
                          {direction} {edge.type} → {other?.properties.title || other?.properties.name || other?.labels[0] || otherId}
                        </button>
                      );
                    })}
                </div>

                {/* Navigate button */}
                {selectedNode.labels[0] !== 'User' && (
                  <button
                    onClick={() => navigateToNode(selectedNode)}
                    className="w-full mt-4 px-3 py-2 text-sm rounded-md bg-accent text-white hover:bg-accent-hover transition-colors"
                  >
                    View in {selectedNode.labels[0]} page
                  </button>
                )}
              </div>
            </div>
          ) : (
            <div className="p-4 text-sm text-text-muted">
              <p className="mb-2">Click a node to see its details.</p>
              <p>Drag nodes to rearrange.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
