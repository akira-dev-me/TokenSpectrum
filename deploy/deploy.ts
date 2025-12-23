import { DeployFunction } from "hardhat-deploy/types";
import { HardhatRuntimeEnvironment } from "hardhat/types";

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deployer } = await hre.getNamedAccounts();
  const { deploy } = hre.deployments;

  const deployedTestToken = await deploy("TestToken", {
    from: deployer,
    log: true,
  });

  const deployedTokenSpectrumNFT = await deploy("TokenSpectrumNFT", {
    from: deployer,
    args: [deployedTestToken.address],
    log: true,
  });

  const testToken = await hre.ethers.getContractAt("TestToken", deployedTestToken.address);
  const currentMinter: string = await testToken.minter();
  if (currentMinter.toLowerCase() !== deployedTokenSpectrumNFT.address.toLowerCase()) {
    const tx = await testToken.setMinter(deployedTokenSpectrumNFT.address);
    console.log(`Wait for setMinter tx: ${tx.hash}...`);
    await tx.wait();
  }

  console.log(`TestToken contract: `, deployedTestToken.address);
  console.log(`TokenSpectrumNFT contract: `, deployedTokenSpectrumNFT.address);
};
export default func;
func.id = "deploy_tokenspectrum"; // id required to prevent reexecution
func.tags = ["TokenSpectrum"];
