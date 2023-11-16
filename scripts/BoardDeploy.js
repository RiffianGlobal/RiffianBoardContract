// We require the Hardhat Runtime Environment explicitly here. This is optional
// but useful for running the script in a standalone fashion through `node <script>`.
//
// You can also run a script with `npx hardhat run <script>`. If you do that, Hardhat
// will compile your contracts, add the Hardhat Runtime Environment's members to the
// global scope, and execute the script.
const hre = require('hardhat');

async function main() {
  // await deploy();
  // return;

  await run();
  return;
}

async function deploy() {
  const accounts = await hre.ethers.getSigners();
  const owner = accounts[0];
  console.log('owner ', owner.address);

  const teamAddress = owner.address;
  const Board = await hre.ethers.getContractFactory('MediaBoard');
  const proxy = await upgrades.deployProxy(Board, [teamAddress]);
  await proxy.waitForDeployment();
  console.log('deploy proxy address @', await proxy.getAddress());
  return await proxy.getAddress();
}

async function run() {
  const accounts = await hre.ethers.getSigners();
  const owner = accounts[0];
  console.log('owner ', owner.address);

  const proxyAddress = '0x6c5bdd99537f344838796dedff6cd98b4908c57c';
  const proxy = await hre.ethers.getContractAt('MediaBoard', proxyAddress);

  // let tx = await proxy.newAlbum('test', 'test');
  // const receipt = await tx.wait();
  // console.log(receipt);
  // return;

  tx = await proxy.vote('0x2069cd582d73596bbd2183f93e9613Fb8322426d', {
    value: hre.ethers.parseEther('0.1'),
  });
  console.log(await tx.wait());
  return;

  tx = await proxy.claimDailyRewards();
  console.log(await tx.wait());

  console.log(
    'daily user balance',
    await proxy.userDailyBalance(owner.address)
  );
  console.log(
    'daily user rewards',
    await proxy.calculateDailyRewards(owner.address)
  );
  console.log(
    'album rewards',
    await proxy.calculateAlbumRewards(
      owner.address,
      '0x763e69d24a03c0c8b256e470d9fe9e0753504d07'
    )
  );
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
