import fs from "node:fs/promises";
import path from "node:path";

const ROOT = process.cwd();
const NETWORK = process.argv.includes("--network")
  ? process.argv[process.argv.indexOf("--network") + 1]
  : "sepolia";

const CONTRACTS = [
  {
    kind: "token",
    name: "TestToken",
    artifact: "artifacts/contracts/TestToken.sol/TestToken.json",
  },
  {
    kind: "nft",
    name: "TokenSpectrumNFT",
    artifact: "artifacts/contracts/TokenSpectrumNFT.sol/TokenSpectrumNFT.json",
  },
];

const OUTPUT = path.join(ROOT, "app", "src", "config", "contracts.ts");

async function readJson(filePath) {
  const text = await fs.readFile(filePath, "utf8");
  return JSON.parse(text);
}

async function loadDeploymentOrArtifact(contract) {
  const deploymentPath = path.join(ROOT, "deployments", NETWORK, `${contract.name}.json`);
  try {
    const dep = await readJson(deploymentPath);
    if (!dep?.abi) throw new Error(`Missing abi in ${deploymentPath}`);
    return { address: dep.address ?? "", abi: dep.abi, source: deploymentPath };
  } catch {
    const artifactPath = path.join(ROOT, contract.artifact);
    const art = await readJson(artifactPath);
    if (!art?.abi) throw new Error(`Missing abi in ${artifactPath}`);
    return { address: "", abi: art.abi, source: artifactPath };
  }
}

function asTsConst(value) {
  return `${JSON.stringify(value, null, 2)} as const`;
}

async function main() {
  const loaded = await Promise.all(CONTRACTS.map(loadDeploymentOrArtifact));

  const token = loaded.find((x, i) => CONTRACTS[i].kind === "token");
  const nft = loaded.find((x, i) => CONTRACTS[i].kind === "nft");

  const chainId = NETWORK === "sepolia" ? 11155111 : 0;

  const out =
    `export type DeployedContracts = {\n` +
    `  chainId: number;\n` +
    `  tokenAddress: string;\n` +
    `  nftAddress: string;\n` +
    `  testTokenAbi: readonly unknown[];\n` +
    `  nftAbi: readonly unknown[];\n` +
    `};\n\n` +
    `// Auto-synced by scripts/sync-frontend-contracts.mjs from deployments/${NETWORK} when available.\n` +
    `export const DEPLOYED_CONTRACTS: DeployedContracts = {\n` +
    `  chainId: ${chainId},\n` +
    `  tokenAddress: ${JSON.stringify(token?.address ?? "")},\n` +
    `  nftAddress: ${JSON.stringify(nft?.address ?? "")},\n` +
    `  testTokenAbi: ${asTsConst(token?.abi ?? [])},\n` +
    `  nftAbi: ${asTsConst(nft?.abi ?? [])},\n` +
    `};\n`;

  await fs.writeFile(OUTPUT, out, "utf8");

  const lines = [
    `Wrote ${path.relative(ROOT, OUTPUT)}`,
    `Token source: ${token?.source ?? "unknown"}`,
    `NFT source  : ${nft?.source ?? "unknown"}`,
    token?.address ? `Token address: ${token.address}` : `Token address: (not set)`,
    nft?.address ? `NFT address  : ${nft.address}` : `NFT address  : (not set)`,
  ];
  console.log(lines.join("\n"));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

