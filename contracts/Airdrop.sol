// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import {Address} from "@openzeppelin/contracts/utils/Address.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {EIP712Upgradeable} from "@openzeppelin/contracts-upgradeable/utils/cryptography/EIP712Upgradeable.sol";
import {ECDSA} from "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import {OwnableUpgradeable} from "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import {Initializable} from "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import {IRiffianAirdrop} from "./interface/IAirdrop.sol";
import {SocialData} from "./interface/IRiffianBoard.sol";

struct ClaimState {
    uint256 time;
    uint256 count;
    mapping(uint256 => bool) claimed;
}

interface IRiffianCheck {
    function hasVoted(address account) external view returns (bool);

    function getSocials(address _owner) external view returns (SocialData[] memory);
}

/**
 * @title RiffianAirdrop
 * @author Riffian Global
 *
 * Airdrop contract that allows users to claim airdrops.
 *
 * Signature can be generated by calling `signer.signTypedData(domain, types, values)`,
 * see `getSignatureSocialVerify` in `Airdrop.test.js` for more details.
 */
contract RiffianAirdrop is EIP712Upgradeable, OwnableUpgradeable, IRiffianAirdrop {
    /* ============ Constants ============ */
    uint256 constant dayInSecs = 1 days;

    /* ============ Events ============ */
    event EventFund(uint256 _amount);
    event EventClaimSocial(address _sender);
    event EventClaimFollow(address _sender, uint256 _artist);
    event EventClaimShare(address _sender, uint256 _artwork);
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
    uint256 public RewardSocialVerify;
    uint256 public RewardFollow;
    uint256 public MaxFollow;
    uint256 public RewardShare;
    uint256 public MaxShare;
    uint256 public RewardVote;

    // Is contract paused.
    bool public paused;

    // The riffian signer(EOA): used to verify EIP-712.
    address public riffian_airdrop_signer;

    // The riffian board: used to check if voted.
    IRiffianCheck public riffian_board;

    // Is social account verification reward claimed.
    mapping(address => bool) public isSocialVerifyClaimed;
    // Follow reward claim state.
    mapping(address => ClaimState) public followClaimed;
    // Share reward claim state.
    mapping(address => ClaimState) public shareClaimed;
    // Is voting reward claimed.
    mapping(address => bool) public isVotingClaimed;

    /* ============ Constructor ============ */
    function initialize(address _signer, address _board) external initializer {
        riffian_airdrop_signer = _signer;
        riffian_board = IRiffianCheck(_board);
        RewardSocialVerify = 40 ether;
        RewardFollow = 10 ether;
        MaxFollow = 5;
        RewardShare = 10 ether;
        MaxShare = 10;
        RewardVote = 100 ether;

        __EIP712_init("RiffianAirdrop", "1.0.0");
        __Ownable_init();
    }

    /* ============ External View Functions ======= */
    function claimable() external view returns (uint256 socialVerify, uint256 vote, uint256 follow, uint256 share) {
        if (!isSocialVerifyClaimed[msg.sender]) socialVerify = RewardSocialVerify;

        uint256 timeInDays = block.timestamp / dayInSecs;
        ClaimState storage claimStateFollow = followClaimed[msg.sender];
        if (timeInDays > claimStateFollow.time) {
            follow = RewardFollow * MaxFollow;
        } else if (claimStateFollow.count < MaxFollow) {
            follow = RewardFollow * (MaxFollow - claimStateFollow.count);
        }

        ClaimState storage claimStateShare = shareClaimed[msg.sender];
        if (timeInDays > claimStateShare.time) {
            share = RewardShare * MaxShare;
        } else if (claimStateShare.count < MaxShare) {
            share = RewardShare * (MaxShare - claimStateShare.count);
        }

        if (!isVotingClaimed[msg.sender]) vote = RewardVote;
    }

    /* ============ External Functions ============ */
    function claimSocialVerify(bytes calldata _signature) external override onlyNoPaused {
        require(!isSocialVerifyClaimed[msg.sender], "Already claimed");
        require(riffian_board.getSocials(msg.sender).length > 0, "Not verified yet");
        // require(_verify(_hashAccount(msg.sender), _signature), "Invalid signature");
        isSocialVerifyClaimed[msg.sender] = true;
        (bool success, ) = msg.sender.call{value: RewardSocialVerify}(new bytes(0));
        require(success, "Claim failed");
        emit EventClaimSocial(msg.sender);
    }

    function claimFollow(uint256 _artist, bytes calldata _signature) external override onlyNoPaused {
        require(_verify(_hashFollow(msg.sender, _artist), _signature), "Invalid signature");
        ClaimState storage claimState = followClaimed[msg.sender];
        require(!claimState.claimed[_artist], "Already claimed");
        uint256 timeInDays = block.timestamp / dayInSecs;
        if (timeInDays > claimState.time) {
            claimState.time = timeInDays;
            claimState.count = 0;
        } else {
            require(claimState.count < MaxFollow, "Daily reward limit reached");
        }
        claimState.claimed[_artist] = true;
        claimState.count += 1;
        (bool success, ) = msg.sender.call{value: RewardFollow}(new bytes(0));
        require(success, "Claim failed");
        emit EventClaimFollow(msg.sender, _artist);
    }

    function claimShare(uint256 _artwork, bytes calldata _signature) external override onlyNoPaused {
        require(_verify(_hashShare(msg.sender, _artwork), _signature), "Invalid signature");
        ClaimState storage claimState = shareClaimed[msg.sender];
        require(!claimState.claimed[_artwork], "Already claimed");
        uint256 timeInDays = block.timestamp / dayInSecs;
        if (timeInDays > claimState.time) {
            claimState.time = timeInDays;
            claimState.count = 0;
        } else {
            require(claimState.count < MaxShare, "Daily reward limit reached");
        }
        claimState.claimed[_artwork] = true;
        claimState.count += 1;
        (bool success, ) = msg.sender.call{value: RewardShare}(new bytes(0));
        require(success, "Claim failed");
        emit EventClaimShare(msg.sender, _artwork);
    }

    function claimVote() external override onlyNoPaused {
        require(!isVotingClaimed[msg.sender], "Already claimed");
        require(riffian_board.hasVoted(msg.sender), "Not voted yet");
        isVotingClaimed[msg.sender] = true;
        (bool success, ) = msg.sender.call{value: RewardVote}(new bytes(0));
        require(success, "Claim failed");
        emit EventClaimVote(msg.sender);
    }

    receive() external payable {
        emit EventFund(msg.value);
    }

    fallback() external payable {
        emit EventFund(msg.value);
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
        require(newAddress != address(0), "Riffian signer address must not be null address");
        riffian_airdrop_signer = newAddress;
    }

    /**
     * PRIVILEGED MODULE FUNCTION. Function that update riffian board address.
     */
    function updateRiffianBoard(address newAddress) external onlyOwner {
        require(newAddress != address(0), "Riffian board address must not be null address");
        riffian_board = IRiffianCheck(newAddress);
    }

    /* ============ Internal Functions ============ */

    function _verify(bytes32 hash, bytes calldata signature) private view returns (bool) {
        return ECDSA.recover(hash, signature) == riffian_airdrop_signer;
    }

    function _hashAccount(address _account) private view returns (bytes32) {
        return _hashTypedDataV4(keccak256(abi.encode(keccak256("Account(address account)"), _account)));
    }

    function _hashFollow(address _account, uint256 _artist) private view returns (bytes32) {
        return _hashTypedDataV4(keccak256(abi.encode(keccak256("Follow(address account,uint256 artist)"), _account, _artist)));
    }

    function _hashShare(address _account, uint256 _artwork) private view returns (bytes32) {
        return _hashTypedDataV4(keccak256(abi.encode(keccak256("Share(address account,uint256 artwork)"), _account, _artwork)));
    }

    function _validateOnlyNotPaused() internal view {
        require(!paused, "Contract paused");
    }
}
