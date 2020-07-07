pragma solidity >=0.5.0;

library CashlessLib {
    
    function hashClaimData(bytes memory data, bytes32 domainSeparator) internal pure returns (bytes32) {
        return keccak256(abi.encodePacked("\x19\x01", domainSeparator, keccak256(data)));
    }
    
    function getClaimID(bytes32 claimName, address sender, address receiver, bytes32 receiverAlias) internal pure returns (bytes32) {
        return keccak256(abi.encodePacked(claimName, sender, receiver, receiverAlias));
    }
    
    function getLoopID(bytes32 proposalName, address[] memory loop) internal pure returns (bytes32) {
        return keccak256(abi.encodePacked(proposalName, loop));
    }
}