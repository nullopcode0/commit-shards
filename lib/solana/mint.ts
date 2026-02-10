import { createUmi } from '@metaplex-foundation/umi-bundle-defaults';
import { mplTokenMetadata, createNft } from '@metaplex-foundation/mpl-token-metadata';
import { walletAdapterIdentity } from '@metaplex-foundation/umi-signer-wallet-adapters';
import { generateSigner, percentAmount, publicKey, sol, some, transactionBuilder } from '@metaplex-foundation/umi';
import { transferSol } from '@metaplex-foundation/mpl-toolbox';
import type { WalletAdapter } from '@solana/wallet-adapter-base';

const DEVNET_RPC = 'https://api.devnet.solana.com';
const CREATOR_WALLET = publicKey('CGiuetrCxiaibJuxxCvrRjMyEjgmVEngxmvBXJtrmB5y');
const MINT_PRICE = sol(0.05);
const COLLECTION_MINT = publicKey(
  (process.env.NEXT_PUBLIC_COLLECTION_MINT || '66XzVHiPnnteArtAnsWjPG7445DD5rsuBJxt4h5Lv7UN').trim()
);

export async function mintShard(
  wallet: WalletAdapter,
  metadataUri: string,
  name: string,
) {
  const umi = createUmi(DEVNET_RPC)
    .use(mplTokenMetadata())
    .use(walletAdapterIdentity(wallet));

  const mint = generateSigner(umi);
  const userWallet = umi.identity.publicKey;

  const tx = transactionBuilder()
    .add(
      transferSol(umi, {
        source: umi.identity,
        destination: CREATOR_WALLET,
        amount: MINT_PRICE,
      })
    )
    .add(
      createNft(umi, {
        mint,
        name,
        symbol: 'COMSHARD',
        uri: metadataUri,
        sellerFeeBasisPoints: percentAmount(5),
        collection: some({ key: COLLECTION_MINT, verified: false }),
        creators: some([
          { address: CREATOR_WALLET, verified: false, share: 0 },
          { address: userWallet, verified: false, share: 100 },
        ]),
        printSupply: some({ __kind: 'Zero' as const }),
      })
    );

  const result = await tx.sendAndConfirm(umi);
  return {
    mintAddress: mint.publicKey,
    signature: result.signature,
  };
}

/** Batch mint: build all txs, sign all at once (single wallet popup), send all in parallel */
export async function mintShardBatch(
  wallet: WalletAdapter,
  shards: { metadataUri: string; name: string }[],
) {
  const umi = createUmi(DEVNET_RPC)
    .use(mplTokenMetadata())
    .use(walletAdapterIdentity(wallet));

  const userWallet = umi.identity.publicKey;
  const mints = shards.map(() => generateSigner(umi));

  const builders = shards.map((shard, i) =>
    transactionBuilder()
      .add(
        transferSol(umi, {
          source: umi.identity,
          destination: CREATOR_WALLET,
          amount: MINT_PRICE,
        })
      )
      .add(
        createNft(umi, {
          mint: mints[i],
          name: shard.name,
          symbol: 'COMSHARD',
          uri: shard.metadataUri,
          sellerFeeBasisPoints: percentAmount(5),
          collection: some({ key: COLLECTION_MINT, verified: false }),
          creators: some([
            { address: CREATOR_WALLET, verified: false, share: 0 },
            { address: userWallet, verified: false, share: 100 },
          ]),
          printSupply: some({ __kind: 'Zero' as const }),
        })
      )
  );

  // Get single blockhash for the whole batch
  const blockhash = await umi.rpc.getLatestBlockhash();

  // Build and sign with each mint's keypair (local, no popup)
  const partiallySignedTxs = await Promise.all(
    builders.map(async (builder, i) => {
      const tx = builder.setBlockhash(blockhash).build(umi);
      return mints[i].signTransaction(tx);
    })
  );

  // Batch sign with wallet — single popup for all transactions
  const signedTxs = await umi.identity.signAllTransactions(partiallySignedTxs);

  // Send all transactions in parallel
  const signatures = await Promise.all(
    signedTxs.map((tx) => umi.rpc.sendTransaction(tx))
  );

  // Confirm all in parallel
  await Promise.all(
    signatures.map((sig) =>
      umi.rpc.confirmTransaction(sig, {
        strategy: { type: 'blockhash', ...blockhash },
      })
    )
  );

  return mints.map((mint, i) => ({
    mintAddress: mint.publicKey,
    signature: signatures[i],
  }));
}
