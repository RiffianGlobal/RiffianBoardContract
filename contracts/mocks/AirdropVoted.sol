// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

contract AirdropVoted {
    mapping(address => bool) voted;

    function hasVoted(address account) external view returns (bool) {
        return voted[account];
    }

    function vote() public {
        voted[msg.sender] = true;
    }
}
