import { ethers } from "hardhat";

async function main() {
  const [deployer] = await ethers.getSigners();
  const Escrow = await ethers.getContractFactory("ZillobEscrow");
  const escrow = await Escrow.deploy(deployer.address);
  await escrow.waitForDeployment();
  const address = await escrow.getAddress();

  console.log("ZillobEscrow deployed:", address);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
