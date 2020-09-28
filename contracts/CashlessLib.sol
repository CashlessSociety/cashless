pragma solidity ^0.6.0;

library CashlessLib {
    
    function hashClaimData(bytes memory data, bytes32 domainSeparator) internal pure returns (bytes32) {
        return keccak256(abi.encodePacked(domainSeparator, data));
    }

    function messageHash(bytes32 _hash) internal pure returns (bytes32) {
        return keccak256(abi.encodePacked("\x19Ethereum Signed Message:\n32", _hash));
    }
    
    function getClaimID(bytes32 claimName, address sender, address receiver) internal pure returns (bytes32) {
        return keccak256(abi.encodePacked(claimName, sender, receiver));
    }
    
    function getLoopID(bytes32 proposalName, address[] memory loop) internal pure returns (bytes32) {
        return keccak256(abi.encodePacked(proposalName, loop));
    }

}