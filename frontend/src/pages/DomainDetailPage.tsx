import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { api } from '../api/client';
import Spinner from '../components/Spinner';

interface Account { _id: string; name: string; provider: string; }
interface Project { _id: string; title: string; }
interface Domain {
  _id: string; name: string; expiryDate: string | null; autoRenew: boolean;
  nameservers: string[]; sslProvider: string; notes: string; tags: string[];
  registrarAccountId: Account | null; dnsAccountId: Account | null;
  projectId: Project | null;
}

export default function DomainDetailPage() {
  const navigate = useNavigate();
  const { id } = useParams();
  const [domain, setDomain] = useState<Domain | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (id) {
      api.getDomain(id).then(setDomain).finally(() => setLoading(false));
    }
  }, [id]);

  if (loading) return <Spinner />;
  if (!domain) return <div>Domain not found</div>;

  const daysUntilExpiry = (date: string) => {
    const days = Math.ceil((new Date(date).getTime() - Date.now()) / 86400000);
    return days;
  };

  const expiryBadge = (date: string | null) => {
    if (!date) return null;
    const days = daysUntilExpiry(date);
    if (days < 0) return <span className="text-xs px-2 py-0.5 rounded-full bg-danger/15 text-danger font-medium">Expired</span>;
    if (days < 30) return <span className="text-xs px-2 py-0.5 rounded-full bg-warning/15 text-warning font-medium">{days}d left</span>;
    return <span className="text-xs text-text-muted">{new Date(date).toLocaleDateString()}</span>;
  };

  return (
    <div className="max-w-4xl mx-auto p-6">
      <div className="mb-6">
        <button onClick={() => navigate('/domains')} className="text-sm text-accent hover:underline mb-2">
          ← Back to Domains
        </button>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-text-primary">{domain.name}</h1>
            <div className="flex items-center gap-2 mt-1">
              {expiryBadge(domain.expiryDate)}
              {domain.autoRenew && <span className="text-xs px-2 py-0.5 rounded-full bg-success/15 text-success font-medium">Auto-renew</span>}
            </div>
          </div>
        </div>
      </div>

      <div className="bg-surface rounded-lg border border-border p-6 space-y-4">
        {domain.registrarAccountId && (
          <div>
            <label className="text-xs font-medium text-text-muted block mb-1">Registrar Account</label>
            <button
              onClick={() => navigate(`/accounts/${domain.registrarAccountId._id}`)}
              className="text-sm text-accent hover:underline"
            >
              {domain.registrarAccountId.name}
            </button>
          </div>
        )}

        {domain.dnsAccountId && (
          <div>
            <label className="text-xs font-medium text-text-muted block mb-1">DNS Account</label>
            <button
              onClick={() => navigate(`/accounts/${domain.dnsAccountId._id}`)}
              className="text-sm text-accent hover:underline"
            >
              {domain.dnsAccountId.name}
            </button>
          </div>
        )}

        {domain.projectId && (
          <div>
            <label className="text-xs font-medium text-text-muted block mb-1">Project</label>
            <div className="text-sm text-text-primary">{domain.projectId.title}</div>
          </div>
        )}

        {domain.nameservers.length > 0 && (
          <div>
            <label className="text-xs font-medium text-text-muted block mb-1">Nameservers</label>
            <div className="text-sm text-text-primary space-y-1">
              {domain.nameservers.map((ns, idx) => (
                <div key={idx}>{ns}</div>
              ))}
            </div>
          </div>
        )}

        {domain.sslProvider && (
          <div>
            <label className="text-xs font-medium text-text-muted block mb-1">SSL Provider</label>
            <div className="text-sm text-text-primary">{domain.sslProvider}</div>
          </div>
        )}

        {domain.notes && (
          <div>
            <label className="text-xs font-medium text-text-muted block mb-1">Notes</label>
            <div className="text-sm text-text-primary whitespace-pre-wrap">{domain.notes}</div>
          </div>
        )}

        {domain.tags.length > 0 && (
          <div>
            <label className="text-xs font-medium text-text-muted block mb-1">Tags</label>
            <div className="flex flex-wrap gap-2">
              {domain.tags.map(tag => (
                <span key={tag} className="text-xs px-2 py-1 rounded bg-surface-secondary border border-border text-text-primary">
                  {tag}
                </span>
              ))}
            </div>
          </div>
        )}

        <div className="grid grid-cols-2 gap-4 pt-4 border-t border-border">
          <div>
            <label className="text-xs font-medium text-text-muted block mb-1">Created</label>
            <p className="text-sm text-text-primary">{new Date(domain._id.slice(0, 8), 16).toLocaleString()}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
