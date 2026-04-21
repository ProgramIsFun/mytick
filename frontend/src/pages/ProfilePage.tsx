import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api } from '../api/client';
import { PageSpinner } from '../components/Spinner';

interface Project {
  _id: string; title: string; description: string; status: string;
  tags?: string[]; metadata?: { repoUrl?: string; projectType?: string } | null;
  createdAt: string;
}

interface Profile {
  username: string; name: string; projects: Project[];
}

export default function ProfilePage() {
  const { username } = useParams<{ username: string }>();
  const navigate = useNavigate();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!username) return;
    api.getProfile(username).then(setProfile).catch((err: any) => setError(err.message));
  }, [username]);

  if (error) return (
    <div className="min-h-screen bg-surface flex items-center justify-center">
      <div className="text-center">
        <p className="text-danger mb-4">{error}</p>
        <button onClick={() => navigate('/')} className="text-sm text-accent hover:underline">← Home</button>
      </div>
    </div>
  );

  if (!profile) return <PageSpinner />;

  return (
    <div className="min-h-screen bg-surface">
      <header className="border-b border-border bg-surface-secondary">
        <div className="max-w-3xl mx-auto px-4 py-8">
          <h1 className="text-2xl font-bold text-text-primary">{profile.name}</h1>
          <p className="text-sm text-text-muted mt-1">@{profile.username}</p>
          <div className="flex gap-3 mt-3">
            <span className="text-xs text-text-muted">{profile.projects.length} public project{profile.projects.length !== 1 ? 's' : ''}</span>
            <a href={`/u/${profile.username}/tasks`} onClick={e => { e.preventDefault(); navigate(`/u/${profile.username}/tasks`); }} className="text-xs text-accent hover:underline">View tasks →</a>
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-6">
        <div className="space-y-3">
          {profile.projects.map(p => (
            <div key={p._id} className="border border-border rounded-lg p-5 bg-surface hover:border-accent/30 transition-colors">
              <div className="flex items-start justify-between">
                <div>
                  <h2 className="text-base font-semibold text-text-primary">📁 {p.title}</h2>
                  {p.description && <p className="text-sm text-text-secondary mt-1">{p.description}</p>}
                </div>
                {p.metadata?.projectType && (
                  <span className="text-xs px-2 py-0.5 rounded-full bg-surface-secondary text-text-muted">{p.metadata.projectType}</span>
                )}
              </div>
              {p.metadata?.repoUrl && (
                <a href={p.metadata.repoUrl} target="_blank" rel="noreferrer" className="text-xs text-accent hover:underline mt-2 inline-block">🔗 {p.metadata.repoUrl}</a>
              )}
              {p.tags && p.tags.length > 0 && (
                <div className="flex gap-1 mt-2">
                  {p.tags.map(t => <span key={t} className="text-[10px] px-1.5 py-0.5 rounded-full bg-accent/10 text-accent">{t}</span>)}
                </div>
              )}
            </div>
          ))}
          {profile.projects.length === 0 && <div className="text-center py-12 text-text-muted text-sm">No public projects yet</div>}
        </div>
      </main>
    </div>
  );
}
