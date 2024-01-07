// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

/**
 * @title IRiffianAirdrop
 * @author Riffian Global
 *
 * Interface for operating with riffian airdrop.
 */
interface IRiffianAirdrop {
    function claimSocialVerify(bytes calldata _signature) external;

    function claimFollow(uint256 artist, bytes calldata _signature) external;

    function claimShare(uint256 artwork, bytes calldata _signature) external;

    function claimVote() external;

    function claimable() external view returns (uint256 socialVerify, uint256 follow, uint256 share, uint256 vote);
}
