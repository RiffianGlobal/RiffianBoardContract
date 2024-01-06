const { ethers, upgrades } = require('hardhat');

const PROXY_ADDRESS = {
  rifftestnet: '0x6c5BDD99537F344838796DeDFf6cD98b4908c57c',
  ftmtestnet: '0x5D0D729990C9b97Ab1de2A65CF98901b1229f3cf',
}[hre.network.name];

async function main() {
  const accounts = await ethers.getSigners();
  const owner = accounts[0];
  console.log('owner ', owner.address);
  console.log('proxy:', PROXY_ADDRESS);

  const Board = await ethers.getContractFactory('RiffianBoard');
  const proxy = await upgrades.upgradeProxy(PROXY_ADDRESS, Board);
  console.log(
    'new implementation',
    await upgrades.erc1967.getImplementationAddress(PROXY_ADDRESS),
  );
  await hre.run('verify:verify', {
    address: await upgrades.erc1967.getImplementationAddress(PROXY_ADDRESS),
  });
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
