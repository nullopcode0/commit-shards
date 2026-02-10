'use client';

import { useState, useEffect } from 'react';
import { useSession, signIn, signOut } from 'next-auth/react';
import type { PRData } from '@/lib/github';

interface Props {
  onPRsLoaded: (prs: PRData[], searchedUsername: string) => void;
  onArtOnly: () => void;
}

export function GitHubInput({ onPRsLoaded, onArtOnly }: Props) {
  const { data: session } = useSession();
  const githubUsername = (session as any)?.githubUsername as string | undefined;

  const [username, setUsername] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [autoFilled, setAutoFilled] = useState(false);

  // Auto-fill username from GitHub OAuth session (once only)
  useEffect(() => {
    if (githubUsername && !autoFilled) {
      setUsername(githubUsername);
      setAutoFilled(true);
    }
  }, [githubUsername, autoFilled]);

  const search = async () => {
    if (!username.trim()) return;
    setLoading(true);
    setError('');

    try {
      const res = await fetch(`/api/github/${encodeURIComponent(username.trim())}`);
      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Failed to fetch PRs');
        return;
      }

      if (data.prs.length === 0) {
        setError('No merged PRs found for this user');
        return;
      }

      onPRsLoaded(data.prs, username.trim());
    } catch {
      setError('Network error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mode-selector">
      {!session && (
        <button className="github-login-btn" onClick={() => signIn('github')}>
          Sign in with GitHub
        </button>
      )}
      {session && githubUsername && (
        <div className="github-verified-badge">
          Verified as <strong>{githubUsername}</strong>
          <button className="github-signout-btn" onClick={() => signOut()}>
            Sign out
          </button>
        </div>
      )}
      <div className="github-input">
        <input
          type="text"
          placeholder="GitHub username"
          value={username}
          onChange={e => setUsername(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && search()}
          disabled={loading}
        />
        <button onClick={search} disabled={loading || !username.trim()}>
          {loading ? 'Searching...' : 'Find PRs'}
        </button>
      </div>
      {error && <p className="error">{error}</p>}
      <div className="divider">
        <span>or</span>
      </div>
      <button className="art-only-btn" onClick={onArtOnly}>
        Just mint art (no GitHub needed)
      </button>
    </div>
  );
}
