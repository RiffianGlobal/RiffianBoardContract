
pragma solidity ^0.8.19;
//"SPDX-License-Identifier: UNLICENSED
interface IRiffianBoard {
    function newAlbum(string memory _name, string memory _symbol) external ;
    function vote(address _album) external payable;
    function vote(address _album, uint256 _amount) external payable;
    function retreat(address _album, uint256 _amount) external;
    function getPrice(uint256 _supply, uint256 _amount) external pure returns (uint256);
    function getVotePrice(address _album, uint256 _amount) external view returns (uint256);
    function getRetreatPrice(address _album, uint256 _amount) external view returns (uint256);
    function getVotePriceWithFee(address _album, uint256 _amount) external view returns (uint256 _sum, uint256 _price, uint256 _protocolFee, uint256 _subjectFee, uint256 _agentFee, uint256 _boardFee);
    function calculateDailyRewards(address _account) external view returns (uint) ;
    function calculateAlbumRewards(address _account, address _album) external view returns (uint) ;
    //function claimDailyRewards() external returns (uint);
    function claimAlbumRewards(address _album) external returns (uint);
}

struct AlbumData {
    address artist;
    // pool reward data
    uint rewardIndex;
    uint votes;
    mapping(address=>uint) userEarned;
    mapping(address=>uint) userIndex;
    mapping(address=>uint) userVotes;
}

struct RewardData {
    uint starts;
    uint interval;
    uint rewardIndex;
    uint votes;
    mapping(address=>uint) userEarned;
    mapping(address=>uint) userIndex;
    mapping(address=>uint) userVotes;
}