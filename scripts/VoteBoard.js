// We require the Hardhat Runtime Environment explicitly here. This is optional
// but useful for running the script in a standalone fashion through `node <script>`.
//
// You can also run a script with `npx hardhat run <script>`. If you do that, Hardhat
// will compile your contracts, add the Hardhat Runtime Environment's members to the
// global scope, and execute the script.
const hre = require('hardhat');
const {parseEther}= require("ethers/lib/utils")

async function displayParameters(proxy) {
  // get parameters
  console.log('starttimestamp @', await proxy.startTimeStamp());
  console.log('interval ', await proxy.interval());
  console.log('teamRewardPercents', await proxy.teamRewardPercents());
}

async function newAlbum(proxy) {
  let tx = await proxy.newAlbum('test', 'test');
  const receipt = await tx.wait();
  receipt.events.forEach((element) => {
    // console.log("album address:", element["event"][])
    // if(element["event"] == "NewAlbum"){
    // }
  });
}

async function vote(proxy){
  albumAddr = '0x1575600eddabe10c7a8cf59436b1654959d583f1';
  tx = await proxy.vote(albumAddr, {
    value: parseEther('0.1'),
  });
  console.log(await tx.wait());
  return;
}

async function main() {
  const accounts = await hre.ethers.getSigners();
  const owner = accounts[0];
  console.log('owner ', owner.address);

  const proxyAddr = '0x081D0aa8c44D72ED9F31234271cc6b40628A5879';
  const proxy = await hre.ethers.getContractAt('RiffianBoard', proxyAddr);

  // await displayParameters(proxy);

  // await newAlbum(proxy);

  await vote(proxy)
return

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

async function run() {}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
