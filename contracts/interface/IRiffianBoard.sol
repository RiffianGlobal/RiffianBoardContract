// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

interface IRiffianBoard {
    // `checksum = keccak256(abi.encodePacked(_agent, contractAddress)`
    function bindAgent(address _agent, bytes32 _checksum) external;

    function bindSocial(string calldata _platform, string calldata _id, string calldata _uri) external;

    function unbindSocial(string calldata _platform) external;

    // create a subject for voting
    function newSubject(string memory _name, string memory _image, string memory _uri) external returns (bytes32);

    function vote(bytes32 _subject, uint256 _amount) external payable;

    function retreat(bytes32 _subject, uint256 _amount) external;

    function getPrice(uint256 _supply, uint256 _amount) external pure returns (uint256);

    function getVotePrice(bytes32 _subject, uint256 _amount) external view returns (uint256);

    function getRetreatPrice(bytes32 _subject, uint256 _amount) external view returns (uint256);

    function getVotePriceWithFee(
        bytes32 _subject,
        uint256 _amount
    ) external view returns (uint256 _sum, uint256 _price, uint256 _protocolFee, uint256 _subjectFee, uint256 _agentFee, uint256 _boardFee);

    // Get week start time
    function getWeek() external view returns (uint256);

    function claimReward(uint256 week) external returns (uint);
}

struct SubjectData {
    address artist;
    string name;
    string image;
    string uri;
    uint votes;
}

struct SocialData {
    string platform;
    string id;
    string uri;
}
