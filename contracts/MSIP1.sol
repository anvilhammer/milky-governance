// Forked from Pickle Finance at commit d2de3b9
// SPDX-License-Identifier: MIT
pragma solidity ^0.6.12;

library SafeMath {
    function add(uint256 a, uint256 b) internal pure returns (uint256) {
        uint256 c = a + b;
        require(c >= a, "add: +");

        return c;
    }

    function add(
        uint256 a,
        uint256 b,
        string memory errorMessage
    ) internal pure returns (uint256) {
        uint256 c = a + b;
        require(c >= a, errorMessage);

        return c;
    }

    function sub(uint256 a, uint256 b) internal pure returns (uint256) {
        return sub(a, b, "sub: -");
    }

    function sub(
        uint256 a,
        uint256 b,
        string memory errorMessage
    ) internal pure returns (uint256) {
        require(b <= a, errorMessage);
        uint256 c = a - b;

        return c;
    }

    function mul(uint256 a, uint256 b) internal pure returns (uint256) {
        // Gas optimization: this is cheaper than requiring 'a' not being zero, but the
        // benefit is lost if 'b' is also tested.
        // See: https://github.com/OpenZeppelin/openzeppelin-contracts/pull/522
        if (a == 0) {
            return 0;
        }

        uint256 c = a * b;
        require(c / a == b, "mul: *");

        return c;
    }

    function mul(
        uint256 a,
        uint256 b,
        string memory errorMessage
    ) internal pure returns (uint256) {
        if (a == 0) {
            return 0;
        }

        uint256 c = a * b;
        require(c / a == b, errorMessage);

        return c;
    }

    function div(uint256 a, uint256 b) internal pure returns (uint256) {
        return div(a, b, "div: /");
    }

    function div(
        uint256 a,
        uint256 b,
        string memory errorMessage
    ) internal pure returns (uint256) {
        require(b > 0, errorMessage);
        uint256 c = a / b;

        return c;
    }
}
interface Creamy {
    function balanceOf(address account) external view returns (uint256);
}

contract MSIP1 {
    using SafeMath for uint256;

    Creamy public creamy;
    uint256 public totalWeight;

    mapping(uint256 => uint256) public weights; // pid => weight
    mapping(address => mapping(uint256 => uint256)) public votes; // msg.sender => pid => votes
    mapping(address => uint256[]) public tokenVote; // msg.sender => token
    
    uint256 voteEnd;
    mapping(uint256 => bool) proposal;

    constructor(address _creamy, uint256 _voteEnd) public {
        creamy = Creamy(_creamy);
        voteEnd = _voteEnd;
    }

    // Reset votes to 0
    function reset() external {
        _reset(msg.sender);
    }

    // Reset votes to 0
    function _reset(address _owner) internal {
        uint256[] storage _tokenVote = tokenVote[_owner];
        uint256 _tokenVoteCnt = _tokenVote.length;

        for (uint256 i = 0; i < _tokenVoteCnt; i++) {
            uint256 _pid = _tokenVote[i];
            uint256 _votes = votes[_owner][_pid];

            if (_votes > 0) {
                totalWeight = totalWeight.sub(_votes);
                weights[_pid] = weights[_pid].sub(_votes);

                votes[_owner][_pid] = 0;
            }
        }

        delete tokenVote[_owner];
    }

    function _vote(
        address _owner,
        uint256[] memory _pidVote,
        uint256[] memory _weights
    ) internal {
        // _weights[i] = percentage * 100
        _reset(_owner);
        uint256 _pidCnt = _pidVote.length;
        uint256 _weight = creamy.balanceOf(_owner);
        uint256 _totalVoteWeight = 0;
        uint256 _usedWeight = 0;

        for (uint256 i = 0; i < _pidCnt; i++) {
            _totalVoteWeight = _totalVoteWeight.add(_weights[i]);
        }

        for (uint256 i = 0; i < _pidCnt; i++) {
            uint256 _pid = _pidVote[i];
            uint256 _tokenWeight = _weights[i].mul(_weight).div(
                _totalVoteWeight
            );

            _usedWeight = _usedWeight.add(_tokenWeight);
            totalWeight = totalWeight.add(_tokenWeight);
            weights[_pid] = weights[_pid].add(_tokenWeight);
            tokenVote[_owner].push(_pid);
            votes[_owner][_pid] = _tokenWeight;
        }
    }

    // Vote with creamy on a gauge
    function vote(uint256[] calldata _pidVote, uint256[] calldata _weights)
        external
    {
        require(_pidVote.length == _weights.length, "pid length and weight length don't match");
        require(voteEnd > block.timestamp, "vote is over");
        _vote(msg.sender, _pidVote, _weights);
    }
}