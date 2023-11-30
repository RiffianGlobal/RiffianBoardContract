const {
  time,
  loadFixture,
} = require('@nomicfoundation/hardhat-network-helpers');
const { BN, ether, balance } = require('@openzeppelin/test-helpers');
const { anyValue } = require('@nomicfoundation/hardhat-chai-matchers/withArgs');

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
    const Board = await hre.ethers.getContractFactory('RiffianBoard');
    const startTime = await time.latest();
    const interval = 60 * 60 * 24;
    const board = await upgrades.deployProxy(Board, [
      teamAddress,
      startTime,
      interval,
    ]);
    await board.waitForDeployment();
    const proxy = await ethers.getContractAt(
      'RiffianBoard',
      await board.getAddress(),
    );

    await proxy.connect(alice).newAlbum('name', 'sym');
    const albumAddr = await proxy.albumsList(0);
    return { proxy, albumAddr };
  }

  function calcVotePrice(x) {
    return ether((x / 10).toString());
  }

  function vote(times, from, albumAddr, proxy) {
    return proxy.getVotePriceWithFee(albumAddr, times).then((votePrice) => {
      return proxy.connect(from)['vote(address,uint256)'](albumAddr, times, {
        value: votePrice._sum,
      });
    });
  }

  function retreat(times, from, albumAddr, proxy) {
    return proxy.connect(from).retreat(albumAddr, times);
  }

  describe('check vote price', async function () {
    it('check vote price', async function () {
      const { proxy } = await loadFixture(deployBoardFixture);
      expect(await proxy.calculateVotePrice(1)).to.equals(calcVotePrice(1));
      expect(await proxy.calculateVotePrice(2)).to.equals(calcVotePrice(2));
      expect(await proxy.calculateVotePrice(10)).to.equals(calcVotePrice(10));
    });
  });

  describe('Vote', async function () {
    it('create an album', async function () {
      const { proxy, albumAddress } = await loadFixture(deployBoardFixture);

      expect(await proxy.connect(alice).newAlbum('name', 'sym'))
        .to.emit(proxy, 'NewAlbum')
        .withArgs(anyValue);
    });

    it('vote an album and retreat', async function () {
      const { proxy, albumAddr } = await loadFixture(deployBoardFixture);

      const trackerAlice = await balance.tracker(alice.address);
      const trackerBob = await balance.tracker(bob.address);
      const trackerCindy = await balance.tracker(cindy.address);
      const trackerContract = await balance.tracker(await proxy.getAddress());
      // first vote
      await expect(vote(1, bob, albumAddr, proxy))
        .to.emit(proxy, 'EventVote')
        .withArgs(bob.address, albumAddr, true, 1, anyValue, 1);
      const {
        artist,
        rewardIndex: albumRewardIndex,
        votes: albumVotes,
      } = await proxy.albumToData(albumAddr);
      expect(artist).to.equals(alice.address);
      expect(albumRewardIndex).to.equals(0);
      expect(albumVotes).to.equals(1);
      // check artist fee
      expect(await trackerAlice.delta()).to.equals(
        calcVotePrice(1).mul(new BN('4')).div(new BN('100')),
      );
      // check vote fee
      await trackerBob.deltaWithFees().then(({ delta, fees }) => {
        expect(delta.neg().sub(fees)).to.equals(
          calcVotePrice(1).mul(new BN('11')).div(new BN('10')),
        );
      });
      // check protocol fee
      expect(await trackerContract.delta()).to.equals(
        calcVotePrice(1).mul(new BN('104')).div(new BN('100')),
      );

      const { starts, interval, rewardIndex, votes } =
        await proxy.seqToRewardData(0);
      // console.log('rewarddata', starts, interval, rewardIndex, votes);
      expect(await proxy.calculateDailyRewards(bob.address)).to.equals(0);
      expect(rewardIndex).to.equals(0);
      // expect(votes).to.equals(1);

      // second vote
      await expect(vote(1, cindy, albumAddr, proxy))
        .to.emit(proxy, 'EventVote')
        .withArgs(cindy.address, albumAddr, true, 1, anyValue, 2);
      const {
        artist2,
        rewardIndex: albumRewardIndex2,
        votes: albumVotes2,
      } = await proxy.albumToData(albumAddr);
      expect(albumVotes2).to.equals(2);
      expect(await trackerAlice.delta()).to.equals(
        calcVotePrice(2).mul(new BN('4')).div(new BN('100')),
      );
      await trackerCindy.deltaWithFees().then(({ delta, fees }) => {
        expect(delta.neg().sub(fees)).to.equals(
          calcVotePrice(2).mul(new BN('11')).div(new BN('10')),
        );
      });
      expect(await trackerContract.delta()).to.equals(
        calcVotePrice(2).mul(new BN('104')).div(new BN('100')),
      );

      // multiple vote
      await expect(vote(3, cindy, albumAddr, proxy))
        .to.emit(proxy, 'EventVote')
        .withArgs(cindy.address, albumAddr, true, 3, anyValue, 5);
      await proxy
        .albumToData(albumAddr)
        .then(
          ({ artist2, rewardIndex: albumRewardIndex2, votes: albumVotes2 }) => {
            expect(albumVotes2).to.equals(5);
          },
        );
      var price = calcVotePrice(3).add(calcVotePrice(4)).add(calcVotePrice(5));
      expect(await trackerAlice.delta()).to.equals(
        price.mul(new BN('4')).div(new BN('100')),
      );
      await trackerCindy.deltaWithFees().then(({ delta, fees }) => {
        expect(delta.neg().sub(fees)).to.equals(
          price.mul(new BN('11')).div(new BN('10')),
        );
      });
      expect(await trackerContract.delta()).to.equals(
        price.mul(new BN('104')).div(new BN('100')),
      );

      const { rewardIndex2, votes2 } = await proxy.seqToRewardData(0);

      // retreat
      // first retreat
      await expect(retreat(1, bob, albumAddr, proxy))
        .to.emit(proxy, 'EventVote')
        .withArgs(bob.address, albumAddr, false, 1, anyValue, 4);
      await proxy
        .albumToData(albumAddr)
        .then(
          ({ artist, rewardIndex: albumRewardIndex, votes: albumVotes }) => {
            expect(artist).to.equals(alice.address);
            expect(albumRewardIndex).to.equals(0);
            expect(albumVotes).to.equals(4);
          },
        );
      // check artist balance
      expect(await trackerAlice.delta()).to.equals(new BN(0));
      // check voter balance
      await trackerBob.deltaWithFees().then(({ delta, fees }) => {
        expect(delta.add(fees)).to.equals(calcVotePrice(5));
      });
      // check protocol balance
      expect(await trackerContract.delta()).to.equals(calcVotePrice(5).neg());

      // retreat without holding
      await expect(retreat(1, bob, albumAddr, proxy)).to.be.revertedWith(
        'Insufficient votes',
      );

      // multiple retreat
      await expect(retreat(3, cindy, albumAddr, proxy))
        .to.emit(proxy, 'EventVote')
        .withArgs(cindy.address, albumAddr, false, 3, anyValue, 1);
      await proxy
        .albumToData(albumAddr)
        .then(
          ({ artist, rewardIndex: albumRewardIndex, votes: albumVotes }) => {
            expect(artist).to.equals(alice.address);
            expect(albumRewardIndex).to.equals(0);
            expect(albumVotes).to.equals(1);
          },
        );
      // check artist balance
      expect(await trackerAlice.delta()).to.equals(new BN(0));
      // check voter balance
      var price = calcVotePrice(4).add(calcVotePrice(3)).add(calcVotePrice(2));
      await trackerCindy.deltaWithFees().then(({ delta, fees }) => {
        expect(delta.add(fees)).to.equals(price);
      });
      // check protocol balance
      expect(await trackerContract.delta()).to.equals(price.neg());
    });

    it.skip('claim daily reward', async function () {
      const { proxy } = await loadFixture(deployBoardFixture);

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
        await proxy.calculateDailyRewards(bob.address),
      );

      console.log(await proxy.userDailyEarned(cindy.address));
      console.log(await proxy.userDailyBalance(alice.address));
      console.log(await proxy.userDailyBalance(cindy.address));
    });
    it('claim album reward', async function () {});
  });
});
