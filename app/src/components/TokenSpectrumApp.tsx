import { useEffect, useMemo, useState } from 'react';
import { useAccount } from 'wagmi';
import { sepolia } from 'wagmi/chains';
import { Contract } from 'ethers';
import { createPublicClient, http, isAddress } from 'viem';

import { Header } from './Header';
import { useEthersSigner } from '../hooks/useEthersSigner';
import { useZamaInstance } from '../hooks/useZamaInstance';
import { DEPLOYED_CONTRACTS } from '../config/contracts';
import '../styles/TokenSpectrumApp.css';

const SEPOLIA_RPC_URL = 'https://eth-sepolia.public.blastapi.io';

type NftRow = {
  tokenId: bigint;
  encryptedTest: `0x${string}`;
  claimed: boolean;
  decryptedTest?: string;
};

async function userDecryptSingleHandle(params: {
  instance: any;
  signer: any;
  contractAddress: string;
  handle: string;
}) {
  const { instance, signer, contractAddress, handle } = params;

  const keypair = instance.generateKeypair();
  const handleContractPairs = [{ handle, contractAddress }];
  const startTimeStamp = Math.floor(Date.now() / 1000).toString();
  const durationDays = '10';
  const contractAddresses = [contractAddress];

  const eip712 = instance.createEIP712(keypair.publicKey, contractAddresses, startTimeStamp, durationDays);
  const signature = await signer.signTypedData(
    eip712.domain,
    { UserDecryptRequestVerification: eip712.types.UserDecryptRequestVerification },
    eip712.message,
  );

  const result = await instance.userDecrypt(
    handleContractPairs,
    keypair.privateKey,
    keypair.publicKey,
    signature.replace('0x', ''),
    contractAddresses,
    await signer.getAddress(),
    startTimeStamp,
    durationDays,
  );

  return result[handle];
}

