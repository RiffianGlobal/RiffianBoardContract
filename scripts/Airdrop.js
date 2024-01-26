const { ethers, upgrades } = require('hardhat');
const { utils } = require('ethers');

const BoardAddress = {
  rifftestnet: '0x6c5BDD99537F344838796DeDFf6cD98b4908c57c',
  riff: '0xc6712F4B2EeDe48D5BA8f09Db56C820F4A236828',
  ftmtestnet: '0x5D0D729990C9b97Ab1de2A65CF98901b1229f3cf',
}[hre.network.name];

async function main() {
  const accounts = await ethers.getSigners();
  const owner = accounts[0];
  console.log('owner ', owner.address);

  {
    // const p = await ethers.getContractAt(
    //   'RiffianAirdrop',
    //   '0x8AD7E2eC2AF30F01b65Af8D60318943b43D5E03F',
    // );
    // await p.setPause(false);
    // console.log(await p.riffian_airdrop_signer());
    // return;
    // p.updateRiffianSigner('0x6fD4c2C3068f678F8D0313Db03ed099e48c04687');
  }
  {
    // // update reward parameters
    // const p = await ethers.getContractAt(
    //   'RiffianAirdrop',
    //   '0x1395Dd9C0E35af75e7e1BC7846f14c53558A8F6F',
    // );
    // console.log('reward params');
    // console.log('rewardSocialVerify:', await p.RewardSocialVerify());
    // console.log('rewardFollow:', await p.RewardFollow());
    // console.log('MaxFollow:', await p.MaxFollow());
    // console.log('RewardShare:', await p.RewardShare());
    // console.log('MaxShare:', await p.MaxShare());
    // console.log('RewardVote:', await p.RewardVote());
    // await p.updateParameters(
    //   ethers.parseEther('100'),
    //   ethers.parseEther('10'),
    //   5,
    //   ethers.parseEther('10'),
    //   10,
    //   ethers.parseEther('40'),
    // );
    // return;
  }

  const Airdrop = await ethers.getContractFactory('RiffianAirdrop');
  const aj = await upgrades.deployProxy(Airdrop, [owner.address, BoardAddress]);
  await aj.waitForDeployment();
  console.log('deploy aj proxy address @', await aj.getAddress());
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
