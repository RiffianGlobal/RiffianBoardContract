const {
  time,
  loadFixture,
} = require('@nomicfoundation/hardhat-toolbox/network-helpers');
const { anyValue } = require('@nomicfoundation/hardhat-chai-matchers/withArgs');
const { expect } = require('chai');
const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000';
const MULTIPLIER = 1000000000000000000;

let owner, alice, bob, cindy;

describe('Board', function () {
  // We define a fixture to reuse the same setup in every test.
  // We use loadFixture to run this setup once, snapshot that state,
  // and reset Hardhat Network to that snapshot in every test.
  async function deployBoardFixture() {
    const accounts = await hre.ethers.getSigners();
    owner = accounts[0];
    alice = accounts[1];
    bob = accounts[2];
    cindy = accounts[3];
    // console.log('owner ', owner.address);

    const teamAddress = owner.address;
    const Board = await hre.ethers.getContractFactory('MediaBoard');
    const proxy = await upgrades.deployProxy(Board, [teamAddress]);
    await proxy.waitForDeployment();
    return await ethers.getContractAt('MediaBoard', proxy.getAddress());
  }

  function calcVotePrice(x) {
    return (x * (x + 1) * MULTIPLIER) / 40000;
  }

  describe('check vote price', async function () {
    it('check vote price', async function () {
      const proxy = await deployBoardFixture();
      expect(await proxy.currentVotePrice(ZERO_ADDRESS, 1)).to.equals(
        calcVotePrice(1)
      );
      expect(await proxy.currentVotePrice(ZERO_ADDRESS, 2)).to.equals(
        calcVotePrice(2)
      );
    });
  });

  describe('Vote', async function () {
    it('create an album', async function () {
      const proxy = await deployBoardFixture();

      expect(await proxy.connect(alice).newAlbum('name', 'sym'))
        .to.emit(proxy, 'NewAlbum')
        .withArgs(anyValue);
    });

    it('vote an album', async function () {
      const proxy = await deployBoardFixture();

      expect(await proxy.connect(alice).newAlbum('name', 'sym'))
        .to.emit(proxy, 'NewAlbum')
        .withArgs(anyValue);
      const newAlbum = await proxy.albumsList(0);

      const votePrice = calcVotePrice(1);
      await proxy.connect(bob).vote(newAlbum, {
        value: votePrice,
      });
    });

    it('claim daily reward', async function () {
      const proxy = await deployBoardFixture();

      expect(await proxy.connect(alice).newAlbum('name', 'sym'))
        .to.emit(proxy, 'NewAlbum')
        .withArgs(anyValue);
      const newAlbum = await proxy.albumsList(0);

      const votePrice = calcVotePrice(1);
      await proxy.connect(bob).vote(newAlbum, {
        value: votePrice,
      });
      expect(await proxy.userDailyRewardIndex(bob.address)).to.equals(0);
      expect(await proxy.userDailyEarned(bob.address)).to.equals(0);
      expect(await proxy.userDailyBalance(bob.address)).to.equals(1);
      expect(await proxy.dailyRewardIndex()).to.equals(0);
      expect(await proxy.dailyRewardVotes()).to.equals(0);

      const votePrice2 = calcVotePrice(2);
      await proxy.connect(cindy).vote(newAlbum, {
        value: votePrice2, //ethers.parseEther(votePrice.toString()),
      });
      console.log('bob index', await proxy.userDailyRewardIndex(bob.address));
      console.log('bob earned', await proxy.userDailyEarned(bob.address));
      console.log('bob balance', await proxy.userDailyBalance(bob.address));
      console.log('daily index', await proxy.dailyRewardIndex());
      console.log('daily reward votes', await proxy.dailyRewardVotes());
      console.log(
        'bob daily reward',
        await proxy.calculateDailyRewards(bob.address)
      );

      console.log(await proxy.userDailyEarned(cindy.address));
      console.log(await proxy.userDailyBalance(alice.address));
      console.log(await proxy.userDailyBalance(cindy.address));
    });
    it('claim album reward', async function () {});
  });
});