export function TokenSpectrumApp() {
  const { address, chain } = useAccount();
  const { instance: zama, isLoading: zamaLoading, error: zamaError } = useZamaInstance();
  const signerPromise = useEthersSigner({ chainId: sepolia.id });

  const [signer, setSigner] = useState<any>(null);
  useEffect(() => {
    let mounted = true;
    if (!signerPromise) {
      setSigner(null);
      return;
    }
    signerPromise
      .then((s) => {
        if (mounted) setSigner(s);
      })
      .catch(() => {
        if (mounted) setSigner(null);
      });
    return () => {
      mounted = false;
    };
  }, [signerPromise]);

  const publicClient = useMemo(
    () => createPublicClient({ chain: sepolia, transport: http(SEPOLIA_RPC_URL) }),
    [],
  );

  const contractsReady =
    isAddress(DEPLOYED_CONTRACTS.nftAddress) && isAddress(DEPLOYED_CONTRACTS.tokenAddress);

  const [nfts, setNfts] = useState<NftRow[]>([]);
  const [encryptedBalance, setEncryptedBalance] = useState<string>('');
  const [decryptedBalance, setDecryptedBalance] = useState<string>('');
  const [status, setStatus] = useState<string>('');

  async function refresh() {
    setStatus('');
    setDecryptedBalance('');

    if (!address || !contractsReady) {
      setNfts([]);
      setEncryptedBalance('');
      return;
    }

    const nftAddress = DEPLOYED_CONTRACTS.nftAddress as `0x${string}`;
    const tokenAddress = DEPLOYED_CONTRACTS.tokenAddress as `0x${string}`;

    const balance = (await publicClient.readContract({
      address: nftAddress,
      abi: DEPLOYED_CONTRACTS.nftAbi as any,
      functionName: 'balanceOf',
      args: [address],
    })) as bigint;

    const rows: NftRow[] = [];
    for (let i = 0n; i < balance; i++) {
      const tokenId = (await publicClient.readContract({
        address: nftAddress,
        abi: DEPLOYED_CONTRACTS.nftAbi as any,
        functionName: 'tokenOfOwnerByIndex',
        args: [address, i],
      })) as bigint;

      const claimed = (await publicClient.readContract({
        address: nftAddress,
        abi: DEPLOYED_CONTRACTS.nftAbi as any,
        functionName: 'isClaimed',
        args: [tokenId],
      })) as boolean;

      const encryptedTest = (await publicClient.readContract({
        address: nftAddress,
        abi: DEPLOYED_CONTRACTS.nftAbi as any,
        functionName: 'encryptedTestOf',
        args: [tokenId],
      })) as `0x${string}`;

      rows.push({ tokenId, encryptedTest, claimed });
    }
    setNfts(rows);

    const encBal = (await publicClient.readContract({
      address: tokenAddress,
      abi: DEPLOYED_CONTRACTS.testTokenAbi as any,
      functionName: 'confidentialBalanceOf',
      args: [address],
    })) as `0x${string}`;
    setEncryptedBalance(encBal);
  }

  useEffect(() => {
    refresh().catch((e) => {
      console.error(e);
      setStatus('Failed to load on-chain data.');
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [address, contractsReady]);

  async function onMint() {
    setStatus('');
    if (!contractsReady) return setStatus('Contracts are not configured yet.');
    if (!signer) return setStatus('Connect a wallet first.');

    try {
      setStatus('Minting NFT...');
      const nft = new Contract(DEPLOYED_CONTRACTS.nftAddress, DEPLOYED_CONTRACTS.nftAbi as any, signer);
      const tx = await nft.mint();
      await tx.wait();
      setStatus('Minted.');
      await refresh();
    } catch (e) {
      console.error(e);
      setStatus('Mint failed.');
    }
  }

  async function onClaim(tokenId: bigint) {
    setStatus('');
    if (!contractsReady) return setStatus('Contracts are not configured yet.');
    if (!signer) return setStatus('Connect a wallet first.');

    try {
      setStatus(`Claiming TEST for tokenId ${tokenId.toString()}...`);
      const nft = new Contract(DEPLOYED_CONTRACTS.nftAddress, DEPLOYED_CONTRACTS.nftAbi as any, signer);
      const tx = await nft.claim(tokenId);
      await tx.wait();
      setStatus('Claimed.');
      await refresh();
    } catch (e) {
      console.error(e);
      setStatus('Claim failed.');
    }
  }

  async function onDecryptTest(row: NftRow) {
    setStatus('');
    if (!contractsReady) return setStatus('Contracts are not configured yet.');
    if (!zama || zamaLoading) return setStatus('Encryption service not ready.');
    if (!signer) return setStatus('Connect a wallet first.');

    try {
      setStatus(`Decrypting test for tokenId ${row.tokenId.toString()}...`);
      const value = await userDecryptSingleHandle({
        instance: zama,
        signer,
        contractAddress: DEPLOYED_CONTRACTS.nftAddress,
        handle: row.encryptedTest,
      });

      setNfts((prev) =>
        prev.map((r) => (r.tokenId === row.tokenId ? { ...r, decryptedTest: String(value) } : r)),
      );
      setStatus('Decrypted.');
    } catch (e) {
      console.error(e);
      setStatus('Decryption failed (check ACL and contract address).');
    }
  }

  async function onDecryptBalance() {
    setStatus('');
    if (!contractsReady) return setStatus('Contracts are not configured yet.');
    if (!encryptedBalance) return;
    if (!zama || zamaLoading) return setStatus('Encryption service not ready.');
    if (!signer) return setStatus('Connect a wallet first.');

    try {
      setStatus('Decrypting TEST balance...');
      const value = await userDecryptSingleHandle({
        instance: zama,
        signer,
        contractAddress: DEPLOYED_CONTRACTS.tokenAddress,
        handle: encryptedBalance,
      });
      setDecryptedBalance(String(value));
      setStatus('Decrypted.');
    } catch (e) {
      console.error(e);
      setStatus('Balance decryption failed (check ACL and contract address).');
    }
  }

  const wrongNetwork = !!address && chain?.id !== sepolia.id;

  return (
    <div className="ts-app">
      <Header />

      <main className="ts-main">
        <section className="ts-card">
          <h2 className="ts-title">Status</h2>
          <div className="ts-grid">
            <div className="ts-row">
              <div className="ts-label">Network</div>
              <div className="ts-value">{chain ? `${chain.name} (${chain.id})` : 'Not connected'}</div>
            </div>
            <div className="ts-row">
              <div className="ts-label">Account</div>
              <div className="ts-value">{address ?? 'Not connected'}</div>
            </div>
            <div className="ts-row">
              <div className="ts-label">Contracts</div>
              <div className="ts-value">{contractsReady ? 'Configured' : 'Not configured (sync deployments)'}</div>
            </div>
            <div className="ts-row">
              <div className="ts-label">Relayer SDK</div>
              <div className="ts-value">{zamaLoading ? 'Loading…' : zamaError ? 'Error' : 'Ready'}</div>
            </div>
          </div>
          {wrongNetwork && <div className="ts-warning">Switch to Sepolia to use this dApp.</div>}
          {status && <div className="ts-status">{status}</div>}
        </section>

        <section className="ts-card">
          <h2 className="ts-title">Mint NFT</h2>
          <p className="ts-text">
            Mint creates a new ERC-721 and stores an encrypted random number (1–100) as its private test value.
          </p>
          <button className="ts-button" onClick={onMint} disabled={!address || wrongNetwork || !contractsReady}>
            Mint NFT
          </button>
        </section>

        <section className="ts-card">
          <h2 className="ts-title">Your NFTs</h2>
          {!address && <div className="ts-muted">Connect your wallet to load your NFTs.</div>}
          {address && nfts.length === 0 && <div className="ts-muted">No NFTs found.</div>}

          {nfts.length > 0 && (
            <div className="ts-table">
              <div className="ts-table-header">
                <div>Token ID</div>
                <div>Encrypted test</div>
                <div>Decrypted test</div>
                <div>Actions</div>
              </div>
              {nfts.map((row) => (
                <div className="ts-table-row" key={row.tokenId.toString()}>
                  <div className="ts-mono">{row.tokenId.toString()}</div>
                  <div className="ts-mono ts-ellipsis">{row.encryptedTest}</div>
                  <div className="ts-mono">{row.decryptedTest ?? ''}</div>
                  <div className="ts-actions">
                    <button className="ts-button-secondary" onClick={() => onDecryptTest(row)} disabled={!address}>
                      Decrypt
                    </button>
                    <button className="ts-button" onClick={() => onClaim(row.tokenId)} disabled={!address || row.claimed}>
                      {row.claimed ? 'Claimed' : 'Claim'}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="ts-card">
          <h2 className="ts-title">TEST Balance</h2>
          <div className="ts-row">
            <div className="ts-label">Encrypted balance</div>
            <div className="ts-value ts-mono ts-ellipsis">{encryptedBalance}</div>
          </div>
          <div className="ts-row">
            <div className="ts-label">Decrypted balance</div>
            <div className="ts-value ts-mono">{decryptedBalance}</div>
          </div>
          <button className="ts-button-secondary" onClick={onDecryptBalance} disabled={!address || !encryptedBalance}>
            Decrypt balance
          </button>
        </section>
      </main>
    </div>
  );
}

