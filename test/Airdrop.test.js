const {
  balance,
  BN,
  constants,
  ether,
  expectEvent,
  expectRevert,
  send,
  time,
} = require("@openzeppelin/test-helpers");

const Contract = artifacts.require("RiffianAirdrop");
const MockBoard = artifacts.require("AirdropVoted");
const [RewardSocialVerify, RewardFollow, RewardShare, RewardVote] = [
  ether("100"),
  ether("10"),
  ether("10"),
  ether("100"),
];

const typesSocialVerify = {
  Account: [{ name: "account", type: "address" }],
};
const typesFollow = {
  Follow: [
    { name: "account", type: "address" },
    { name: "artist", type: "uint256" },
  ],
};
const typesShare = {
  Share: [
    { name: "account", type: "address" },
    { name: "artwork", type: "uint256" },
  ],
};

contract("RiffianAirdrop", (accounts) => {
  const [deployer, alice, bob] = accounts;

  let domain = {
    name: "RiffianAirdrop", // should be same to eip712 contract constructor.
    version: "1.0.0", // should be same to eip712 contract constructor.
    chainId: 0, // will be set to real chain id when `before` is called.
    verifyingContract: constants.ZERO_ADDRESS, // will be set to contract address when `beforeEach` is called.
  };

  function getSignature(signer, types, values) {
    return ethers.getSigner(signer).then((signer) => {
      return signer.signTypedData(domain, types, values);
    });
  }

  function getSignatureSocialVerify(account) {
    return getSignature(alice, typesSocialVerify, {
      account: account,
    });
  }

  function getSignatureFollow(account, artist) {
    return getSignature(alice, typesFollow, {
      account: account,
      artist: artist,
    });
  }

  function getSignatureShare(account, artwork) {
    return getSignature(alice, typesShare, {
      account: account,
      artwork: artwork,
    });
  }

  before(async function () {
    domain.chainId = (await ethers.provider.getNetwork()).chainId;
  });

  beforeEach(async function () {
    this.mockVoted = await MockBoard.new();
    this.contract = await Contract.new(alice, this.mockVoted.address);
    await send.ether(alice, this.contract.address, ether("350"));
    expect(await balance.current(this.contract.address)).to.equal(ether("350"));
    domain.verifyingContract = this.contract.address;
  });

  it("owner", async function () {
    expect(await this.contract.owner()).to.equal(deployer);
  });

  it("signer", async function () {
    expect(await this.contract.riffian_airdrop_signer()).to.equal(alice);
    await expect(this.contract.updateRiffianSigner(bob)).not.to.be.reverted;
    expect(await this.contract.riffian_airdrop_signer()).to.equal(bob);
    await expectRevert(
      this.contract.updateRiffianSigner(constants.ZERO_ADDRESS),
      "Riffian signer address must not be null address"
    );
    await expectRevert(
      this.contract.updateRiffianSigner(bob, {
        from: alice,
      }),
      "Ownable: caller is not the owner"
    );
  });

  it("board", async function () {
    expect(await this.contract.riffian_board()).to.equal(
      this.mockVoted.address
    );
    await expect(this.contract.updateRiffianBoard(bob)).not.to.be.reverted;
    expect(await this.contract.riffian_board()).to.equal(bob);
    await expectRevert(
      this.contract.updateRiffianBoard(constants.ZERO_ADDRESS),
      "Riffian board address must not be null address"
    );
    await expectRevert(
      this.contract.updateRiffianBoard(bob, {
        from: alice,
      }),
      "Ownable: caller is not the owner"
    );
  });

  it("claimSocialVerify", async function () {
    let signature = await getSignatureSocialVerify(bob);
    // signature should match
    await expectRevert(
      this.contract.claimSocialVerify(signature, {
        from: alice,
      }),
      "Invalid signature"
    );
    await expectRevert(
      this.contract.claimFollow(alice, signature, {
        from: bob,
      }),
      "Invalid signature"
    );
    await expectRevert(
      this.contract.claimShare(alice, signature, {
        from: bob,
      }),
      "Invalid signature"
    );

    // isClaimed should be set properly
    const tracker = await balance.tracker(bob);
    expect(await this.contract.isSocialVerifyClaimed(bob)).to.equal(false);
    expectEvent(
      await this.contract.claimSocialVerify(signature, {
        from: bob,
      }),
      "EventClaimSocial",
      { _sender: bob }
    );
    expect(await this.contract.isSocialVerifyClaimed(bob)).to.equal(true);

    // check balance
    const { delta, fees } = await tracker.deltaWithFees();
    expect(delta.add(fees)).to.equal(RewardSocialVerify);

    // should not claim again
    await expectRevert(
      this.contract.claimSocialVerify(signature, {
        from: bob,
      }),
      "Already claimed"
    );
    await expectRevert(
      this.contract.claimSocialVerify(await getSignatureSocialVerify(alice), {
        from: bob,
      }),
      "Already claimed"
    );
    await expectRevert(
      this.contract.claimSocialVerify(signature, {
        from: alice,
      }),
      "Invalid signature"
    );
  });

  it("claimFollow", async function () {
    let artist = alice;
    let signature = await getSignatureFollow(bob, artist);

    // signature should match
    await expectRevert(
      this.contract.claimSocialVerify(signature, {
        from: bob,
      }),
      "Invalid signature"
    );
    await expectRevert(
      this.contract.claimFollow(artist, signature, {
        from: alice,
      }),
      "Invalid signature"
    );
    await expectRevert(
      this.contract.claimShare(alice, signature, {
        from: bob,
      }),
      "Invalid signature"
    );

    // claim max 5 times per day
    const tracker = await balance.tracker(bob);
    let claimState = await this.contract.followClaimed(bob);
    expect(claimState.time).to.equal(new BN(0));
    expect(claimState.count).to.equal(new BN(0));
    for (let index = 0; index < 5; index++) {
      let artistToClaim = new BN(artist, 16).add(new BN(index + 1));
      expectEvent(
        await this.contract.claimFollow(
          artistToClaim,
          await getSignatureFollow(bob, artistToClaim.toString()),
          {
            from: bob,
          }
        ),
        "EventClaimFollow",
        { _sender: bob, _artist: artistToClaim }
      );
      let claimState = await this.contract.followClaimed(bob);
      expect(claimState.time).to.equal(
        new BN(Math.floor((await time.latest()) / time.duration.days(1)))
      );
      expect(claimState.count).to.equal(new BN(index + 1));

      const { delta, fees } = await tracker.deltaWithFees();
      expect(delta.add(fees)).to.equal(RewardFollow);
    }
    // can not claim within 1 day
    await expectRevert(
      this.contract.claimFollow(artist, signature, {
        from: bob,
      }),
      "Daily reward limit reached"
    );
    await time.increase(time.duration.seconds(1));
    await expectRevert(
      this.contract.claimFollow(artist, signature, {
        from: bob,
      }),
      "Daily reward limit reached"
    );
    await time.increaseTo(
      (Math.floor((await time.latest()) / time.duration.days(1)) + 1) *
        time.duration.days(1) -
        time.duration.seconds(2)
    );
    await expectRevert(
      this.contract.claimFollow(artist, signature, {
        from: bob,
      }),
      "Daily reward limit reached"
    );
    // can claim next day
    await time.increase(time.duration.seconds(1));
    expect(
      await this.contract.claimFollow(artist, signature, {
        from: bob,
      })
    ).not.to.be.reverted;

    const { delta, fees } = await tracker.deltaWithFees();
    expect(delta.add(fees)).to.equal(RewardFollow);

    // can not claim twice for the same artist
    await expectRevert(
      this.contract.claimFollow(artist, signature, {
        from: bob,
      }),
      "Already claimed"
    );
    await expectRevert(
      this.contract.claimFollow(
        artist,
        await getSignatureFollow(alice, artist),
        {
          from: bob,
        }
      ),
      "Invalid signature"
    );
    await expectRevert(
      this.contract.claimFollow(artist, signature, {
        from: alice,
      }),
      "Invalid signature"
    );
  });

  it("claimShare", async function () {
    let artwork = alice;
    let signature = await getSignatureShare(bob, artwork);

    // signature should match
    await expectRevert(
      this.contract.claimSocialVerify(signature, {
        from: bob,
      }),
      "Invalid signature"
    );
    await expectRevert(
      this.contract.claimFollow(artwork, signature, {
        from: bob,
      }),
      "Invalid signature"
    );
    await expectRevert(
      this.contract.claimShare(alice, signature, {
        from: alice,
      }),
      "Invalid signature"
    );

    // claim max 10 times per day
    const tracker = await balance.tracker(bob);
    let claimState = await this.contract.shareClaimed(bob);
    expect(claimState.time).to.equal(new BN(0));
    expect(claimState.count).to.equal(new BN(0));
    for (let index = 0; index < 10; index++) {
      let artworkToClaim = new BN(artwork, 16).add(new BN(index + 1));
      expectEvent(
        await this.contract.claimShare(
          artworkToClaim,
          await getSignatureShare(bob, artworkToClaim.toString()),
          {
            from: bob,
          }
        ),
        "EventClaimShare",
        { _sender: bob, _artwork: artworkToClaim }
      );
      let claimState = await this.contract.shareClaimed(bob);
      expect(claimState.time).to.equal(
        new BN(Math.floor((await time.latest()) / time.duration.days(1)))
      );
      expect(claimState.count).to.equal(new BN(index + 1));

      const { delta, fees } = await tracker.deltaWithFees();
      expect(delta.add(fees)).to.equal(RewardShare);
    }
    // can not claim within 1 day
    await expectRevert(
      this.contract.claimShare(artwork, signature, {
        from: bob,
      }),
      "Daily reward limit reached"
    );
    await time.increase(time.duration.seconds(1));
    await expectRevert(
      this.contract.claimShare(artwork, signature, {
        from: bob,
      }),
      "Daily reward limit reached"
    );
    await time.increaseTo(
      (Math.floor((await time.latest()) / time.duration.days(1)) + 1) *
        time.duration.days(1) -
        time.duration.seconds(2)
    );
    await expectRevert(
      this.contract.claimShare(artwork, signature, {
        from: bob,
      }),
      "Daily reward limit reached"
    );
    // can claim next day
    await time.increase(time.duration.seconds(1));
    expect(
      await this.contract.claimShare(artwork, signature, {
        from: bob,
      })
    ).not.to.be.reverted;

    const { delta, fees } = await tracker.deltaWithFees();
    expect(delta.add(fees)).to.equal(RewardShare);

    // can not claim twice for the same artist
    await expectRevert(
      this.contract.claimShare(artwork, signature, {
        from: bob,
      }),
      "Already claimed"
    );
    await expectRevert(
      this.contract.claimShare(
        artwork,
        await getSignatureShare(alice, artwork),
        {
          from: bob,
        }
      ),
      "Invalid signature"
    );
    await expectRevert(
      this.contract.claimShare(artwork, signature, {
        from: alice,
      }),
      "Invalid signature"
    );
  });

  it("claimVote", async function () {
    await expectRevert(
      this.contract.claimVote({
        from: bob,
      }),
      "Not voted yet"
    );
    await this.mockVoted.vote({ from: bob });
    // isVotingClaimed should be set properly
    const tracker = await balance.tracker(bob);
    expect(await this.contract.isVotingClaimed(bob)).to.equal(false);
    expectEvent(
      await this.contract.claimVote({
        from: bob,
      }),
      "EventClaimVote",
      { _sender: bob }
    );
    expect(await this.contract.isVotingClaimed(bob)).to.equal(true);

    // check balance
    const { delta, fees } = await tracker.deltaWithFees();
    expect(delta.add(fees)).to.equal(RewardVote);

    // should not claim again
    await expectRevert(
      this.contract.claimVote({
        from: bob,
      }),
      "Already claimed"
    );
  });

  it("pause", async function () {
    let signature = await getSignatureFollow(bob, alice);
    expect(await this.contract.paused()).to.equal(false);
    expect(
      await this.contract.claimFollow(alice, signature, {
        from: bob,
      })
    ).not.to.be.reverted;
    await expect(this.contract.setPause(true)).not.to.be.reverted;
    expect(await this.contract.paused()).to.equal(true);
    await expectRevert(
      this.contract.claimSocialVerify(await getSignatureSocialVerify(bob), {
        from: bob,
      }),
      "Contract paused"
    );
    await expectRevert(
      this.contract.claimFollow(alice, signature, {
        from: bob,
      }),
      "Contract paused"
    );
    await expectRevert(
      this.contract.claimShare(alice, await getSignatureShare(bob, alice), {
        from: bob,
      }),
      "Contract paused"
    );
    await expectRevert(
      this.contract.claimVote({
        from: bob,
      }),
      "Contract paused"
    );
    await expect(this.contract.setPause(false)).not.to.be.reverted;
    expect(await this.contract.paused()).to.equal(false);
    await expectRevert(
      this.contract.claimFollow(alice, signature, {
        from: bob,
      }),
      "Already claimed"
    );
  });
});
