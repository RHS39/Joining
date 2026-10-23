import { createContext, useContext, useEffect, useState, type FormEvent, type ReactNode } from 'react';
import { FileSpreadsheet, LockKeyhole } from 'lucide-react';

type Credential = {
  loginId: string;
  password: string;
};

type AuthContextValue = {
  signOut: () => void;
};

const AuthContext = createContext<AuthContextValue | null>(null);
const AUTH_SESSION_KEY = 'kores-records-authenticated';

function parseCredentials(contents: string): Credential[] {
  return contents
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line !== '' && !line.startsWith('#'))
    .flatMap((line) => {
      const separator = line.indexOf(':');
      if (separator < 1) return [];
      const loginId = line.slice(0, separator).trim();
      const password = line.slice(separator + 1).trim();
      return loginId && password ? [{ loginId, password }] : [];
    });
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [credentials, setCredentials] = useState<Credential[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [retry, setRetry] = useState(0);
  const [isAuthenticated, setIsAuthenticated] = useState(
    () => window.sessionStorage.getItem(AUTH_SESSION_KEY) === 'true',
  );

  useEffect(() => {
    let cancelled = false;

    async function loadCredentials() {
      setLoading(true);
      setLoadError('');
      try {
        const response = await fetch(`${import.meta.env.BASE_URL}userauth.txt`);
        if (!response.ok) {
          throw new Error(`The server returned ${response.status} ${response.statusText}.`);
        }
        const parsed = parseCredentials(await response.text());
        if (parsed.length === 0) {
          throw new Error('No valid login ID and password entries were found.');
        }
        if (!cancelled) setCredentials(parsed);
      } catch (error) {
        if (!cancelled) {
          setLoadError(error instanceof Error ? error.message : 'Unknown error.');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void loadCredentials();
    return () => {
      cancelled = true;
    };
  }, [retry]);

  const signOut = () => {
    window.sessionStorage.removeItem(AUTH_SESSION_KEY);
    setIsAuthenticated(false);
  };

  const signIn = () => {
    window.sessionStorage.setItem(AUTH_SESSION_KEY, 'true');
    setIsAuthenticated(true);
  };

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center px-4">
        <p className="text-sm text-ink-600" role="status">Loading sign-in settings…</p>
      </main>
    );
  }

  if (loadError) {
    return (
      <main className="flex min-h-screen items-center justify-center px-4 py-10">
        <section className="card-surface w-full max-w-md p-6" aria-labelledby="auth-error-title">
          <h1 id="auth-error-title" className="text-lg font-semibold text-ink-900">Unable to load sign-in settings</h1>
          <p className="mt-2 text-sm text-red-700">{loadError}</p>
          <p className="mt-2 text-sm text-ink-600">
            Check that <code>userauth.txt</code> is deployed with the application, then try again.
          </p>
          <button
            type="button"
            onClick={() => setRetry((value) => value + 1)}
            className="mt-5 rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700"
          >
            Try again
          </button>
        </section>
      </main>
    );
  }

  return (
    <AuthContext.Provider value={{ signOut }}>
      {isAuthenticated ? children : (
        <LoginScreen
          credentials={credentials}
          onAuthenticated={signIn}
        />
      )}
    </AuthContext.Provider>
  );
}

function LoginScreen({
  credentials,
  onAuthenticated,
}: {
  credentials: Credential[];
  onAuthenticated: () => void;
}) {
  const [loginId, setLoginId] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting) return;
    const matched = credentials.some(
      (credential) => credential.loginId === loginId.trim() && credential.password === password,
    );
    if (!matched) {
      setError('The login ID or password is incorrect.');
      return;
    }

    setSubmitting(true);
    try {
      const response = await fetch(`${import.meta.env.BASE_URL}api/login-log`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ loginId: loginId.trim() }),
      });
      const result: unknown = await response.json();
      if (!response.ok || !result || typeof result !== 'object' || !('ok' in result) || result.ok !== true) {
        throw new Error('The login time could not be recorded. Please try again.');
      }
      onAuthenticated();
      setError('');
    } catch (error) {
      setError(
        error instanceof Error && error.message.includes('session')
          ? 'The sign-in session could not be saved in this browser. Check that session storage is enabled.'
          : 'The login time could not be recorded. Make sure the app is running with its Node server, then try again.',
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-10">
      <section className="card-surface w-full max-w-md p-6 sm:p-8" aria-labelledby="login-title">
        <div className="mb-6 flex items-center gap-3">
          <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand-600 text-white">
            <FileSpreadsheet className="h-6 w-6" aria-hidden="true" />
          </span>
          <div>
            <p className="text-sm font-medium text-ink-500">Kores Employee Records</p>
            <h1 id="login-title" className="text-xl font-semibold text-ink-900">Sign in</h1>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="login-id" className="mb-1.5 block text-sm font-medium text-ink-700">Login ID</label>
            <input
              id="login-id"
              name="username"
              type="text"
              autoComplete="username"
              required
              disabled={submitting}
              value={loginId}
              onChange={(event) => setLoginId(event.target.value)}
              className="field-input"
            />
          </div>
          <div>
            <label htmlFor="login-password" className="mb-1.5 block text-sm font-medium text-ink-700">Password</label>
            <input
              id="login-password"
              name="password"
              type="password"
              autoComplete="current-password"
              required
              disabled={submitting}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="field-input"
            />
          </div>
          {error ? <p className="text-sm text-red-700" role="alert">{error}</p> : null}
          <button
            type="submit"
            disabled={submitting}
            aria-busy={submitting}
            className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-brand-600 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-brand-700"
          >
            <LockKeyhole className="h-4 w-4" aria-hidden="true" />
            {submitting ? 'Recording sign-in…' : 'Sign in'}
          </button>
        </form>

        <p className="mt-5 rounded-lg border border-amber-300 bg-amber-50 p-3 text-xs leading-relaxed text-amber-900">
          Demo sign-in only. The credential file is public and this browser-only gate does not protect employee data.
          Do not use real passwords or rely on it for security.
        </p>
      </section>
    </main>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used inside AuthProvider');
  return context;
}
