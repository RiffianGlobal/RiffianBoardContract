// We require the Hardhat Runtime Environment explicitly here. This is optional
// but useful for running the script in a standalone fashion through `node <script>`.
//
// You can also run a script with `npx hardhat run <script>`. If you do that, Hardhat
// will compile your contracts, add the Hardhat Runtime Environment's members to the
// global scope, and execute the script.
const hre = require('hardhat');
// const { parseEther } = require('ethers/lib/utils');

async function displayParameters(proxy) {
  // get parameters
  console.log('starttimestamp @', await proxy.startTimeStamp());
  console.log('teamRewardPercents', await proxy.protocolFeePercents());
}

async function bind(proxy) {
  const tx = await proxy.bindSocial('x', '111', 'url.ph');
  const receipt = await tx.wait();
  console.log('bind social', receipt);
}

async function newAlbum(proxy) {
  let tx = await proxy.newSubject('testname', 'image.jpg', 'url.placeholder');
  const receipt = await tx.wait();
  console.log(receipt.events);
  // receipt.events.forEach((element) => {
  // console.log('album address:', element);
  // if(element["event"] == "NewAlbum"){
  // }
  // });
}

async function vote(proxy) {
  albumAddr =
    '0xF764A579C6861630ECE96BCEB2E575D116CCAF11DDC488BB1E7FE9CE7F33CB18';
  tx = await proxy.vote(albumAddr, 1, {
    value: ethers.parseEther('1'),
  });
  console.log(await tx.wait());
  return;
}

async function main() {
  const accounts = await hre.ethers.getSigners();
  const owner = accounts[0];
  console.log('owner ', owner.address);

  const proxyAddr = '0x5d0d729990c9b97ab1de2a65cf98901b1229f3cf';
  const proxy = await hre.ethers.getContractAt('RiffianBoard', proxyAddr);

  // await displayParameters(proxy);
  // await bind(proxy);
  // await newAlbum(proxy);

  await vote(proxy);
  return;

  tx = await proxy.claimDailyRewards();
  console.log(await tx.wait());

  console.log(
    'daily user balance',
    await proxy.userDailyBalance(owner.address),
  );
  console.log(
    'daily user rewards',
    await proxy.calculateDailyRewards(owner.address),
  );
  console.log(
    'album rewards',
    await proxy.calculateAlbumRewards(
      owner.address,
      '0x763e69d24a03c0c8b256e470d9fe9e0753504d07',
    ),
  );
}

async function run() {}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
