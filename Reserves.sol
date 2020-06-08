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
    
    struct Payment {
        bytes32 id;
        address payable receiver;
        uint256 amountReceived;
        uint256 amountInDefault;
        uint256 settleTimestamp;
        uint256 voidTimestamp;
    }
    
    address payable public owner;
    bytes32[] public claimIDs;
    mapping (bytes32 => Claim[]) claims;
    mapping (bytes32 => Claim) inSettlement;
    mapping (bytes32 => uint256[2]) settlementTimestamp;
    uint256 claimed;
    uint256 minVestDuration = 86400;

    mapping (bytes32 => Payment) payments;

    /// PUBLIC STATE MODIFYING FUNCTIONS
    constructor (bytes32 constructID) public {
        DOMAIN_SEPARATOR = keccak256(abi.encode(EIP712DOMAINTYPE_HASH, VERSION_HASH, constructID, this, SALT));
        owner = msg.sender;
    }
    
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
        inSettlement[id].id = id;
        inSettlement[id].receiver = receiver;
        inSettlement[id].amount = values[0];
        inSettlement[id].disputeDuration = values[1];
        inSettlement[id].vestTimestamp = values[2];
        inSettlement[id].voidTimestamp = values[3];
        inSettlement[id].nonce = nonce;
        settlementTimestamp[id][0] = now;
        settlementTimestamp[id][1] = now;
        claimed = SafeMath.add(claimed, getAdjustedClaimAmount(id));
        claims[id].push(inSettlement[id]);
        // if no dispute period transfer immediately
        if (inSettlement[id].disputeDuration == 0) {
            closeDispute(id);
        }
    }

    function dispute(bytes memory data, uint8[2] memory vs, bytes32[2] memory rs, bytes32[2] memory ss) public {
        bytes32 hash = getClaimHash(data);
        (bytes32 sid, address payable receiver, uint256[4] memory values, uint8 nonce) = abi.decode(data, (bytes32, address, uint256[4], uint8));
        bytes32 id = getClaimID(sid, receiver);
        require(SafeMath.add(settlementTimestamp[id][1], inSettlement[id].disputeDuration) > now);
        require(inSettlement[id].receiver == receiver);
        require(inSettlement[id].nonce > 0);
        // minimum required duration between vest and void time
        require(SafeMath.sub(values[3], values[2]) >= minVestDuration);
        require(nonce > inSettlement[id].nonce);
        require(ecrecover(hash, vs[0], rs[0], ss[0]) == owner);
        require(ecrecover(hash, vs[1], rs[1], ss[1]) == Reserves(receiver).getOwner());
        uint256 oldAmount = getAdjustedClaimAmount(id);
        inSettlement[id].amount = values[0];
        inSettlement[id].disputeDuration = values[1];
        inSettlement[id].vestTimestamp = values[2];
        inSettlement[id].voidTimestamp = values[3];
        inSettlement[id].nonce = nonce;
        settlementTimestamp[id][1] = now;
        uint256 newAmount = getAdjustedClaimAmount(id);
        claimed = SafeMath.sub(claimed, oldAmount);
        claimed = SafeMath.add(claimed, newAmount);
        claims[id].push(inSettlement[id]);
    }
    
    function redeemClaim(bytes32 claimID) public {
        require(settlementTimestamp[claimID][1] > 0);
        require(SafeMath.add(settlementTimestamp[claimID][1], inSettlement[claimID].disputeDuration) < now);
        require(inSettlement[claimID].amount > 0);
        closeDispute(claimID);
    }
    
    function redeemDefault(bytes32 claimID) public {
        uint256 amount = getAdjustedDefaultAmount(claimID);
        require(amount > 0);
        require(address(this).balance > 0);
        if (address(this).balance >= amount) {
            claimed = SafeMath.sub(claimed, amount);
            payments[claimID].amountReceived = SafeMath.add(payments[claimID].amountReceived, amount);
            payments[claimID].amountInDefault = 0;
            payments[claimID].receiver.transfer(amount);
        } else {
            claimed = SafeMath.sub(claimed, address(this).balance);
            payments[claimID].amountReceived = SafeMath.add(payments[claimID].amountReceived, address(this).balance);
            payments[claimID].amountInDefault = SafeMath.sub(payments[claimID].amountInDefault, address(this).balance);
            payments[claimID].receiver.transfer(address(this).balance);          
        }
    }
    
    function withdraw(uint256 amount) public {
        require(msg.sender == owner);
        require(address(this).balance >= claimed+amount);
        owner.transfer(amount);
    }
    
    /// PUBLIC VIEW/PURE FUNCTIONS
    function getOwner() public view returns (address) {
        return owner;
    }

    function getClaimHash(bytes memory data) public view returns (bytes32) {
        return keccak256(abi.encodePacked("\x19\x01", DOMAIN_SEPARATOR, keccak256(data)));
    }
    
    function getClaimID(bytes32 sid, address addr) public pure returns (bytes32) {
        return keccak256(abi.encode(sid, keccak256(abi.encode(addr))));
    }
    
    function getAllClaimIDs() public view returns (bytes32[] memory) {
        return claimIDs;
    }
    
    function getActiveClaim(bytes32 claimID) public view returns (bytes memory) {
        require(inSettlement[claimID].nonce > 0);
        return encodeClaim(inSettlement[claimID].id, inSettlement[claimID].receiver, inSettlement[claimID].amount, inSettlement[claimID].disputeDuration, inSettlement[claimID].vestTimestamp, inSettlement[claimID].voidTimestamp, inSettlement[claimID].nonce);
    }
    
    function getAdjustedClaimAmount(bytes32 claimID) public view returns (uint256) {
        require(inSettlement[claimID].vestTimestamp < now);
        require(inSettlement[claimID].voidTimestamp > now);
        uint256 numerator = SafeMath.mul(100, SafeMath.sub(settlementTimestamp[claimID][0], inSettlement[claimID].vestTimestamp));
        uint256 denominator = SafeMath.sub(inSettlement[claimID].voidTimestamp, inSettlement[claimID].vestTimestamp);
        uint256 percentLost = SafeMath.div(numerator, denominator);
        return SafeMath.div(SafeMath.sub(SafeMath.mul(100, inSettlement[claimID].amount), SafeMath.mul(percentLost, inSettlement[claimID].amount)), 100);
    }
    
    function getAdjustedDefaultAmount(bytes32 claimID) public view returns (uint256) {
        require(payments[claimID].settleTimestamp < now);
        require(payments[claimID].voidTimestamp > now);
        uint256 numerator = SafeMath.mul(100, SafeMath.sub(now, payments[claimID].settleTimestamp));
        uint256 denominator = SafeMath.sub(inSettlement[claimID].voidTimestamp, payments[claimID].settleTimestamp);
        uint256 percentLost = SafeMath.div(numerator, denominator);
        return SafeMath.div(SafeMath.sub(SafeMath.mul(100, payments[claimID].amountInDefault), SafeMath.mul(percentLost, payments[claimID].amountInDefault)), 100);
    }
    
    function getClaim(bytes32 claimID, uint8 i) public view returns (bytes memory) {
        require(claims[claimID].length > i);
        return encodeClaim(claims[claimID][i].id, claims[claimID][i].receiver, claims[claimID][i].amount, claims[claimID][i].disputeDuration, claims[claimID][i].vestTimestamp, claims[claimID][i].voidTimestamp, claims[claimID][i].nonce);
    }
    
    function isValidClaim(bytes memory data) public view returns (bool) {
        (bytes32 sid, address payable receiver, uint256[4] memory values, uint8 nonce) = abi.decode(data, (bytes32, address, uint256[4], uint8));
        if (0 >= nonce) {
            return false;
        }
        if (SafeMath.sub(values[3], values[2])< minVestDuration) {
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
    
    /// INTERNAL (PROTECTED) FUNCTIONS
    
    function closeDispute(bytes32 claimID) internal {
        address payable recv = inSettlement[claimID].receiver;
        uint256 amount = getAdjustedClaimAmount(claimID);
        if (address(this).balance >= amount) {
            payments[claimID] = Payment(inSettlement[claimID].id, recv, amount, 0, now, inSettlement[claimID].voidTimestamp);
            delete inSettlement[claimID];
            delete settlementTimestamp[claimID];
            claimed = SafeMath.sub(claimed, amount);
            recv.transfer(amount);
        } else {
            if (address(this).balance > 0) {
                payments[claimID] = Payment(inSettlement[claimID].id, recv, address(this).balance, SafeMath.sub(amount, address(this).balance), now, inSettlement[claimID].voidTimestamp);
                claimed = SafeMath.sub(claimed, address(this).balance);
                delete inSettlement[claimID];
                delete settlementTimestamp[claimID];
                recv.transfer(address(this).balance);
            } else {
                payments[claimID] = Payment(inSettlement[claimID].id, recv, 0, amount, now, inSettlement[claimID].voidTimestamp);
                delete inSettlement[claimID];
                delete settlementTimestamp[claimID];
            }
        }
    }

    // fallback funtion
    function () external payable {}
}