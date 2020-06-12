pragma solidity 0.5.0;
import "./SafeMath.sol";

contract Reserves {
    function settle(bytes memory, uint8[2] memory, bytes32[2] memory, bytes32[2] memory) public {}
    function dispute(bytes memory, uint8[2] memory, bytes32[2] memory, bytes32[2] memory) public {}
    function getClaimHash(bytes memory) public view returns (bytes32) {}
    function verifySignedClaim(bytes memory, bool, uint8, bytes32, bytes32) public view returns (bool) {}
}

contract CyclicReciprocity {
    
    struct SignedClaim {
        bytes claimData;
        uint8[2] vs;
        bytes32[2] rs;
        bytes32[2] ss;
    }
    
    mapping (address => address) public loop;
    uint256 public size;
    address[] committed;
    uint256 public minFlow;
    uint256 public lockTime;
    mapping (address => SignedClaim) public claims;
    mapping (address => bool) settled;
    
    constructor (address[] memory participants, uint256 value, uint256 _lockTime) public {
        require(participants.length >= 2);
        for (uint256 i=0; i<participants.length-1; i++) {
            loop[participants[i]] = participants[i+1];
        }
        loop[participants[participants.length-1]] = participants[0];
        minFlow = value;
        size = participants.length;
        lockTime = _lockTime;
    }
    
    function submitClaim(bytes memory encodedPriorClaim, bytes memory encodedClaim) public {
        require(now<lockTime);
        (address reserves1, bytes memory claim1, uint8[2] memory v1, bytes32[2] memory r1, bytes32[2] memory s1) = abi.decode(encodedPriorClaim, (address, bytes, uint8[2], bytes32[2], bytes32[2]));
        (address reserves2, bytes memory claim2, uint8[2] memory v2, bytes32[2] memory r2, bytes32[2] memory s2) = abi.decode(encodedClaim, (address, bytes, uint8[2], bytes32[2], bytes32[2]));
        require(reserves1==reserves2);
        require(Reserves(reserves1).verifySignedClaim(claim1, true, v1[0], r1[0], s1[0]));
        require(Reserves(reserves1).verifySignedClaim(claim1, false, v1[1], r1[1], s1[1]));
        require(Reserves(reserves1).verifySignedClaim(claim2, true, v2[0], r2[0], s2[0]));
        require(Reserves(reserves1).verifySignedClaim(claim2, false, v2[1], r2[1], s2[1]));
        address receiver = unpackClaims(claim1, claim2);
        require(receiver!=address(0x0));
        require(receiver==loop[reserves1]);
        for (uint256 i=0; i<committed.length; i++) {
            require(committed[i]!=reserves1);
        }
        claims[reserves1] = SignedClaim(claim2, v2, r2, s2);
        committed.push(reserves1);
    }
    
    function unpackClaims(bytes memory priorClaim, bytes memory claim) public view returns (address) {
        (bytes32 sid1, address payable receiver1, uint256[4] memory values1, uint8 nonce1, address cyclicContract1) = abi.decode(priorClaim, (bytes32, address, uint256[4], uint8, address));
        (bytes32 sid2, address payable receiver2, uint256[4] memory values2, uint8 nonce2, address cyclicContract2) = abi.decode(claim, (bytes32, address, uint256[4], uint8, address));
        require(cyclicContract2==address(this));
        require(cyclicContract1!=cyclicContract2);
        require(nonce1+1==nonce2);
        require(sid1==sid2);
        require(receiver1==receiver2);
        require(values2[0] - values1[0] == minFlow);
        return receiver1;
    }
    
    function settle(address sender) public {
        require(committed.length==size);
        Reserves(sender).settle(claims[sender].claimData, claims[sender].vs, claims[sender].rs, claims[sender].ss);
    }
    
    function dispute(address sender) public {
        require(committed.length==size);
        Reserves(sender).dispute(claims[sender].claimData, claims[sender].vs, claims[sender].rs, claims[sender].ss);
    }
}