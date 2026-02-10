/**
 * Commit Shards v2 — Animated crystal art from git commit SHAs
 *
 * Features:
 * - Nebula/space background with stars
 * - Crystal spawning animation (shards grow from center burst)
 * - Energy crack lines that draw in
 * - Pulsing glow effects
 * - Drifting particles
 * - Lightning arcs between shards
 */

import { writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

// ─── SEEDED RNG ──────────────────────────────────────────────────────────

class ShardRNG {
  private state: number;

  constructor(seed: number) {
    this.state = seed;
  }

  next(): number {
    this.state ^= this.state << 13;
    this.state ^= this.state >> 17;
    this.state ^= this.state << 5;
    return (this.state >>> 0) / 0xffffffff;
  }

  range(min: number, max: number): number {
    return min + this.next() * (max - min);
  }

  int(min: number, max: number): number {
    return Math.floor(this.range(min, max + 1));
  }
}

// ─── COLOR ───────────────────────────────────────────────────────────────

function hsl(h: number, s: number, l: number, a = 1): string {
  return `hsla(${h.toFixed(0)}, ${s.toFixed(0)}%, ${l.toFixed(0)}%, ${a.toFixed(3)})`;
}

const REPO_HUES: Record<string, number> = {
  agave: 160, solana: 170, anchor: 210, metaplex: 280,
};

function getRepoHue(repo: string, fallback: number): number {
  const key = repo.toLowerCase().split('/').pop() || '';
  return REPO_HUES[key] ?? fallback;
}

// ─── GEOMETRY ────────────────────────────────────────────────────────────

interface Point { x: number; y: number; }

interface Shard {
  vertices: Point[];
  hue: number;
  sat: number;
  lit: number;
  opacity: number;
  angle: number;
  length: number;
}

function shardVertices(
  rng: ShardRNG, cx: number, cy: number,
  angle: number, length: number, width: number,
): Point[] {
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  const pc = Math.cos(angle + Math.PI / 2);
  const ps = Math.sin(angle + Math.PI / 2);

  const tipX = cx + cos * length;
  const tipY = cy + sin * length;
  const baseOff = length * rng.range(0.15, 0.35);
  const midX = cx + cos * baseOff;
  const midY = cy + sin * baseOff;
  const w1 = width * rng.range(0.5, 1.0);
  const w2 = width * rng.range(0.5, 1.0);

  const verts: Point[] = [
    { x: cx, y: cy },
    { x: midX + pc * w1, y: midY + ps * w1 },
    { x: tipX + pc * width * 0.03, y: tipY + ps * width * 0.03 },
    { x: midX - pc * w2, y: midY - ps * w2 },
  ];

  // Extra facet for complexity
  if (rng.next() > 0.3) {
    const t = rng.range(0.35, 0.7);
    const ex = cx + cos * length * t;
    const ey = cy + sin * length * t;
    const side = rng.next() > 0.5 ? 1 : -1;
    const ew = width * rng.range(0.15, 0.45) * side;
    verts.splice(2, 0, { x: ex + pc * ew, y: ey + ps * ew });
  }

  // Second extra facet
  if (rng.next() > 0.5) {
    const t = rng.range(0.5, 0.85);
    const ex = cx + cos * length * t;
    const ey = cy + sin * length * t;
    const side = rng.next() > 0.5 ? 1 : -1;
    const ew = width * rng.range(0.1, 0.3) * side;
    verts.splice(3, 0, { x: ex + pc * ew, y: ey + ps * ew });
  }

  return verts;
}

// ─── SVG GENERATION ──────────────────────────────────────────────────────

interface ShardConfig {
  commitSha: string;
  repo: string;
  title?: string;
  author?: string;
  size?: number;
}

export function generateShardSVG(config: ShardConfig): string {
  const { commitSha, repo, title, author, size = 800 } = config;

  const bytes: number[] = [];
  for (let i = 0; i < commitSha.length - 1; i += 2) {
    bytes.push(parseInt(commitSha.slice(i, i + 2), 16));
  }

  const seed = (bytes[0] << 24) | (bytes[1] << 16) | (bytes[2] << 8) | bytes[3];
  const rng = new ShardRNG(seed || 1);

  const hashHue = ((bytes[0] << 8) | bytes[1]) % 360;
  const baseHue = getRepoHue(repo, hashHue);
  const baseSat = 55 + (bytes[2] % 35);
  const shardCount = 6 + (bytes[3] % 7); // 6-12
  const cx = size / 2 + (bytes[4] - 128) * 0.12;
  const cy = size / 2 + (bytes[5] - 128) * 0.12;

  // Accent hue (complementary or analogous)
  const accentHue = rng.next() > 0.5
    ? (baseHue + 30 + rng.range(0, 20)) % 360
    : (baseHue + 150 + rng.range(0, 60)) % 360;

  // ── Generate shards ──
  const shards: Shard[] = [];

  for (let i = 0; i < shardCount; i++) {
    const angle = (i / shardCount) * Math.PI * 2 + rng.range(-0.25, 0.25);
    const length = rng.range(size * 0.22, size * 0.44);
    const width = rng.range(size * 0.03, size * 0.09);
    const vertices = shardVertices(rng, cx, cy, angle, length, width);

    const useAccent = rng.next() > 0.75;
    const h = useAccent ? accentHue + rng.range(-15, 15) : baseHue + rng.range(-25, 25);

    shards.push({
      vertices, angle, length,
      hue: h,
      sat: baseSat + rng.range(-15, 15),
      lit: rng.range(30, 70),
      opacity: rng.range(0.55, 0.9),
    });
  }

  // Secondary shards
  const secCount = 4 + rng.int(0, 6);
  for (let i = 0; i < secCount; i++) {
    const angle = rng.range(0, Math.PI * 2);
    const dist = rng.range(size * 0.03, size * 0.12);
    const ox = cx + Math.cos(angle) * dist;
    const oy = cy + Math.sin(angle) * dist;
    const length = rng.range(size * 0.08, size * 0.22);
    const width = rng.range(size * 0.015, size * 0.04);
    const vertices = shardVertices(rng, ox, oy, angle + rng.range(-0.4, 0.4), length, width);

    shards.push({
      vertices, angle, length,
      hue: baseHue + rng.range(-35, 35),
      sat: baseSat + rng.range(-20, 5),
      lit: rng.range(18, 40),
      opacity: rng.range(0.3, 0.55),
    });
  }

  // ── Build SVG sections ──
  const bgHue = (baseHue + 180) % 360;
  const stars = buildStarfield(rng, size, baseHue);
  const nebula = buildNebula(rng, cx, cy, baseHue, accentHue, size);
  const defs = buildDefs(shards, baseHue, baseSat, accentHue, rng, size, cx, cy);
  const shardEls = shards.map((s, i) => buildShard(s, i, cx, cy, size)).join('\n');
  const cracks = buildCracks(shards, rng, baseHue, accentHue);
  const lightning = buildLightning(shards, rng, baseHue, accentHue, cx, cy, size);
  const particles = buildParticles(rng, cx, cy, baseHue, accentHue, size);
  const centerBurst = buildCenterBurst(cx, cy, baseHue, baseSat, accentHue, size);
  const animations = buildAnimations(shards.length, baseHue, size);

  const shortSha = commitSha.slice(0, 8);
  const metaText = title ? `${shortSha} — ${title.slice(0, 45)}` : shortSha;

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}" width="${size}" height="${size}">
  <defs>
    ${defs}
  </defs>
  <style>
    ${animations}
  </style>

  <!-- Deep space background -->
  <rect width="${size}" height="${size}" fill="${hsl(bgHue, 12, 2)}"/>
  ${nebula}
  ${stars}

  <!-- Vignette -->
  <rect width="${size}" height="${size}" fill="url(#vignette)"/>

  <!-- Center spawn burst -->
  ${centerBurst}

  <!-- Crystal shards (animated spawn) -->
  <g filter="url(#shardGlow)">
    ${shardEls}
  </g>

  <!-- Inner reflections -->
  ${buildReflections(shards, rng, size)}

  <!-- Energy cracks -->
  ${cracks}

  <!-- Lightning arcs -->
  ${lightning}

  <!-- Floating particles -->
  ${particles}

  <!-- Subtle scan line overlay -->
  <rect width="${size}" height="${size}" fill="url(#scanlines)" opacity="0.03"/>

  <!-- Metadata -->
  <g class="meta-fade">
    <text x="${size - 18}" y="${size - 18}" text-anchor="end" font-family="'SF Mono', 'Fira Code', monospace" font-size="10" fill="${hsl(baseHue, 40, 50, 0.7)}" letter-spacing="0.5">${metaText}</text>
    ${author ? `<text x="${size - 18}" y="${size - 32}" text-anchor="end" font-family="'SF Mono', 'Fira Code', monospace" font-size="9" fill="${hsl(baseHue, 30, 40, 0.5)}" letter-spacing="0.5">${author}</text>` : ''}
  </g>
</svg>`;
}

// ─── STARFIELD ───────────────────────────────────────────────────────────

function buildStarfield(rng: ShardRNG, size: number, hue: number): string {
  const stars: string[] = [];
  const count = 80 + rng.int(0, 60);

  for (let i = 0; i < count; i++) {
    const x = rng.range(0, size);
    const y = rng.range(0, size);
    const r = rng.range(0.3, 1.8);
    const bright = rng.range(0.15, 0.7);
    const twinkle = rng.next() > 0.7;
    const starHue = rng.next() > 0.8 ? hue + rng.range(-30, 30) : 0;
    const starSat = starHue ? rng.range(20, 50) : 0;
    const cls = twinkle ? ` class="twinkle" style="animation-delay:${rng.range(0, 4).toFixed(1)}s"` : '';
    stars.push(`<circle cx="${x.toFixed(0)}" cy="${y.toFixed(0)}" r="${r.toFixed(1)}" fill="${hsl(starHue, starSat, 90, bright)}"${cls}/>`);
  }

  return `<g>${stars.join('\n  ')}</g>`;
}

// ─── NEBULA ──────────────────────────────────────────────────────────────

function buildNebula(rng: ShardRNG, cx: number, cy: number, hue: number, accent: number, size: number): string {
  const clouds: string[] = [];
  const count = 3 + rng.int(0, 3);

  for (let i = 0; i < count; i++) {
    const x = cx + rng.range(-size * 0.3, size * 0.3);
    const y = cy + rng.range(-size * 0.3, size * 0.3);
    const rx = rng.range(size * 0.15, size * 0.4);
    const ry = rng.range(size * 0.1, size * 0.35);
    const rotation = rng.range(0, 360);
    const useAccent = rng.next() > 0.6;
    const h = useAccent ? accent : hue;
    const opacity = rng.range(0.04, 0.12);

    clouds.push(`<ellipse cx="${x.toFixed(0)}" cy="${y.toFixed(0)}" rx="${rx.toFixed(0)}" ry="${ry.toFixed(0)}"
      transform="rotate(${rotation.toFixed(0)} ${x.toFixed(0)} ${y.toFixed(0)})"
      fill="${hsl(h, 40, 25, opacity)}" filter="url(#nebulaBlur)"/>`);
  }

  // Bright core nebula around center
  clouds.push(`<ellipse cx="${cx.toFixed(0)}" cy="${cy.toFixed(0)}" rx="${(size * 0.18).toFixed(0)}" ry="${(size * 0.18).toFixed(0)}"
    fill="${hsl(hue, 50, 20, 0.08)}" filter="url(#nebulaBlur)"/>`);
  clouds.push(`<ellipse cx="${cx.toFixed(0)}" cy="${cy.toFixed(0)}" rx="${(size * 0.1).toFixed(0)}" ry="${(size * 0.1).toFixed(0)}"
    fill="${hsl(hue, 60, 30, 0.06)}" filter="url(#nebulaBlur)"/>`);

  return `<g class="nebula-pulse">${clouds.join('\n  ')}</g>`;
}

// ─── DEFS ────────────────────────────────────────────────────────────────

function buildDefs(
  shards: Shard[], hue: number, sat: number, accent: number,
  rng: ShardRNG, size: number, cx: number, cy: number,
): string {
  const grads = shards.map((s, i) => {
    const ang = rng.range(0, 360);
    // More dramatic gradient with brighter highlights
    return `<linearGradient id="sg${i}" gradientTransform="rotate(${ang.toFixed(0)})">
      <stop offset="0%" stop-color="${hsl(s.hue, s.sat + 10, s.lit + 25, 0.9)}" />
      <stop offset="30%" stop-color="${hsl(s.hue, s.sat, s.lit + 10)}" />
      <stop offset="70%" stop-color="${hsl(s.hue, s.sat, s.lit)}" />
      <stop offset="100%" stop-color="${hsl(s.hue + 15, s.sat - 10, s.lit - 20)}" />
    </linearGradient>`;
  }).join('\n    ');

  return `${grads}

    <!-- Vignette -->
    <radialGradient id="vignette" cx="50%" cy="50%">
      <stop offset="40%" stop-color="transparent"/>
      <stop offset="100%" stop-color="${hsl(0, 0, 0, 0.7)}"/>
    </radialGradient>

    <!-- Scan lines pattern -->
    <pattern id="scanlines" width="4" height="4" patternUnits="userSpaceOnUse">
      <line x1="0" y1="0" x2="4" y2="0" stroke="white" stroke-width="0.5" opacity="0.3"/>
    </pattern>

    <!-- Center burst gradient -->
    <radialGradient id="burstGrad" cx="50%" cy="50%">
      <stop offset="0%" stop-color="${hsl(hue, 80, 90, 0.8)}"/>
      <stop offset="20%" stop-color="${hsl(hue, 70, 70, 0.4)}"/>
      <stop offset="50%" stop-color="${hsl(hue, 50, 40, 0.1)}"/>
      <stop offset="100%" stop-color="transparent"/>
    </radialGradient>

    <!-- Filters -->
    <filter id="shardGlow" x="-30%" y="-30%" width="160%" height="160%">
      <feGaussianBlur in="SourceGraphic" stdDeviation="2" result="blur1"/>
      <feGaussianBlur in="SourceGraphic" stdDeviation="6" result="blur2"/>
      <feMerge>
        <feMergeNode in="blur2"/>
        <feMergeNode in="blur1"/>
        <feMergeNode in="SourceGraphic"/>
      </feMerge>
    </filter>
    <filter id="nebulaBlur" x="-100%" y="-100%" width="300%" height="300%">
      <feGaussianBlur stdDeviation="40"/>
    </filter>
    <filter id="softGlow" x="-100%" y="-100%" width="300%" height="300%">
      <feGaussianBlur stdDeviation="10"/>
    </filter>
    <filter id="crackGlow" x="-100%" y="-100%" width="300%" height="300%">
      <feGaussianBlur stdDeviation="3"/>
    </filter>
    <filter id="hardGlow" x="-50%" y="-50%" width="200%" height="200%">
      <feGaussianBlur stdDeviation="1.5"/>
    </filter>
    <filter id="lightningGlow" x="-50%" y="-50%" width="200%" height="200%">
      <feGaussianBlur in="SourceGraphic" stdDeviation="2" result="blur"/>
      <feGaussianBlur in="SourceGraphic" stdDeviation="5" result="blur2"/>
      <feMerge>
        <feMergeNode in="blur2"/>
        <feMergeNode in="blur"/>
        <feMergeNode in="SourceGraphic"/>
      </feMerge>
    </filter>`;
}

// ─── SHARD ELEMENTS ──────────────────────────────────────────────────────

function buildShard(shard: Shard, idx: number, cx: number, cy: number, size: number): string {
  const pts = shard.vertices.map(v => `${v.x.toFixed(1)},${v.y.toFixed(1)}`).join(' ');

  // Edge highlight (bright top edge)
  const v = shard.vertices;
  const edgePath = v.length >= 3
    ? `M${v[0].x.toFixed(1)},${v[0].y.toFixed(1)} L${v[1].x.toFixed(1)},${v[1].y.toFixed(1)} L${v[2].x.toFixed(1)},${v[2].y.toFixed(1)}`
    : '';

  // Inner reflection line
  const mid = Math.floor(v.length / 2);
  const refLine = `<line x1="${v[0].x.toFixed(1)}" y1="${v[0].y.toFixed(1)}" x2="${v[mid].x.toFixed(1)}" y2="${v[mid].y.toFixed(1)}"
    stroke="${hsl(shard.hue, shard.sat, shard.lit + 35, 0.25)}" stroke-width="0.7"/>`;

  const delay = (idx * 0.12).toFixed(2);

  return `<g class="shard-spawn" style="animation-delay:${delay}s; transform-origin:${cx.toFixed(0)}px ${cy.toFixed(0)}px" opacity="${shard.opacity.toFixed(2)}">
      <polygon points="${pts}" fill="url(#sg${idx})"
        stroke="${hsl(shard.hue, shard.sat + 10, shard.lit + 30, 0.7)}" stroke-width="0.6"/>
      ${edgePath ? `<path d="${edgePath}" fill="none" stroke="${hsl(shard.hue, shard.sat, shard.lit + 40, 0.4)}" stroke-width="1.2" filter="url(#hardGlow)"/>` : ''}
      ${refLine}
    </g>`;
}

// ─── REFLECTIONS ─────────────────────────────────────────────────────────

function buildReflections(shards: Shard[], rng: ShardRNG, size: number): string {
  const refs: string[] = [];

  for (const shard of shards) {
    if (rng.next() > 0.5) continue;
    const v = shard.vertices;
    if (v.length < 4) continue;

    // Small bright polygon inside the shard (light reflection)
    const t = rng.range(0.3, 0.6);
    const refVerts = v.slice(0, 3).map(p => ({
      x: v[0].x + (p.x - v[0].x) * t,
      y: v[0].y + (p.y - v[0].y) * t,
    }));
    const pts = refVerts.map(p => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');
    refs.push(`<polygon points="${pts}" fill="${hsl(shard.hue, shard.sat - 10, shard.lit + 35, 0.15)}" class="reflection-pulse"/>`);
  }

  return `<g>${refs.join('\n  ')}</g>`;
}

// ─── CRACKS ──────────────────────────────────────────────────────────────

function buildCracks(shards: Shard[], rng: ShardRNG, hue: number, accent: number): string {
  const lines: string[] = [];
  const count = Math.min(8, shards.length - 1);

  for (let i = 0; i < count; i++) {
    const a = shards[i].vertices[0];
    const b = shards[(i + 1) % shards.length].vertices[0];

    let path = `M${a.x.toFixed(1)},${a.y.toFixed(1)}`;
    const steps = 3 + rng.int(0, 4);
    for (let j = 1; j <= steps; j++) {
      const t = j / (steps + 1);
      const mx = a.x + (b.x - a.x) * t + rng.range(-12, 12);
      const my = a.y + (b.y - a.y) * t + rng.range(-12, 12);
      path += ` L${mx.toFixed(1)},${my.toFixed(1)}`;
    }
    path += ` L${b.x.toFixed(1)},${b.y.toFixed(1)}`;

    const useAccent = rng.next() > 0.7;
    const h = useAccent ? accent : hue;
    const glow = rng.range(0.3, 0.8);
    const delay = (0.8 + i * 0.1).toFixed(2);
    const len = rng.range(100, 300);

    lines.push(`<path d="${path}" stroke="${hsl(h, 70, 75, glow)}" stroke-width="1"
      fill="none" filter="url(#crackGlow)"
      class="crack-draw" style="animation-delay:${delay}s"
      stroke-dasharray="${len.toFixed(0)}" stroke-dashoffset="${len.toFixed(0)}"/>`);
  }

  return `<g opacity="0.7">${lines.join('\n  ')}</g>`;
}

// ─── LIGHTNING ───────────────────────────────────────────────────────────

function buildLightning(
  shards: Shard[], rng: ShardRNG, hue: number, accent: number,
  cx: number, cy: number, size: number,
): string {
  const bolts: string[] = [];
  const count = 2 + rng.int(0, 3);

  for (let i = 0; i < count; i++) {
    const shard = shards[rng.int(0, Math.min(shards.length - 1, 8))];
    const tip = shard.vertices[Math.min(2, shard.vertices.length - 1)];

    // Lightning from center to shard tip
    let path = `M${cx.toFixed(1)},${cy.toFixed(1)}`;
    const segments = 4 + rng.int(0, 4);
    for (let j = 1; j <= segments; j++) {
      const t = j / (segments + 1);
      const bx = cx + (tip.x - cx) * t + rng.range(-15, 15);
      const by = cy + (tip.y - cy) * t + rng.range(-15, 15);
      path += ` L${bx.toFixed(1)},${by.toFixed(1)}`;
    }
    path += ` L${tip.x.toFixed(1)},${tip.y.toFixed(1)}`;

    const h = rng.next() > 0.5 ? accent : hue;
    const delay = rng.range(1.5, 3.0);

    bolts.push(`<path d="${path}" stroke="${hsl(h, 80, 80, 0.7)}" stroke-width="1.5"
      fill="none" filter="url(#lightningGlow)"
      class="lightning-flash" style="animation-delay:${delay.toFixed(1)}s"/>`);

    // Branch
    if (rng.next() > 0.4) {
      const branchFrom = rng.int(1, segments);
      const t = branchFrom / (segments + 1);
      const startX = cx + (tip.x - cx) * t;
      const startY = cy + (tip.y - cy) * t;
      const branchAngle = Math.atan2(tip.y - cy, tip.x - cx) + rng.range(-0.8, 0.8);
      const branchLen = rng.range(20, 60);

      let bPath = `M${startX.toFixed(1)},${startY.toFixed(1)}`;
      const bx2 = startX + Math.cos(branchAngle) * branchLen * 0.5 + rng.range(-8, 8);
      const by2 = startY + Math.sin(branchAngle) * branchLen * 0.5 + rng.range(-8, 8);
      const bx3 = startX + Math.cos(branchAngle) * branchLen;
      const by3 = startY + Math.sin(branchAngle) * branchLen;
      bPath += ` L${bx2.toFixed(1)},${by2.toFixed(1)} L${bx3.toFixed(1)},${by3.toFixed(1)}`;

      bolts.push(`<path d="${bPath}" stroke="${hsl(h, 70, 75, 0.4)}" stroke-width="0.8"
        fill="none" filter="url(#lightningGlow)"
        class="lightning-flash" style="animation-delay:${(delay + 0.1).toFixed(1)}s"/>`);
    }
  }

  return `<g>${bolts.join('\n  ')}</g>`;
}

// ─── PARTICLES ───────────────────────────────────────────────────────────

function buildParticles(rng: ShardRNG, cx: number, cy: number, hue: number, accent: number, size: number): string {
  const parts: string[] = [];
  const count = 15 + rng.int(0, 20);

  for (let i = 0; i < count; i++) {
    const angle = rng.range(0, Math.PI * 2);
    const dist = rng.range(size * 0.05, size * 0.45);
    const x = cx + Math.cos(angle) * dist;
    const y = cy + Math.sin(angle) * dist;
    const r = rng.range(0.5, 3.0);
    const useAccent = rng.next() > 0.7;
    const h = useAccent ? accent : hue + rng.range(-20, 20);
    const l = rng.range(55, 85);
    const a = rng.range(0.2, 0.6);
    const drift = rng.range(8, 25);
    const dur = rng.range(3, 7);
    const delay = rng.range(0, 3);

    parts.push(`<circle cx="${x.toFixed(0)}" cy="${y.toFixed(0)}" r="${r.toFixed(1)}"
      fill="${hsl(h, 60, l, a)}" filter="url(#softGlow)"
      class="particle-drift" style="--drift:${drift.toFixed(0)}px;animation-duration:${dur.toFixed(1)}s;animation-delay:${delay.toFixed(1)}s"/>`);
  }

  return `<g>${parts.join('\n  ')}</g>`;
}

// ─── CENTER BURST ────────────────────────────────────────────────────────

function buildCenterBurst(cx: number, cy: number, hue: number, sat: number, accent: number, size: number): string {
  const r1 = size * 0.15;
  const r2 = size * 0.06;
  const r3 = size * 0.025;

  return `<g class="burst-fade">
    <circle cx="${cx.toFixed(0)}" cy="${cy.toFixed(0)}" r="${r1.toFixed(0)}" fill="url(#burstGrad)" filter="url(#softGlow)"/>
    <circle cx="${cx.toFixed(0)}" cy="${cy.toFixed(0)}" r="${r2.toFixed(0)}" fill="${hsl(hue, sat, 80, 0.5)}" filter="url(#softGlow)"/>
    <circle cx="${cx.toFixed(0)}" cy="${cy.toFixed(0)}" r="${r3.toFixed(0)}" fill="${hsl(hue, sat, 95, 0.9)}" filter="url(#hardGlow)" class="core-pulse"/>
  </g>`;
}

// ─── ANIMATIONS ──────────────────────────────────────────────────────────

function buildAnimations(shardCount: number, hue: number, size: number): string {
  return `
    /* Shard spawn: scale from 0 at center */
    .shard-spawn {
      animation: spawnIn 0.8s cubic-bezier(0.16, 1, 0.3, 1) both;
    }
    @keyframes spawnIn {
      0% { transform: scale(0); opacity: 0; }
      60% { transform: scale(1.05); }
      100% { transform: scale(1); opacity: 1; }
    }

    /* Center burst fade after spawn */
    .burst-fade {
      animation: burstFade 2s ease-out 0.3s both;
    }
    @keyframes burstFade {
      0% { opacity: 1; transform: scale(0.3); }
      30% { opacity: 1; transform: scale(1.2); }
      100% { opacity: 0.15; transform: scale(1); }
    }

    /* Core pulse (continuous) */
    .core-pulse {
      animation: corePulse 2s ease-in-out infinite;
    }
    @keyframes corePulse {
      0%, 100% { opacity: 0.6; r: ${(size * 0.02).toFixed(0)}; }
      50% { opacity: 1; r: ${(size * 0.035).toFixed(0)}; }
    }

    /* Star twinkle */
    .twinkle {
      animation: twinkle 3s ease-in-out infinite;
    }
    @keyframes twinkle {
      0%, 100% { opacity: 0.3; }
      50% { opacity: 1; }
    }

    /* Nebula pulse */
    .nebula-pulse {
      animation: nebPulse 8s ease-in-out infinite;
    }
    @keyframes nebPulse {
      0%, 100% { opacity: 0.8; }
      50% { opacity: 1; }
    }

    /* Crack draw-in */
    .crack-draw {
      animation: drawCrack 0.6s ease-out both;
    }
    @keyframes drawCrack {
      to { stroke-dashoffset: 0; }
    }

    /* Lightning flash */
    .lightning-flash {
      animation: lightningFlash 3s ease-out infinite;
    }
    @keyframes lightningFlash {
      0% { opacity: 0; }
      5% { opacity: 1; }
      10% { opacity: 0.3; }
      12% { opacity: 0.8; }
      20% { opacity: 0; }
      100% { opacity: 0; }
    }

    /* Particle drift */
    .particle-drift {
      animation: pDrift linear infinite alternate;
    }
    @keyframes pDrift {
      0% { transform: translate(0, 0); opacity: 0.3; }
      50% { opacity: 0.8; }
      100% { transform: translate(var(--drift, 10px), calc(var(--drift, 10px) * -0.7)); opacity: 0.3; }
    }

    /* Reflection shimmer */
    .reflection-pulse {
      animation: refPulse 4s ease-in-out infinite alternate;
    }
    @keyframes refPulse {
      0% { opacity: 0.1; }
      100% { opacity: 0.3; }
    }

    /* Metadata fade in */
    .meta-fade {
      animation: metaIn 1s ease-out 2s both;
    }
    @keyframes metaIn {
      from { opacity: 0; }
      to { opacity: 1; }
    }
  `;
}

// ─── CLI ─────────────────────────────────────────────────────────────────

const commits = [
  {
    sha: 'e6be659721a6295cd5406462f9eae3532b8adb95',
    repo: 'anza-xyz/agave',
    title: 'cli: remove ConnectionCache::new_quic_for_tests from ping command',
    author: 'nullopcode0',
  },
  {
    sha: '975d0c3f38a69154c374ce6a95ae577394f05bf1',
    repo: 'anza-xyz/agave',
    title: 'cli: remove ConnectionCache::new_quic_for_tests from program deploy',
    author: 'nullopcode0',
  },
  {
    sha: '2bab970b57334995d86719fa3a7fbbba621c7116',
    repo: 'anza-xyz/agave',
    title: 'cli: remove ConnectionCache::new_quic_for_tests from program_v4',
    author: 'nullopcode0',
  },
];

const outputDir = join(__dirname, '..', 'output');

for (const c of commits) {
  const svg = generateShardSVG({ commitSha: c.sha, repo: c.repo, title: c.title, author: c.author });
  const fn = `shard-${c.sha.slice(0, 8)}.svg`;
  writeFileSync(join(outputDir, fn), svg);
  console.log(`Generated: ${fn}`);
}

const cliSha = process.argv[2];
if (cliSha) {
  const svg = generateShardSVG({
    commitSha: cliSha,
    repo: process.argv[3] || 'unknown',
    title: process.argv[4],
    author: process.argv[5],
  });
  const fn = `shard-${cliSha.slice(0, 8)}.svg`;
  writeFileSync(join(outputDir, fn), svg);
  console.log(`Generated: ${fn}`);
}
