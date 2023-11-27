// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import {Address} from "@openzeppelin/contracts/utils/Address.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {EIP712} from "@openzeppelin/contracts/utils/cryptography/EIP712.sol";
import {ECDSA} from "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {IRiffianAirdrop} from "./interface/IAirdrop.sol";

/**
 * @title RiffianAirdrop
 * @author Riffian Global
 *
 * Airdrop contract that allows users to claim airdrops.
 */
contract RiffianAirdrop is EIP712, Ownable, IRiffianAirdrop {
    /* ============ Events ============ */
    event EventClaimSocial(address _sender);
    event EventClaimFollow(address _sender, uint256 artist);
    event EventClaimShare(address _sender, uint256 artwork);
    event EventClaimStake(address _sender);
    event EventClaimVote(address _sender);

    /* ============ Modifiers ============ */
    /**
     * Throws if the contract paused
     */
    modifier onlyNoPaused() {
        _validateOnlyNotPaused();
        _;
    }

    /* ============ State Variables ============ */
    uint256 public RewardSocialVerify = 1e16;
    uint256 public RewardFollow = 1e17;
    uint256 public MaxFollow = 5;
    uint256 public RewardShare = 1e17;
    uint256 public MaxShare = 10;
    uint256 public RewardVote = 1e16;

    // Is contract paused.
    bool public paused;

    // The riffian signer(EOA): used to verify EIP-712.
    address public riffian_airdrop_signer;

    // Is social account verification reward claimed.
    mapping(address => bool) public isSocialVerifyClaimed;
    // Is staking reward claimed.
    mapping(address => bool) public isStakingClaimed;
    // Is voting reward claimed.
    mapping(address => bool) public isVotingClaimed;

    /* ============ Constructor ============ */
    constructor(address _signer) EIP712("RiffianAirdrop", "1.0.0") {
        riffian_airdrop_signer = _signer;
    }

    /* ============ External Functions ============ */
    function claimSocialVerify(
        bytes calldata _signature
    ) external override onlyNoPaused {
        require(!isSocialVerifyClaimed[msg.sender], "Already claimed");
        require(
            _verify(_hashAccount(msg.sender), _signature),
            "Invalid signature"
        );
        isSocialVerifyClaimed[msg.sender] = true;
        (bool success, ) = msg.sender.call{value: RewardSocialVerify}(
            new bytes(0)
        );
        require(success, "Claim failed");
        emit EventClaimSocial(msg.sender);
    }

    function claimFollow(
        uint256 _artist,
        bytes calldata _signature
    ) external override onlyNoPaused {
        require(
            _verify(_hashFollow(msg.sender, _artist), _signature),
            "Invalid signature"
        );
        (bool success, ) = msg.sender.call{value: RewardFollow}(new bytes(0));
        require(success, "Claim failed");
        emit EventClaimFollow(msg.sender, _artist);
    }

    function claimShare(
        uint256 _artwork,
        bytes calldata _signature
    ) external override onlyNoPaused {
        require(
            _verify(_hashShare(msg.sender, _artwork), _signature),
            "Invalid signature"
        );
        (bool success, ) = msg.sender.call{value: RewardShare}(new bytes(0));
        require(success, "Claim failed");
        emit EventClaimShare(msg.sender, _artwork);
    }

    function claimVote(
        bytes calldata _signature
    ) external override onlyNoPaused {
        require(!isVotingClaimed[msg.sender], "Already claimed");
        require(
            _verify(_hashVote(msg.sender), _signature),
            "Invalid signature"
        );
        isVotingClaimed[msg.sender] = true;
        (bool success, ) = msg.sender.call{value: RewardVote}(new bytes(0));
        require(success, "Claim failed");
        emit EventClaimVote(msg.sender);
    }

    /**
     * PRIVILEGED MODULE FUNCTION. Function that pause the contract.
     */
    function setPause(bool _paused) external onlyOwner {
        paused = _paused;
    }

    /**
     * PRIVILEGED MODULE FUNCTION. Function that update riffian signer address.
     */
    function updateRiffianSigner(address newAddress) external onlyOwner {
        require(
            newAddress != address(0),
            "Riffian signer address must not be null address"
        );
        riffian_airdrop_signer = newAddress;
    }

    /* ============ Internal Functions ============ */

    function _verify(
        bytes32 hash,
        bytes calldata signature
    ) private view returns (bool) {
        return ECDSA.recover(hash, signature) == riffian_airdrop_signer;
    }

    function _hashAccount(address _account) private view returns (bytes32) {
        return
            _hashTypedDataV4(
                keccak256(
                    abi.encode(keccak256("Account(address account)"), _account)
                )
            );
    }

    function _hashFollow(
        address _account,
        uint256 _artist
    ) private view returns (bytes32) {
        return
            _hashTypedDataV4(
                keccak256(
                    abi.encode(
                        keccak256("Follow(address account,uint256 artist)"),
                        _account,
                        _artist
                    )
                )
            );
    }

    function _hashShare(
        address _account,
        uint256 _artwork
    ) private view returns (bytes32) {
        return
            _hashTypedDataV4(
                keccak256(
                    abi.encode(
                        keccak256("Vote(address account,uint256 artwork)"),
                        _account,
                        _artwork
                    )
                )
            );
    }

    function _hashVote(address _account) private view returns (bytes32) {
        return
            _hashTypedDataV4(
                keccak256(
                    abi.encode(keccak256("Vote(address account)"), _account)
                )
            );
    }

    function _validateOnlyNotPaused() internal view {
        require(!paused, "Contract paused");
    }
}
