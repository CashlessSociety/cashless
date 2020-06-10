pragma solidity 0.5.0;
import "./SafeMath.sol";

contract Reserves {
    // Precomputed hashes for EIP712 domain separator (unique identifier for messages pertaining to this contract)
    bytes32 constant EIP712DOMAINTYPE_HASH = 0x0eaa6c88c44fbde2113ba7421deef795c18fc5a553a55b2ba4d237269e1c2662;
    bytes32 constant VERSION_HASH = 0xc89efdaa54c0f20c7adf612882df0950f5a951637e0307cdcb4c672f298b8bc6;
    bytes32 constant SALT = 0xb1ae92db93da5bd8411028f6531126984a6eb2e7f66b19e5c22d5a7b0fb00bc7;
    
    // Domain separator completed on contract construction
    bytes32 public DOMAIN_SEPARATOR;
    
    struct Claim {
        bytes32 id;
        address payable receiver;
        uint256 amount;
        uint256 disputeDuration;
        uint256 vestTimestamp;
        uint256 voidTimestamp;
        uint8 nonce;
    }
    
    struct Settlement {
        uint256 amountPaid;
        uint256 amountDefaulted;
    }
    
    address payable public owner;
    bytes32[] public claimIDs;
    bytes32[] public settled;
    mapping (bytes32 => Claim[]) claims;
    mapping (bytes32 => uint256[2]) settlementTimestamps;
    uint256 grossClaimed;
    uint256 grossDefaulted;
    uint256 grossPaid;
    uint256 minVestDuration = 86400;

    mapping (bytes32 => Settlement) settlements;

    // Constructor Function 
    constructor (bytes32 constructID) public {
        DOMAIN_SEPARATOR = keccak256(abi.encodePacked(EIP712DOMAINTYPE_HASH, VERSION_HASH, constructID, this, SALT));
        owner = msg.sender;
    }
    
    // State Modifying Public Functions
    function settle(bytes memory data, uint8[2] memory vs, bytes32[2] memory rs, bytes32[2] memory ss) public {
        bytes32 hash = getClaimHash(data);
        (bytes32 sid, address payable receiver, uint256[4] memory values, uint8 nonce) = abi.decode(data, (bytes32, address, uint256[4], uint8));
        bytes32 id = getClaimID(sid, receiver);
        for (uint256 i=0; i<claimIDs.length; i++) {
            require(claimIDs[i] != id);
        }
        require(values[0] > 0);
        // minimum required duration between vest and void time
        require(SafeMath.sub(values[3], values[2]) >= minVestDuration);
        require(now > values[2]);
        require(now < values[3]);
        require(nonce > 0);
        require(ecrecover(hash, vs[0], rs[0], ss[0]) == owner);
        require(ecrecover(hash, vs[1], rs[1], ss[1]) == Reserves(receiver).getOwner());
 
        claimIDs.push(id);
        claims[id].push(Claim(id, receiver, values[0], values[1], values[2], values[3], nonce));
        settlementTimestamps[id][0] = now;
        settlementTimestamps[id][1] = now;
        grossClaimed = SafeMath.add(grossClaimed, getAdjustedClaimAmount(id));
        // if no dispute period transfer immediately
        if (claims[id][0].disputeDuration == 0) {
            closeDispute(id);
        }
    }

    function dispute(bytes memory data, uint8[2] memory vs, bytes32[2] memory rs, bytes32[2] memory ss) public {
        bytes32 hash = getClaimHash(data);
        (bytes32 sid, address payable receiver, uint256[4] memory values, uint8 nonce) = abi.decode(data, (bytes32, address, uint256[4], uint8));
        bytes32 id = getClaimID(sid, receiver);
        require(claims[id].length > 0);
        uint256 index = claims[id].length - 1;
        require(SafeMath.add(settlementTimestamps[id][1], claims[id][index].disputeDuration) > now);
        require(claims[id][index].receiver == receiver);
        require(claims[id][index].nonce > 0);
        // minimum required duration between vest and void time
        require(SafeMath.sub(values[3], values[2]) >= minVestDuration);
        require(nonce > claims[id][index].nonce);
        require(ecrecover(hash, vs[0], rs[0], ss[0]) == owner);
        require(ecrecover(hash, vs[1], rs[1], ss[1]) == Reserves(receiver).getOwner());
        uint256 oldAmount = getAdjustedClaimAmount(id);
        claims[id].push(Claim(id, receiver, values[0], values[1], values[2], values[3], nonce));
        settlementTimestamps[id][1] = now;
        uint256 newAmount = getAdjustedClaimAmount(id);
        grossClaimed = SafeMath.sub(grossClaimed, oldAmount);
        grossClaimed = SafeMath.add(grossClaimed, newAmount);
        if (claims[id][index+1].disputeDuration == 0) {
            closeDispute(id);
        }
    }
    
    function redeemClaim(bytes32 claimID) public {
        require(settlementTimestamps[claimID][1] > 0);
        require(claims[claimID].length > 0);
        uint256 index = claims[claimID].length - 1;        
        require(SafeMath.add(settlementTimestamps[claimID][1], claims[claimID][index].disputeDuration) < now);
        require(claims[claimID][index].amount > 0);
        closeDispute(claimID);
    }
    
    function withdraw(uint256 amount) public {
        require(msg.sender == owner);
        require(address(this).balance >= grossClaimed+amount);
        owner.transfer(amount);
    }
    
    // Internal (Protected) Functions
    function closeDispute(bytes32 claimID) internal {
        require(claims[claimID].length > 0);
        uint256 index = claims[claimID].length - 1;
        address payable recv = claims[claimID][index].receiver;
        uint256 amount = getAdjustedClaimAmount(claimID);
        grossClaimed = SafeMath.sub(grossClaimed, amount);
        if (address(this).balance >= amount) {
            settlements[claimID] = Settlement(amount, 0);
            grossPaid = SafeMath.add(grossPaid, amount);
            recv.transfer(amount);
        } else {
            if (address(this).balance > 0) {
                uint256 defaultAmount = SafeMath.sub(amount, address(this).balance);
                settlements[claimID] = Settlement(address(this).balance, defaultAmount);
                grossPaid = SafeMath.add(grossPaid, address(this).balance);
                grossDefaulted = SafeMath.add(grossDefaulted, defaultAmount);
                recv.transfer(address(this).balance);
            } else {
                settlements[claimID] = Settlement(0, amount);
                grossDefaulted = SafeMath.add(grossDefaulted, amount);
            }
        }
    }
    
    // Public Helper Functions
    function getOwner() public view returns (address) {
        return owner;
    }
    
    function getClaim(bytes32 claimID, uint8 i) public view returns (bytes memory) {
        require(claims[claimID].length > i);
        return encodeClaim(claims[claimID][i].id, claims[claimID][i].receiver, claims[claimID][i].amount, claims[claimID][i].disputeDuration, claims[claimID][i].vestTimestamp, claims[claimID][i].voidTimestamp, claims[claimID][i].nonce);
    }
    
    function getLatestClaim(bytes32 claimID) public view returns (bytes memory) {
        require(claims[claimID].length > 0);
        return encodeClaim(claims[claimID][claims[claimID].length-1].id, claims[claimID][claims[claimID].length-1].receiver, claims[claimID][claims[claimID].length-1].amount, claims[claimID][claims[claimID].length-1].disputeDuration, claims[claimID][claims[claimID].length-1].vestTimestamp, claims[claimID][claims[claimID].length-1].voidTimestamp, claims[claimID][claims[claimID].length-1].nonce);
    }

    function getSettlement(bytes32 claimID) public view returns (uint256, uint256) {
        return (settlements[claimID].amountPaid, settlements[claimID].amountDefaulted);
    }

    function getClaimHash(bytes memory data) public view returns (bytes32) {
        return keccak256(abi.encodePacked("\x19\x01", DOMAIN_SEPARATOR, keccak256(data)));
    }
    
    function getClaimID(bytes32 sid, address addr) public pure returns (bytes32) {
        return keccak256(abi.encodePacked(sid, keccak256(abi.encodePacked(addr))));
    }
    
    function getAllClaimIDs() public view returns (bytes32[] memory) {
        return claimIDs;
    }
    
    function getNumClaims(bytes32 claimID) public view returns (uint256) {
        return claims[claimID].length;
    }
    
    function getSettlementTime(bytes32 claimID) public view returns (uint256, uint256) {
        return (settlementTimestamps[claimID][0], settlementTimestamps[claimID][1]);
    }
    
    function getAdjustedClaimAmount(bytes32 claimID) public view returns (uint256) {
        require(claims[claimID].length > 0);
        uint256 index = claims[claimID].length - 1;
        require(claims[claimID][index].vestTimestamp < now);
        require(claims[claimID][index].voidTimestamp > now);
        uint256 numerator = SafeMath.mul(100, SafeMath.sub(settlementTimestamps[claimID][0], claims[claimID][index].vestTimestamp));
        uint256 denominator = SafeMath.sub(claims[claimID][index].voidTimestamp, claims[claimID][index].vestTimestamp);
        uint256 percentLost = SafeMath.div(numerator, denominator);
        return SafeMath.div(SafeMath.sub(SafeMath.mul(100, claims[claimID][index].amount), SafeMath.mul(percentLost, claims[claimID][index].amount)), 100);
    }
    
    function isValidClaim(bytes memory data) public view returns (bool) {
        (bytes32 sid, address payable receiver, uint256[4] memory values, uint8 nonce) = abi.decode(data, (bytes32, address, uint256[4], uint8));
        if (0 >= nonce) {
            return false;
        }
        if (SafeMath.sub(values[3], values[2]) < minVestDuration) {
            return false;
        }
        return true;
    }
    
    function verifySignedClaim(bytes memory data, bool isOwner, uint8 v, bytes32 r, bytes32 s) public view returns (bool) {
        (bytes32 sid, address payable receiver, uint256[4] memory values, uint8 nonce) = abi.decode(data, (bytes32, address, uint256[4], uint8));
        if (0 >= nonce) {
            return false;
        }
        if (SafeMath.sub(values[3], values[2]) < minVestDuration) {
            return false;
        }
        bytes32 hash = getClaimHash(data);
        address recover;
        if (isOwner) {
            recover = owner;
        } else {
            recover = Reserves(receiver).getOwner();
        }
        if (ecrecover(hash, v, r, s) != recover) {
            return false;
        }
        return true;
    }
    
    function encodeClaim(bytes32 sid, address payable receiver, uint256 amount, uint256 disputeDuration, uint256 vestTimestamp, uint256 voidTimestamp, uint8 nonce) public pure returns (bytes memory)  {
        uint256[4] memory values;
        values[0] = amount;
        values[1] = disputeDuration;
        values[2] = vestTimestamp;
        values[3] = voidTimestamp;
        return abi.encode(sid, receiver, values, nonce);
    }

    // Fallback Funtion
    function () external payable {}
}