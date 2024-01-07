const { ethers, upgrades } = require('hardhat');

const PROXY_ADDRESS = {
  rifftestnet: '0x8AD7E2eC2AF30F01b65Af8D60318943b43D5E03F',
  ftmtestnet: '',
}[hre.network.name];

async function main() {
  const accounts = await ethers.getSigners();
  const owner = accounts[0];
  console.log('owner ', owner.address);
  console.log('proxy:', PROXY_ADDRESS);

  const Airdrop = await ethers.getContractFactory('RiffianAirdrop');
  const aj = await upgrades.upgradeProxy(PROXY_ADDRESS, Airdrop);
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
