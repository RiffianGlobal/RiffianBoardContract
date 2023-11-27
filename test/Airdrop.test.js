const { constants, expectRevert } = require("@openzeppelin/test-helpers");

const Contract = artifacts.require("RiffianAirdrop");

contract("RiffianAirdrop", function (accounts) {
  const [deployer, alice, bob] = accounts;

  beforeEach(async function () {
    this.contract = await Contract.new(alice);
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

  it("pause", async function () {
    expect(await this.contract.paused()).to.equal(false);
    await expect(this.contract.setPause(true)).not.to.be.reverted;
    expect(await this.contract.paused()).to.equal(true);
    await expect(this.contract.setPause(false)).not.to.be.reverted;
    expect(await this.contract.paused()).to.equal(false);
  });
});
