# TokenSpectrum

TokenSpectrum is a privacy-first NFT and reward token system built on Zama FHEVM. Each NFT mints with a random,
encrypted "test" value (1-100) that only the owner can decrypt. Owners can claim a matching amount of confidential
TEST tokens without revealing the underlying value on-chain.

This repository includes Solidity smart contracts, Hardhat deployment and tasks, and a React + Vite front-end that
interacts with the encrypted data using the Zama relayer SDK.

## Project Summary

- Purpose: demonstrate on-chain randomness and reward distribution while keeping sensitive values private.
- Audience: developers exploring FHE-enabled NFTs, encrypted balances, and owner-only decryption flows.
- Scope: Sepolia-first deployment and a production-like front-end (no mock data).

## Problem Statement

On-chain NFT attributes and reward logic are usually public. If a reward depends on a hidden value, exposing it creates
front-running and incentive issues. Using off-chain randomness and private databases introduces trust and custody risks.
TokenSpectrum solves this by:

- Generating a random value on-chain in encrypted form.
- Storing that value in the NFT without revealing it.
- Letting the owner decrypt it via the Zama relayer flow.
- Allowing claims that use the encrypted value directly for minting tokens.

## Solution Overview

1. Mint an ERC-721 TokenSpectrum NFT.
2. The contract generates an encrypted random integer in the 1-100 range.
3. The encrypted value is stored on-chain and ACLs are configured for the NFT owner.
4. The owner can decrypt the value in the UI or via a CLI task.
5. The owner can claim TEST tokens equal to that value (encrypted mint).
6. The TEST token balance is confidential and can be decrypted by the owner.

## Advantages

- Privacy by default: NFT attributes and token balances stay encrypted on-chain.
- On-chain enforcement: claims are validated by smart contracts, not a server.
- Transferable secrecy: decryption access follows NFT ownership.
- No oracles for rewards: FHEVM provides encrypted randomness and computation.
- Minimal trust: owners sign EIP-712 requests to decrypt their own values.

## Key Features

- ERC-721 NFT with encrypted attribute (test value).
- ERC-7984 confidential TEST token with encrypted balances.
- Owner-only decryption for NFT values and token balances.
- One-time claim mechanism for each NFT.
- Sepolia-ready front-end with wallet connect and live chain reads.

## Technology Stack

- Smart contracts: Solidity 0.8.27, OpenZeppelin, Zama FHEVM.
- Framework: Hardhat + hardhat-deploy.
- Confidential token standard: ERC-7984 (OpenZeppelin confidential contracts).
- Front-end: React + Vite (no Tailwind).
- Wallet: wagmi + RainbowKit.
- Reads: viem public client.
- Writes: ethers v6 contract calls.
- Relayer: @zama-fhe/relayer-sdk for decryption requests.

## Architecture

- On-chain contracts
  - TokenSpectrumNFT: ERC-721 with encrypted test values.
  - TestToken: ERC-7984 confidential token, minted by the NFT contract.
- Off-chain relay
  - Zama relayer SDK signs EIP-712 requests and returns decrypted values.
- Front-end
  - React UI pulls encrypted data via viem and submits transactions via ethers.

## Smart Contracts

### TokenSpectrumNFT (`contracts/TokenSpectrumNFT.sol`)

- ERC-721 enumerable NFT named "TokenSpectrum" (symbol TSPEC).
- `mint()` generates an encrypted random value in the range 1-100.
- Encrypted value is stored in `_encryptedTestByTokenId`.
- Ownership transfer automatically grants decryption access to the new owner.
- `claim(tokenId)` mints confidential TEST tokens equal to the encrypted value.

### TestToken (`contracts/TestToken.sol`)

- ERC-7984 confidential token named "TEST".
- `mintFromMinter` can only be called by the NFT contract.
- Balances are encrypted; owners can request decryption.
- Decimals are set to 0 to match discrete NFT reward amounts.

## Privacy and Security Model

- Encrypted values are stored as `euint8`/`euint64` using FHEVM types.
- Access control lists (ACL) are set on mint and updated on transfer.
- Decryption requires wallet signatures and the Zama relayer flow.
- Claims are one-time and enforced by `_claimed[tokenId]`.

## Repository Structure

```
.
├── contracts/                 # Solidity contracts
├── deploy/                    # Hardhat deploy scripts
├── tasks/                     # Hardhat tasks
├── test/                      # Hardhat tests
├── scripts/                   # Utility scripts (ABI sync)
├── app/                       # React + Vite front-end
├── docs/                      # Zama protocol and relayer docs
└── hardhat.config.ts          # Hardhat configuration
```

## Setup and Local Development

### Requirements

- Node.js >= 20
- npm >= 7

### Install Dependencies

```bash
npm install
```

### Compile and Test

```bash
npm run compile
npm run test
```

### Start a Local Node and Deploy

```bash
npm run chain
npm run deploy:localhost
```

### Run TokenSpectrum Tasks (Local or Sepolia)

```bash
npx hardhat task:tokenspectrum:addresses --network localhost
npx hardhat task:tokenspectrum:mint --network localhost
npx hardhat task:tokenspectrum:decrypt-test --tokenid 1 --network localhost
npx hardhat task:tokenspectrum:claim --tokenid 1 --network localhost
npx hardhat task:tokenspectrum:decrypt-balance --network localhost
```

## Sepolia Deployment

### Environment Variables

Create a `.env` file in the repo root with the following:

```
INFURA_API_KEY=...
PRIVATE_KEY=...
ETHERSCAN_API_KEY=... # optional
```

Notes:

- Use a private key for deployment. Do not use MNEMONIC.
- The Hardhat config reads `process.env.INFURA_API_KEY` and `process.env.PRIVATE_KEY`.

### Deploy

```bash
npm run deploy:sepolia
```

### Verify (Optional)

```bash
npm run verify:sepolia -- <CONTRACT_ADDRESS>
```

## Front-end Setup

The front-end is in `app/`. It reads encrypted values with viem, writes transactions with ethers, and uses the Zama
relayer SDK for decryption. It is configured for Sepolia and does not use environment variables.

### Install and Run

```bash
cd app
npm install
npm run dev
```

### Sync Contract Addresses and ABIs

After deploying to Sepolia, sync the latest ABIs and addresses into the front-end:

```bash
node scripts/sync-frontend-contracts.mjs --network sepolia
```

This updates `app/src/config/contracts.ts` using `deployments/sepolia` when available.

## User Flow in the UI

1. Connect a wallet on Sepolia.
2. Mint a TokenSpectrum NFT.
3. View encrypted test values for each NFT.
4. Click "Decrypt" to reveal your test value.
5. Click "Claim" to mint confidential TEST tokens.
6. Decrypt your TEST balance when needed.

## Known Constraints

- The UI expects Sepolia and does not support localhost networks.
- Front-end config is stored in TypeScript, not JSON or environment variables.
- Decryption requires the Zama relayer to be available.

## Future Roadmap

- Token metadata and visual traits tied to encrypted values.
- Batch minting and batch claims.
- Better on-chain event indexing for large NFT collections.
- Optional reveal mechanism for public proofs without disclosing values.
- Multi-chain deployments (other FHEVM-ready networks).
- Improved UX around decryption sessions and error handling.

## License

This project is licensed under the BSD-3-Clause-Clear License. See `LICENSE` for details.
