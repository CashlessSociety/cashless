pragma solidity ^0.6.0;

contract CashlessLibPub {

	constructor () public {}
    
    function hashClaimData(bytes memory data, bytes32 domainSeparator) public pure returns (bytes32) {
        return keccak256(abi.encodePacked(domainSeparator, data));
    }

    function messageHash(bytes32 _hash) public pure returns (bytes32) {
        return keccak256(abi.encodePacked("\x19Ethereum Signed Message:\n32", _hash));
    }
    
    function getClaimID(bytes32 claimName, address sender, address receiver) public pure returns (bytes32) {
        return keccak256(abi.encodePacked(claimName, sender, receiver));
    }
    
    function getLoopID(bytes32 proposalName, address[] memory loop) public pure returns (bytes32) {
        return keccak256(abi.encodePacked(proposalName, loop));
    }

    function encodeLoopClaim(bytes memory a, uint8[2] memory b, bytes32[2] memory c,  bytes32[2] memory d) public pure returns (bytes memory) {
    	return abi.encode(a, b, c, d);
    }

    function verifySignature(bytes32 hash, uint8 v, bytes32 r, bytes32 s, address signer) public pure returns (bool) {
        if (ecrecover(hash, v, r, s) == signer) {
            return true;
        }
        return false;
    }

    fallback () external {}
}