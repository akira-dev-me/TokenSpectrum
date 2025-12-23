import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";
import { ethers, fhevm } from "hardhat";
import { expect } from "chai";
import { FhevmType } from "@fhevm/hardhat-plugin";

import { TestToken, TestToken__factory, TokenSpectrumNFT, TokenSpectrumNFT__factory } from "../types";

type Signers = {
  deployer: HardhatEthersSigner;
  alice: HardhatEthersSigner;
  bob: HardhatEthersSigner;
};

async function deployFixture() {
  const testTokenFactory = (await ethers.getContractFactory("TestToken")) as TestToken__factory;
  const testToken = (await testTokenFactory.deploy()) as TestToken;
  const testTokenAddress = await testToken.getAddress();

  const nftFactory = (await ethers.getContractFactory("TokenSpectrumNFT")) as TokenSpectrumNFT__factory;
  const nft = (await nftFactory.deploy(testTokenAddress)) as TokenSpectrumNFT;
  const nftAddress = await nft.getAddress();

  await (await testToken.setMinter(nftAddress)).wait();

  return { testToken, testTokenAddress, nft, nftAddress };
}

describe("TokenSpectrum", function () {
  let signers: Signers;
  let testToken: TestToken;
  let testTokenAddress: string;
  let nft: TokenSpectrumNFT;
  let nftAddress: string;

  before(async function () {
    const ethSigners: HardhatEthersSigner[] = await ethers.getSigners();
    signers = { deployer: ethSigners[0], alice: ethSigners[1], bob: ethSigners[2] };
  });

  beforeEach(async function () {
    if (!fhevm.isMock) {
      console.warn(`This hardhat test suite cannot run on Sepolia Testnet`);
      this.skip();
    }

    ({ testToken, testTokenAddress, nft, nftAddress } = await deployFixture());
  });

  it("mints an NFT with random test value (1..100) and allows owner to decrypt", async function () {
    const tx = await nft.connect(signers.alice).mint();
    await tx.wait();

    const tokenId = 1;
    const encryptedTest = await nft.encryptedTestOf(tokenId);
    expect(encryptedTest).to.not.eq(ethers.ZeroHash);

    const clearTest = await fhevm.userDecryptEuint(FhevmType.euint8, encryptedTest, nftAddress, signers.alice);
    expect(clearTest).to.be.greaterThanOrEqual(1);
    expect(clearTest).to.be.lessThanOrEqual(100);
  });

  it("claims TEST tokens equal to the test value and prevents double-claim", async function () {
    await (await nft.connect(signers.alice).mint()).wait();

    const tokenId = 1;
    const encryptedTest = await nft.encryptedTestOf(tokenId);
    const clearTest = await fhevm.userDecryptEuint(FhevmType.euint8, encryptedTest, nftAddress, signers.alice);

    await (await nft.connect(signers.alice).claim(tokenId)).wait();
    expect(await nft.isClaimed(tokenId)).to.eq(true);

    const encryptedBalance = await testToken.confidentialBalanceOf(signers.alice.address);
    const clearBalance = await fhevm.userDecryptEuint(
      FhevmType.euint64,
      encryptedBalance,
      testTokenAddress,
      signers.alice,
    );
    expect(clearBalance).to.eq(clearTest);

    await expect(nft.connect(signers.alice).claim(tokenId)).to.be.reverted;
  });

  it("prevents non-owner from claiming, but allows new owner to decrypt after transfer", async function () {
    await (await nft.connect(signers.alice).mint()).wait();
    const tokenId = 1;

    await expect(nft.connect(signers.bob).claim(tokenId)).to.be.reverted;

    await (await nft.connect(signers.alice).transferFrom(signers.alice.address, signers.bob.address, tokenId)).wait();

    const encryptedTest = await nft.encryptedTestOf(tokenId);
    const clearTestByBob = await fhevm.userDecryptEuint(FhevmType.euint8, encryptedTest, nftAddress, signers.bob);
    expect(clearTestByBob).to.be.greaterThanOrEqual(1);
    expect(clearTestByBob).to.be.lessThanOrEqual(100);
  });
});

