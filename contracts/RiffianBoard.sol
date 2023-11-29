//"SPDX-License-Identifier: UNLICENSED

pragma solidity ^0.8.19;

import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/utils/math/SafeMath.sol";
import "./interface/IRiffianBoard.sol";
import "./AlbumNFT.sol";

// import "hardhat/console.sol";

contract RiffianBoard is Initializable, OwnableUpgradeable, IRiffianBoard {
    // constants
    uint private constant MULTIPLIER = 1e18;

    // PARAMS
    uint public rewardIntervalMin;
    uint public teamRewardPercents; // to team address every vote
    uint public artistRewardPercents; // to artist for every vote
    uint public dailyRewardPercents; // 50% of vote
    uint public albumPoolRewardPercents; // 40% of vote

    address public teamAddress;
    mapping(address => AlbumData) public albumToData; // album => votes number
    address[] public albumsList;

    // guardian
    address public guardian;

    // daily rewards related
    uint public startTimeStamp; // the start timestamp of the periodic reward
    uint public interval; // the seconds of a reward period
    uint public currentSeqNumber; // the seq number of reward
    mapping(uint => RewardData) public seqToRewardData; // seq => reward data

    // album rewards related
    mapping(address => uint) public albumRewardsIndex; // pool address => pool reward index
    mapping(address => uint) public albumRewardsBalance; // pool address => pool reward tokens
    mapping(address => mapping(address => uint)) public userAlbumRewardsEarned; // album => user => earn
    mapping(address => mapping(address => uint)) public userAlbumRewardIndex; // album => user => index
    mapping(address => mapping(address => uint)) public userAlbumVotes; // album => user => votes

    // EVENTS
    event NewRewardDistribution(uint _team, uint _artist, uint _daily, uint _album);
    event NewAlbum(address owner, address album);
    event NewVote(address from, address to, uint amount, uint dailyRewardAmount, uint albumPoolRewardAmount, uint teamRewardAmount, uint artistRewardAmount, uint seq);
    event EventVote(address voter, address album, bool isVote, uint256 amount, uint256 value, uint256 supply);
    event ClaimAlbumRewards(address account, address album, uint reward);
    event ClaimDailyRewards(address account, uint reward);

    function initialize(address _team, uint _startTimeStamp, uint _interval) public initializer {
        __Ownable_init();

        teamAddress = address(_team);
        startTimeStamp = _startTimeStamp;
        interval = _interval;

        rewardIntervalMin = 60 * 60 * 24;
        teamRewardPercents = 5; // 5%
        artistRewardPercents = 5; // 5%
        dailyRewardPercents = 50; // 50% of vote
        albumPoolRewardPercents = 40; // 40% of vote
    }

    function setRewardDistribution(uint _team, uint _artist, uint _daily, uint _album) external onlyOwner {
        require(_team > 0 && _team < 100);
        require(_artist > 0 && _artist < 100);
        require(_daily > 0 && _daily < 100);
        require(_album > 0 && _album < 100);

        teamRewardPercents = _team;
        artistRewardPercents = _artist;
        dailyRewardPercents = _daily;
        albumPoolRewardPercents = _album;

        emit NewRewardDistribution(teamRewardPercents, artistRewardPercents, dailyRewardPercents, albumPoolRewardPercents);
    }

    function setTeamAddress(address _team) external onlyOwner {
        require(_team != address(0), "invalid team address");
        teamAddress = _team;
    }

    function setInterval(uint _interval) external onlyOwner {
        require(_interval > rewardIntervalMin);
        interval = _interval;
    }

    function setStartTimeStamp(uint _startTimeStamp) external onlyOwner {
        require(_startTimeStamp > 0);
        startTimeStamp = _startTimeStamp;
    }

    function pauseVote() external onlyOwner {}

    function newAlbum(string memory _name, string memory _symbol) external {
        TrackNFT album = new TrackNFT(_name, _symbol);
        albumsList.push(address(album));
        albumRewardsIndex[address(album)] = 0;
        albumRewardsBalance[address(album)] = 0;

        AlbumData storage data = albumToData[address(album)];
        data.artist = msg.sender;
        // console.log("new album address", address(album));

        emit NewAlbum(msg.sender, address(album));
    }

    function vote(address _album) external payable {
        vote(_album, 1);
    }

    function vote(address _album, uint256 _amount) public payable {
        // check insufficient payment
        (uint256 value, uint256 price, uint256 protocolFee, uint256 subjectFee) = getVotePriceWithFee(_album, _amount);
        require(msg.value >= value, "Insufficient payment");

        // increase user votes
        uint256 oldAmount = userAlbumVotes[_album][msg.sender];
        userAlbumVotes[_album][msg.sender] = oldAmount + _amount;

        // increate album votes
        albumToData[_album].votes += _amount;

        emit EventVote(msg.sender, _album, true, _amount, price, albumToData[_album].votes);

        // @todo distrubte fees

        // refund
        uint refund = msg.value - value;
        if (refund > 0) {
            (bool success, ) = msg.sender.call{value: refund}("");
            require(success, "Failed to refund to user");
        }
    }

    function retreat(address _album, uint256 _amount) external {
        uint256 supply = albumToData[_album].votes;
        require(supply >= _amount && userAlbumVotes[_album][msg.sender] >= _amount, "Insufficient votes");

        // decrease user votes
        uint256 newAmount = userAlbumVotes[_album][msg.sender] - _amount;
        userAlbumVotes[_album][msg.sender] = newAmount;

        // decreate album votes
        albumToData[_album].votes -= _amount;

        uint256 price = getRetreatPrice(_album, _amount);

        emit EventVote(msg.sender, _album, false, _amount, price, albumToData[_album].votes);

        (bool success, ) = msg.sender.call{value: price}("");
        require(success, "Failed to send funds");
    }

    function getPrice(uint256 _supply, uint256 _amount) public pure returns (uint256) {
        uint256 sum1 = _supply == 0 ? 0 : (_supply * (_supply + 1)) / 2;
        uint256 sum2 = ((_supply + _amount) * (_supply + _amount + 1)) / 2;
        uint256 summation = sum2 - sum1;
        return (summation * 1 ether) / 10;
    }

    function getVotePrice(address _album, uint256 _amount) public view returns (uint256) {
        return getPrice(albumToData[_album].votes, _amount);
    }

    function getRetreatPrice(address _album, uint256 _amount) public view returns (uint256) {
        return getPrice(albumToData[_album].votes - _amount, _amount);
    }

    function getVotePriceWithFee(address _album, uint256 _amount) public view returns (uint256 _sum, uint256 _price, uint256 _protocolFee, uint256 _subjectFee) {
        _price = getVotePrice(_album, _amount);
        _protocolFee = (_price * teamRewardPercents) / 100;
        _subjectFee = (_price * artistRewardPercents) / 100;
        _sum = _price + _protocolFee + _subjectFee;
    }

    function calculateDailyRewards(address _account) public view returns (uint) {
        // RewardData memory reward = seqToRewardData[currentSeqNumber];
        uint votes = seqToRewardData[currentSeqNumber].userVotes[_account];
        // console.log("calculate daily rewards", votes, dailyRewardIndex , userDailyRewardIndex[_account]);
        return (votes * (seqToRewardData[currentSeqNumber].rewardIndex - seqToRewardData[currentSeqNumber].userIndex[_account]));
    }

    function _updateDailyRewards(address _account, uint _seq) private {
        RewardData storage reward = seqToRewardData[_seq];
        reward.userEarned[_account] += calculateDailyRewards(_account);
        reward.userIndex[_account] = reward.rewardIndex;
        reward.userVotes[_account] += 1;
    }

    function _updateDailyRewardsIndex(uint _amount, uint _seq) private {
        RewardData storage reward = seqToRewardData[_seq];
        if (reward.votes > 0) {
            // console.log("updateDailyRewardIndex",dailyRewardIndex,  _amount, dailyRewardVotes);
            reward.rewardIndex += (_amount) / reward.votes;
        }
        reward.votes += 1;
    }

    function calculateAlbumRewards(address _account, address _album) public view returns (uint) {
        uint votes = userAlbumVotes[_album][_account];
        return (votes * (albumRewardsIndex[_album] - userAlbumRewardIndex[_album][_account]));
    }

    function _updateAlbumRewards(address _account, address _album) private {
        userAlbumRewardsEarned[_album][_account] += calculateAlbumRewards(_account, _album);
        userAlbumRewardIndex[_album][_account] = albumRewardsIndex[_album];
        userAlbumVotes[_album][_account] += 1;
    }

    function _updateAlbumRewardsIndex(uint _amount, address _album) private {
        if (albumRewardsBalance[_album] > 0) {
            albumRewardsIndex[_album] += (_amount * MULTIPLIER) / albumRewardsBalance[_album];
        }
        albumRewardsBalance[_album] += 1;
    }

    function _distributeAmount(uint _amount, address _album) internal returns (uint, uint, uint, uint) {
        (, uint amount_one_percent) = SafeMath.tryDiv(_amount, 100);
        (, uint dailyRewardAmount) = SafeMath.tryMul(amount_one_percent, teamRewardPercents);
        (, uint albumPoolRewardAmount) = SafeMath.tryMul(amount_one_percent, albumPoolRewardPercents);
        (, uint teamRewardAmount) = SafeMath.tryMul(amount_one_percent, teamRewardPercents);
        (, uint artistRewardAmount) = SafeMath.tryMul(amount_one_percent, artistRewardPercents);

        //
        uint seq = (block.timestamp - startTimeStamp) / interval;
        require(seq >= currentSeqNumber, "invalid current seq number");
        // RewardData storage rewardData = seqToRewardData(seq);
        if (seq > currentSeqNumber) {
            currentSeqNumber = seq;
            // emit NewRewardPool(seq);
        }

        // update daily rewards
        _updateDailyRewards(msg.sender, currentSeqNumber);
        _updateDailyRewardsIndex(dailyRewardAmount, currentSeqNumber);

        // update album rewards
        _updateAlbumRewards(msg.sender, _album);
        _updateAlbumRewardsIndex(albumPoolRewardAmount, _album);

        // distribute to others
        // console.log("send amount", _amount);
        // console.log("send to artist", albumToData[_album].artist, artistRewardAmount);
        // console.log("send to team", teamRewardAmount);
        // console.log("send to daily pool", dailyRewardAmount);
        // console.log("send to album pool", albumPoolRewardAmount);

        (bool sent, ) = albumToData[_album].artist.call{value: artistRewardAmount}("");
        require(sent, "Failed to send token to artist");
        (sent, ) = teamAddress.call{value: teamRewardAmount}("");
        require(sent, "Failed to send token to team");
        return (dailyRewardAmount, albumPoolRewardAmount, teamRewardAmount, artistRewardAmount);
    }

    function calculateVotePrice(uint _counter) public pure returns (uint price) {
        return getPrice(_counter - 1, 1);
    }

    function calculateAlbumVotePrice(address _album) public view returns (uint price) {
        return getVotePrice(_album, 1);
    }

    function claimDailyRewards(uint _seq) public returns (uint) {
        _updateDailyRewards(msg.sender, _seq);
        RewardData storage rewardData = seqToRewardData[_seq];
        uint reward = rewardData.userEarned[msg.sender];
        // console.log("claim daily reward", reward);
        if (reward > 0) {
            rewardData.userEarned[msg.sender] = 0;
            (bool sent, ) = msg.sender.call{value: reward}("");
            require(sent, "Failed to send reward to user");
        }
        emit ClaimDailyRewards(msg.sender, reward);
        return reward;
    }

    function claimAlbumRewards(address _album) external returns (uint) {
        _updateAlbumRewards(msg.sender, _album);
        uint reward = userAlbumRewardsEarned[_album][msg.sender];
        if (reward > 0) {
            userAlbumRewardsEarned[_album][msg.sender] = 0;
            (bool sent, ) = msg.sender.call{value: reward}("");
            require(sent, "Failed to send reward to user");
        }
        emit ClaimAlbumRewards(msg.sender, _album, reward);
        return reward;
    }
}
