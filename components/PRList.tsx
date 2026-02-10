'use client';

import type { PRData } from '@/lib/github';

interface Props {
  prs: PRData[];
  selected: Set<number>;
  onToggle: (idx: number) => void;
}

export function PRList({ prs, selected, onToggle }: Props) {
  return (
    <div className="pr-list">
      <h3>Select PRs to mint</h3>
      {prs.map((pr, i) => (
        <label key={pr.sha} className={`pr-item ${selected.has(i) ? 'selected' : ''}`}>
          <input
            type="checkbox"
            checked={selected.has(i)}
            onChange={() => onToggle(i)}
          />
          <div className="pr-info">
            <span className="pr-repo">{pr.repo}</span>
            <span className="pr-title">{pr.title}</span>
            <span className="pr-date">{new Date(pr.date).toLocaleDateString()}</span>
          </div>
        </label>
      ))}
    </div>
  );
}
