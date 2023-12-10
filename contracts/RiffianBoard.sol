//"SPDX-License-Identifier: UNLICENSED

pragma solidity ^0.8.19;

import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/structs/EnumerableSetUpgradeable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/utils/math/SafeMath.sol";
import "./interface/IRiffianBoard.sol";

import "hardhat/console.sol";

contract RiffianBoard is Initializable, OwnableUpgradeable, IRiffianBoard {
    using EnumerableSetUpgradeable for EnumerableSetUpgradeable.Bytes32Set;
    // constants
    uint private constant MULTIPLIER = 1e18;
    uint constant interval = 1 weeks; // the seconds of a reward period

    // PARAMS
    uint public protocolFeePercents; // to protocol pool
    uint public subjectFeePercents; // to subject creator
    uint public agentFeePercents; // to agent of artist
    uint public boardFeePercents; // to board reward pool

    address public protocolFeeDestination;

    mapping(bytes32 => SubjectData) public subjectToData; // subject => votes number
    bytes32[] public subjectsList;

    // guardian
    address public guardian;

    // daily rewards related
    uint public startTimeStamp; // the start timestamp of the periodic reward

    mapping(uint256 => uint256) public weeklyVotes; // week => votes
    mapping(address => mapping(uint256 => uint256)) public userWeeklyVotes; // user => week => votes
    mapping(uint256 => uint256) public weeklyReward; // week => reward
    mapping(uint256 => mapping(address => uint256)) public weeklyRewardClaimed; // week => user => reward

    mapping(bytes32 => mapping(address => uint)) public userSubjectVotes; // subject => user => votes

    mapping(address => EnumerableSetUpgradeable.Bytes32Set) private socialPlatformHash; // artist => social platforms
    mapping(address => mapping(bytes32 => SocialData)) public socialPlatform; // artist => social platform hash => social data

    mapping(address => address) public agentAddress; // artist => agent

    mapping(address => mapping(bytes32 => mapping(uint256 => uint256))) public userSubjectWeeklyVotes; // user => subject => week => votes

    // EVENTS
    event NewRewardDistribution(uint _team, uint _artist, uint _daily, uint _subject);
    event NewSubject(address owner, bytes32 subject, string name, string image, string uri);
    event NewVote(address from, address to, uint amount, uint dailyRewardAmount, uint subjectPoolRewardAmount, uint teamRewardAmount, uint artistRewardAmount, uint seq);
    event EventVote(address voter, bytes32 subject, bool isVote, uint256 amount, uint256 value, uint256 supply);
    event EventClaimReward(address account, uint week, uint reward);
    // An event that someone binds a social account on `platform` with id `id` and a verification `uri` that should contain `account` in content.
    event EventBind(address account, string platform, string id, string uri);

    function initialize(address _feeDestination, uint _startTimeStamp) public initializer {
        __Ownable_init();

        protocolFeeDestination = address(_feeDestination);
        startTimeStamp = _startTimeStamp;

        protocolFeePercents = 2; // 2%
        subjectFeePercents = 2; // 2%
        agentFeePercents = 2; // 2%
        boardFeePercents = 4; // 4%
    }

    function setRewardDistribution(uint _protocol, uint _subject, uint _agent, uint _board) external onlyOwner {
        require(_protocol > 0 && _protocol < 10);
        require(_subject > 0 && _subject < 10);
        require(_agent > 0 && _agent < 10);
        require(_board > 0 && _board < 10);

        protocolFeePercents = _protocol;
        subjectFeePercents = _subject;
        agentFeePercents = _agent;
        boardFeePercents = _board;

        emit NewRewardDistribution(protocolFeePercents, subjectFeePercents, agentFeePercents, boardFeePercents);
    }

    function setFeeDestination(address _feeDestination) external onlyOwner {
        require(_feeDestination != address(0), "invalid team address");
        protocolFeeDestination = _feeDestination;
    }

    function pauseVote() external onlyOwner {}

    function bindAgent(address _agent, bytes32 _checksum) public {
        require(agentAddress[msg.sender] == address(0), "Already bound");
        require(keccak256(abi.encodePacked(_agent, address(this))) == _checksum, "Invalid checksum");
        agentAddress[msg.sender] = _agent;
    }

    function bindSocial(string calldata _platform, string calldata _id, string calldata _uri) public {
        bytes32 platformHash = keccak256(bytes(_platform));
        socialPlatformHash[msg.sender].add(platformHash);
        SocialData storage data = socialPlatform[msg.sender][platformHash];
        data.platform = _platform;
        data.id = _id;
        data.uri = _uri;
        emit EventBind(msg.sender, _platform, _id, _uri);
    }

    function unbindSocial(string calldata _platform) public {
        bytes32 platformHash = keccak256(abi.encodePacked(_platform));
        socialPlatformHash[msg.sender].remove(platformHash);
        delete socialPlatform[msg.sender][platformHash];
        emit EventBind(msg.sender, _platform, "", "");
    }

    function getSocials(address _owner) public view returns (SocialData[] memory _socials) {
        uint length = socialPlatformHash[_owner].length();
        _socials = new SocialData[](length);
        for (uint i = 0; i < length; i++) {
            _socials[i] = socialPlatform[_owner][socialPlatformHash[_owner].at(i)];
        }
    }

    function newSubject(string memory _name, string memory _image, string memory _uri) external returns (bytes32) {
        require(socialPlatformHash[msg.sender].length() != 0, "Bind at least one social account to continue");
        // TrackNFT subject = new TrackNFT(_name, _symbol);
        bytes32 subject = keccak256(abi.encodePacked(msg.sender, _name));
        subjectsList.push(subject);
        SubjectData storage data = subjectToData[subject];
        data.artist = msg.sender;
        data.name = _name;
        data.image = _image;
        data.uri = _uri;
        // console.log("new subject address", address(subject));
        emit NewSubject(msg.sender, subject, _name, _image, _uri);
        return subject;
    }

    function vote(bytes32 _subject, uint256 _amount) public payable {
        // check insufficient payment
        (uint256 value, uint256 price, uint256 protocolFee, uint256 subjectFee, uint256 agentFee, uint256 boardFee) = getVotePriceWithFee(_subject, _amount);
        require(msg.value >= value, "Insufficient payment");

        // increase user votes
        uint256 oldAmount = userSubjectVotes[_subject][msg.sender];
        userSubjectVotes[_subject][msg.sender] = oldAmount + _amount;

        // increate weekly votes
        uint256 week = getWeek();
        oldAmount = weeklyVotes[week];
        weeklyVotes[week] = oldAmount + _amount;
        oldAmount = userWeeklyVotes[msg.sender][week];
        userWeeklyVotes[msg.sender][week] = oldAmount + _amount;
        oldAmount = userSubjectWeeklyVotes[msg.sender][_subject][week];
        userSubjectWeeklyVotes[msg.sender][_subject][week] = oldAmount + _amount;

        // increate subject votes
        subjectToData[_subject].votes += _amount;

        uint256 _votes = subjectToData[_subject].votes;
        emit EventVote(msg.sender, _subject, true, _amount, price, _votes);

        // distrubte fees
        _distributeFees(_subject, protocolFee, subjectFee, agentFee, boardFee);

        // refund
        uint refund = msg.value - value;
        if (refund > 0) {
            (bool success, ) = msg.sender.call{value: refund}("");
            require(success, "Failed to refund to user");
        }
    }

    function retreat(bytes32 _subject, uint256 _amount) external {
        uint256 supply = subjectToData[_subject].votes;
        require(supply >= _amount && userSubjectVotes[_subject][msg.sender] >= _amount, "Insufficient votes");

        // decrease user votes
        uint256 newAmount = userSubjectVotes[_subject][msg.sender] - _amount;
        userSubjectVotes[_subject][msg.sender] = newAmount;

        // decreate weekly votes
        uint256 week = getWeek();
        uint256 oldAmount = userSubjectWeeklyVotes[msg.sender][_subject][week];
        if (oldAmount > 0) {
            uint256 amountToDecrease = _amount;
            if (oldAmount < _amount) {
                amountToDecrease = oldAmount;
            }
            userSubjectWeeklyVotes[msg.sender][_subject][week] = oldAmount - amountToDecrease;
            userWeeklyVotes[msg.sender][week] = userWeeklyVotes[msg.sender][week] - amountToDecrease;
            weeklyVotes[week] = weeklyVotes[week] - amountToDecrease;
        }

        // decreate subject votes
        subjectToData[_subject].votes = supply - _amount;

        uint256 price = getPrice(supply - _amount, _amount);
        emit EventVote(msg.sender, _subject, false, _amount, price, subjectToData[_subject].votes);

        (bool success, ) = msg.sender.call{value: price}("");
        require(success, "Failed to send funds");
    }

    function getPrice(uint256 _supply, uint256 _amount) public pure returns (uint256) {
        uint256 sum1 = _supply == 0 ? 0 : (_supply * (_supply + 1)) / 2;
        uint256 sum2 = ((_supply + _amount) * (_supply + _amount + 1)) / 2;
        uint256 summation = sum2 - sum1;
        return (summation * 1 ether) / 10;
    }

    function getVotePrice(bytes32 _subject, uint256 _amount) public view returns (uint256) {
        return getPrice(subjectToData[_subject].votes, _amount);
    }

    function getRetreatPrice(bytes32 _subject, uint256 _amount) public view returns (uint256) {
        return getPrice(subjectToData[_subject].votes - _amount, _amount);
    }

    function getVotePriceWithFee(
        bytes32 _subject,
        uint256 _amount
    ) public view returns (uint256 _sum, uint256 _price, uint256 _protocolFee, uint256 _subjectFee, uint256 _agentFee, uint256 _boardFee) {
        _price = getVotePrice(_subject, _amount);
        _protocolFee = (_price * protocolFeePercents) / 100;
        _subjectFee = (_price * subjectFeePercents) / 100;
        _agentFee = (_price * agentFeePercents) / 100;
        _boardFee = (_price * boardFeePercents) / 100;
        _sum = _price + _protocolFee + _subjectFee + _agentFee + _boardFee;
    }

    function getWeek() public view returns (uint256) {
        return block.timestamp - ((block.timestamp - startTimeStamp) % interval);
    }

    function _distributeFees(bytes32 _subject, uint256 _protocolFee, uint256 _subjectFee, uint256 _agentFee, uint256 _boardFee) internal {
        // update board weekly reward
        weeklyReward[getWeek()] = weeklyReward[getWeek()] + _boardFee;
        // send to artist
        address artist = subjectToData[_subject].artist;
        (bool sent, ) = artist.call{value: _subjectFee}("");
        require(sent, "Failed to send token to artist");
        // send to agent or artist
        address agent = agentAddress[artist];
        if (agent == address(0)) agent = artist;
        (sent, ) = agent.call{value: _agentFee}("");
        require(sent, "Failed to send token to agent");
        // send to protocol
        (sent, ) = protocolFeeDestination.call{value: _protocolFee}("");
        require(sent, "Failed to send token to protocol");
    }

    function calculateVotePrice(uint _counter) public pure returns (uint price) {
        return getPrice(_counter - 1, 1);
    }

    function calculateSubjectVotePrice(bytes32 _subject) public view returns (uint price) {
        return getVotePrice(_subject, 1);
    }

    function claimReward(uint256 _week) public returns (uint) {
        require(_week < getWeek(), "Week not past");
        require(userWeeklyVotes[msg.sender][_week] > 0, "No votes in that week");
        uint256 reward = (weeklyReward[_week] * userWeeklyVotes[msg.sender][_week]) / weeklyVotes[_week];
        if (weeklyRewardClaimed[_week][msg.sender] == 0) {
            weeklyRewardClaimed[_week][msg.sender] = reward;
            (bool sent, ) = msg.sender.call{value: reward}("");
            require(sent, "Failed to send reward to user");
        }
        emit EventClaimReward(msg.sender, _week, reward);
        return reward;
    }
}
