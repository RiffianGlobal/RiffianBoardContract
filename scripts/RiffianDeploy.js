const { ethers, upgrades } = require('hardhat');

async function main() {
  const accounts = await ethers.getSigners();
  const owner = accounts[0];
  console.log('owner ', owner.address);

  const teamAddress = owner.address;
  const startTimestamp = 1703980800n;
  const dailyInterval = 24 * 60 * 60;
  const Board = await ethers.getContractFactory('RiffianBoard');
  const proxy = await upgrades.deployProxy(Board, [
    teamAddress,
    startTimestamp,
  ]);
  await proxy.waitForDeployment();
  console.log('deploy proxy address @', await proxy.getAddress());
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
