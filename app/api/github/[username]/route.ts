import { NextResponse } from 'next/server';
import type { PRData } from '@/lib/github';

export async function GET(
  _req: Request,
  { params }: { params: { username: string } },
) {
  const { username } = params;

  if (!username || username.length > 39) {
    return NextResponse.json({ error: 'Invalid username' }, { status: 400 });
  }

  try {
    // Search for merged PRs by this author
    const searchUrl = `https://api.github.com/search/issues?q=author:${encodeURIComponent(username)}+type:pr+is:merged&sort=updated&order=desc&per_page=20`;
    const searchRes = await fetch(searchUrl, {
      headers: { Accept: 'application/vnd.github.v3+json' },
    });

    if (!searchRes.ok) {
      const msg = searchRes.status === 403 ? 'GitHub rate limit hit, try again in a minute' : 'GitHub API error';
      return NextResponse.json({ error: msg }, { status: searchRes.status });
    }

    const searchData = await searchRes.json();
    const items = searchData.items || [];

    // Fetch merge_commit_sha for each PR (max 10 concurrent)
    const prDetails = await Promise.all(
      items.slice(0, 10).map(async (item: any): Promise<PRData | null> => {
        try {
          // Extract owner/repo from repository_url
          const repoUrl: string = item.repository_url;
          const repoParts = repoUrl.replace('https://api.github.com/repos/', '');
          const prNumber = item.number;

          const prRes = await fetch(
            `https://api.github.com/repos/${repoParts}/pulls/${prNumber}`,
            { headers: { Accept: 'application/vnd.github.v3+json' } },
          );

          if (!prRes.ok) return null;
          const prData = await prRes.json();

          if (!prData.merge_commit_sha) return null;

          return {
            number: prNumber,
            title: item.title,
            repo: repoParts,
            sha: prData.merge_commit_sha,
            url: item.html_url,
            date: item.created_at,
          };
        } catch {
          return null;
        }
      }),
    );

    const prs = prDetails.filter((pr): pr is PRData => pr !== null);

    return NextResponse.json({ prs });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || 'Failed to fetch PRs' },
      { status: 500 },
    );
  }
}
