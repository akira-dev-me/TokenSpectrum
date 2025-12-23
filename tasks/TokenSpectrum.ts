import { task } from "hardhat/config";
import type { TaskArguments } from "hardhat/types";
import { FhevmType } from "@fhevm/hardhat-plugin";

task("task:tokenspectrum:addresses", "Prints TokenSpectrum contract addresses").setAction(
  async function (_taskArguments: TaskArguments, hre) {
    const { deployments } = hre;
    const testToken = await deployments.get("TestToken");
    const nft = await deployments.get("TokenSpectrumNFT");
    console.log(`TestToken: ${testToken.address}`);
    console.log(`TokenSpectrumNFT: ${nft.address}`);
  },
);

task("task:tokenspectrum:mint", "Mints a TokenSpectrum NFT").setAction(async function (
  _taskArguments: TaskArguments,
  hre,
) {
  const { ethers, deployments } = hre;
  const nft = await deployments.get("TokenSpectrumNFT");
  const [signer] = await ethers.getSigners();
  const nftContract = await ethers.getContractAt("TokenSpectrumNFT", nft.address);
  const tx = await nftContract.connect(signer).mint();
  console.log(`Wait for tx:${tx.hash}...`);
  await tx.wait();
  console.log(`Minted TokenSpectrum NFT (see Transfer events)`);
});

task("task:tokenspectrum:decrypt-test", "Decrypts encrypted test value for a tokenId")
  .addParam("tokenid", "The tokenId to decrypt")
  .setAction(async function (taskArguments: TaskArguments, hre) {
    const { ethers, deployments, fhevm } = hre;
    await fhevm.initializeCLIApi();

    const nft = await deployments.get("TokenSpectrumNFT");
    const [signer] = await ethers.getSigners();
    const nftContract = await ethers.getContractAt("TokenSpectrumNFT", nft.address);

    const encryptedTest = await nftContract.encryptedTestOf(taskArguments.tokenid);
    const clearTest = await fhevm.userDecryptEuint(FhevmType.euint8, encryptedTest, nft.address, signer);
    console.log(`Encrypted test: ${encryptedTest}`);
    console.log(`Clear test    : ${clearTest}`);
  });

task("task:tokenspectrum:claim", "Claims TEST tokens for a tokenId")
  .addParam("tokenid", "The tokenId to claim")
  .setAction(async function (taskArguments: TaskArguments, hre) {
    const { ethers, deployments } = hre;
    const nft = await deployments.get("TokenSpectrumNFT");
    const [signer] = await ethers.getSigners();
    const nftContract = await ethers.getContractAt("TokenSpectrumNFT", nft.address);
    const tx = await nftContract.connect(signer).claim(taskArguments.tokenid);
    console.log(`Wait for tx:${tx.hash}...`);
    await tx.wait();
    console.log(`Claimed TEST tokens for tokenId=${taskArguments.tokenid}`);
  });

task("task:tokenspectrum:decrypt-balance", "Decrypts TEST token balance for signer").setAction(async function (
  _taskArguments: TaskArguments,
  hre,
) {
  const { ethers, deployments, fhevm } = hre;
  await fhevm.initializeCLIApi();

  const testToken = await deployments.get("TestToken");
  const [signer] = await ethers.getSigners();
  const token = await ethers.getContractAt("TestToken", testToken.address);

  const encryptedBalance = await token.confidentialBalanceOf(signer.address);
  if (encryptedBalance === ethers.ZeroHash) {
    console.log(`Encrypted balance: ${encryptedBalance}`);
    console.log(`Clear balance    : 0`);
    return;
  }

  const clearBalance = await fhevm.userDecryptEuint(FhevmType.euint64, encryptedBalance, testToken.address, signer);
  console.log(`Encrypted balance: ${encryptedBalance}`);
  console.log(`Clear balance    : ${clearBalance}`);
});

