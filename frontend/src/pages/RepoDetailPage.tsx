import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { api } from '../api/client';
import Spinner from '../components/Spinner';
import type { Repo } from '../types/repo';
import BackButton from '../components/BackButton';

interface TaskRef {
  id: string;
  title: string;
  status: string;
}

export default function RepoDetailPage() {
  const navigate = useNavigate();
  const { id } = useParams();
  const [repo, setRepo] = useState<Repo | null>(null);
  const [tasks, setTasks] = useState<TaskRef[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (id) {
      Promise.all([
        api.getRepo(id),
        api.getRepoTasks(id).catch(() => []),
      ]).then(([repoData, tasksData]) => {
        setRepo(repoData);
        setTasks(tasksData as TaskRef[]);
      }).finally(() => setLoading(false));
    }
  }, [id]);

  if (loading) return <Spinner />;
  if (!repo) return <div>Repo not found</div>;

  const extractRepoName = (repoUrl: string) => {
    const match = repoUrl.match(/github\.com\/([^/]+\/[^/]+)/);
    return match ? match[1] : repoUrl;
  };

  return (
    <div className="max-w-4xl mx-auto p-6">
      <div className="mb-6">
        <BackButton to="/repos" label="Repos" />
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-text-primary">{extractRepoName(repo.url)}</h1>
            <a href={repo.url} target="_blank" rel="noopener noreferrer" className="text-sm text-accent hover:underline">{repo.url}</a>
          </div>
        </div>
      </div>

      <div className="bg-surface rounded-lg border border-border p-6 space-y-4">
        <div>
          <label className="text-xs font-medium text-text-muted block mb-1">Repository URL</label>
          <div className="text-sm text-text-primary font-mono">{repo.url}</div>
        </div>

        {tasks.length > 0 && (
          <div>
            <label className="text-xs font-medium text-text-muted block mb-1">Linked Tasks</label>
            <div className="space-y-1">
              {tasks.map(task => (
                <button
                  key={task.id}
                  onClick={() => navigate(`/tasks/${task.id}`)}
                  className="block text-sm text-accent hover:underline"
                >
                  {task.title}
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="grid grid-cols-2 gap-4 pt-4 border-t border-border">
          <div>
            <label className="text-xs font-medium text-text-muted block mb-1">Created</label>
            <p className="text-sm text-text-primary">{new Date(repo.createdAt).toLocaleDateString()}</p>
          </div>
          <div>
            <label className="text-xs font-medium text-text-muted block mb-1">Updated</label>
            <p className="text-sm text-text-primary">{new Date(repo.updatedAt).toLocaleDateString()}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
