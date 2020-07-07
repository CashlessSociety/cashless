pragma solidity >=0.5.0;

contract CashlessLibPub {

	constructor () public {}
    
    function hashClaimData(bytes memory data, bytes32 domainSeparator) public pure returns (bytes32) {
        return keccak256(abi.encodePacked("\x19\x01", domainSeparator, keccak256(data)));
    }
    
    function getClaimID(bytes32 claimName, address sender, address receiver, bytes32 receiverAlias) public pure returns (bytes32) {
        return keccak256(abi.encodePacked(claimName, sender, receiver, receiverAlias));
    }
    
    function getLoopID(bytes32 proposalName, address[] memory loop) public pure returns (bytes32) {
        return keccak256(abi.encodePacked(proposalName, loop));
    }

    function encodeLoopClaim(bytes memory a, uint8[2] memory b, bytes32[2] memory c,  bytes32[2] memory d) public pure returns (bytes memory) {
    	return abi.encode(a, b, c, d);
    }

    function () external {}
}