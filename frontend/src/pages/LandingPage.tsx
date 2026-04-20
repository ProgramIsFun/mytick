import { useNavigate } from 'react-router-dom';

export default function LandingPage() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-surface">
      <header className="border-b border-border bg-surface-secondary">
        <div className="max-w-4xl mx-auto px-4 h-14 flex items-center justify-between">
          <h1 className="text-lg font-bold text-text-primary">MyTick</h1>
          <div className="flex gap-2">
            <button onClick={() => navigate('/login')} className="text-sm px-4 py-1.5 rounded-md border border-border text-text-secondary hover:text-text-primary hover:bg-surface-hover transition-colors">
              Log in
            </button>
            <button onClick={() => navigate('/login')} className="text-sm px-4 py-1.5 rounded-md bg-accent text-white hover:bg-accent-hover transition-colors">
              Sign up
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4">
        <section className="py-20 text-center">
          <h2 className="text-4xl font-bold text-text-primary leading-tight">
            Task management<br />for developers
          </h2>
          <p className="text-lg text-text-secondary mt-4 max-w-xl mx-auto">
            Projects, subtasks, dependencies, accounts, domains — everything you manage as a developer, in one place.
          </p>
          <div className="flex gap-3 justify-center mt-8">
            <button onClick={() => navigate('/login')} className="px-6 py-2.5 rounded-md bg-accent text-white hover:bg-accent-hover text-sm font-medium transition-colors">
              Get started — it's free
            </button>
            <a href="https://github.com/ProgramIsFun/mytick" target="_blank" rel="noreferrer" className="px-6 py-2.5 rounded-md border border-border text-text-secondary hover:text-text-primary hover:bg-surface-hover text-sm font-medium transition-colors">
              GitHub →
            </a>
          </div>
        </section>

        <section className="py-12 grid grid-cols-1 md:grid-cols-3 gap-6">
          {[
            { icon: '📁', title: 'Projects & Subtasks', desc: 'Organize work into projects with nested subtasks. Track progress at every level.' },
            { icon: '🔗', title: 'Dependencies', desc: 'Define what blocks what. Know exactly what needs to happen before you can move forward.' },
            { icon: '🏷️', title: 'Tags & Pinning', desc: 'Tag tasks by context — work, personal, client. Pin what matters most to the top.' },
            { icon: '🔑', title: 'Account Manager', desc: 'Track your service accounts, credentials, and API keys. Bitwarden integration for secrets.' },
            { icon: '🌐', title: 'Domain Tracker', desc: 'Manage domains, DNS, SSL, and expiry dates. Link domains to projects and registrar accounts.' },
            { icon: '📱', title: 'API-First', desc: 'Full REST API. Mobile app. Push notifications. Build your own integrations.' },
          ].map(f => (
            <div key={f.title} className="border border-border rounded-lg p-5 bg-surface">
              <div className="text-2xl mb-2">{f.icon}</div>
              <h3 className="text-sm font-semibold text-text-primary">{f.title}</h3>
              <p className="text-xs text-text-secondary mt-1 leading-relaxed">{f.desc}</p>
            </div>
          ))}
        </section>

        <section className="py-12 text-center border-t border-border">
          <p className="text-sm text-text-muted">Open source · Built by <a href="/u/buildstuff" className="text-accent hover:underline">buildstuff</a></p>
        </section>
      </main>
    </div>
  );
}
