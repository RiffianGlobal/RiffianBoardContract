const { ethers, upgrades } = require('hardhat');

async function main() {
  const accounts = await ethers.getSigners();
  const owner = accounts[0];
  console.log('owner ', owner.address);

  const p = await ethers.getContractAt(
    'RiffianAirdrop',
    '0x8AD7E2eC2AF30F01b65Af8D60318943b43D5E03F',
  );
  // await p.setPause(false);
  console.log(await p.riffian_airdrop_signer());
  // return;
  // p.updateRiffianSigner('0x6fD4c2C3068f678F8D0313Db03ed099e48c04687');
  return;

  const boardAddress = '0x6c5BDD99537F344838796DeDFf6cD98b4908c57c';
  const Airdrop = await ethers.getContractFactory('RiffianAirdrop');
  const aj = await upgrades.deployProxy(Airdrop, [owner.address, boardAddress]);
  await aj.waitForDeployment();
  console.log('deploy aj proxy address @', await aj.getAddress());
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
