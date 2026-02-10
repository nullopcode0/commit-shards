import { Connection, PublicKey } from '@solana/web3.js';
import { NextResponse } from 'next/server';

// Alchemy free tier doesn't support getProgramAccounts — use public RPC for that,
// Alchemy for batched owner lookups
const ALCHEMY_RPC = process.env.SOLANA_RPC_URL || 'https://api.devnet.solana.com';
const PUBLIC_RPC = 'https://api.devnet.solana.com';
const METADATA_PROGRAM = new PublicKey('metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s');

// Metadata account layout (Borsh-serialized):
// key(1) + update_auth(32) + mint(32) + name_len(4) + name(32) + symbol_len(4) + symbol(10)
const MINT_OFFSET = 33;
const SYMBOL_DATA_OFFSET = 105; // 1 + 32 + 32 + 4 + 32 + 4

// Inline base58 encoder
const B58 = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
function toBase58(bytes: Uint8Array): string {
  let num = 0n;
  for (const b of bytes) num = num * 256n + BigInt(b);
  let str = '';
  while (num > 0n) {
    str = B58[Number(num % 58n)] + str;
    num /= 58n;
  }
  for (const b of bytes) {
    if (b === 0) str = '1' + str;
    else break;
  }
  return str || '1';
}

// Filter: symbol == "COMSHARD" (unique to Commit Shards — no collisions)
const COMSHARD_SYMBOL_B58 = toBase58(new TextEncoder().encode('COMSHARD'));

// ISR: Vercel CDN caches for 5 min, serves stale while revalidating in background
export const revalidate = 300;
export const maxDuration = 60;

export async function GET() {
  try {
    const publicConn = new Connection(PUBLIC_RPC);

    // 1. gPA with memcmp on unique "COMSHARD" symbol
    const metadataAccounts = await publicConn.getProgramAccounts(METADATA_PROGRAM, {
      filters: [
        { memcmp: { offset: SYMBOL_DATA_OFFSET, bytes: COMSHARD_SYMBOL_B58 } },
      ],
      dataSlice: { offset: MINT_OFFSET, length: 68 },
    });

    // Parse mint address + name from each account
    const shardMints: { mintAddress: string; name: string }[] = [];
    for (const { account } of metadataAccounts) {
      const d = account.data;
      const mintAddress = new PublicKey(d.slice(0, 32)).toBase58();
      const name = Buffer.from(d.slice(36, 68)).toString('utf8').replace(/\0/g, '').trim();
      shardMints.push({ mintAddress, name });
    }

    if (shardMints.length === 0) {
      return NextResponse.json({ entries: [], total: 0 });
    }

    // 2. Batch getTokenLargestAccounts — 1 HTTP request instead of N
    const batchLargest = shardMints.map((s, i) => ({
      jsonrpc: '2.0',
      id: i,
      method: 'getTokenLargestAccounts',
      params: [s.mintAddress],
    }));

    const largestRes = await fetch(ALCHEMY_RPC, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(batchLargest),
    });
    const largestData = await largestRes.json();
    const largestArr: any[] = Array.isArray(largestData) ? largestData : [largestData];
    largestArr.sort((a: any, b: any) => a.id - b.id);

    // Extract token accounts that hold exactly 1 token
    const tokenAccts: { addr: string; shardIdx: number }[] = [];
    for (const r of largestArr) {
      const val = r.result?.value;
      if (val?.[0]?.uiAmount === 1) {
        tokenAccts.push({ addr: val[0].address, shardIdx: r.id });
      }
    }

    // 3. Batch getAccountInfo (jsonParsed) — 1 HTTP request instead of N
    const ownerMap: Record<string, { mintAddress: string; name: string }[]> = {};

    if (tokenAccts.length > 0) {
      const batchInfo = tokenAccts.map((t, i) => ({
        jsonrpc: '2.0',
        id: i,
        method: 'getAccountInfo',
        params: [t.addr, { encoding: 'jsonParsed' }],
      }));

      const infoRes = await fetch(ALCHEMY_RPC, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(batchInfo),
      });
      const infoData = await infoRes.json();
      const infoArr: any[] = Array.isArray(infoData) ? infoData : [infoData];
      infoArr.sort((a: any, b: any) => a.id - b.id);

      for (let i = 0; i < infoArr.length; i++) {
        const owner = infoArr[i]?.result?.value?.data?.parsed?.info?.owner;
        if (owner) {
          const { mintAddress, name } = shardMints[tokenAccts[i].shardIdx];
          if (!ownerMap[owner]) ownerMap[owner] = [];
          ownerMap[owner].push({ mintAddress, name });
        }
      }
    }

    const entries = Object.entries(ownerMap)
      .map(([wallet, shards]) => ({ wallet, count: shards.length, shards }))
      .sort((a, b) => b.count - a.count);

    return NextResponse.json({ entries, total: shardMints.length });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || 'Failed to build leaderboard' },
      { status: 500 }
    );
  }
}
