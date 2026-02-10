'use client';

import { useMemo } from 'react';
import { generateShardSVG, type ShardConfig } from '@/lib/shard-generator';

interface Props {
  config: ShardConfig;
}

export function ShardPreview({ config }: Props) {
  const svg = useMemo(() => generateShardSVG(config), [config.commitSha, config.repo, config.title, config.author]);

  return (
    <div
      className="shard-preview"
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  );
}
