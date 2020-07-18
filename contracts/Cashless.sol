pragma solidity >=0.5.0;
import "./SafeMath.sol";
import "./CashlessLib.sol";

contract Cashless {
    // Precomputed hash for EIP712 domain separator
    bytes32 constant EIP712HASH = 0x0eaa6c88c44fbde2113ba7421deef795c18fc5a553a55b2ba4d237269e1c2662;
    
    // Domain separator completed on contract construction
    bytes32 public DOMAIN_SEPARATOR;
    
    // Claim
    struct Claim {
        bytes32 claimName;
        address sender;
        address receiver;
        bytes32 receiverAlias;
        uint8 nonce;
        uint256 amount;
        uint256 disputeDuration;
        uint256 vestTimestamp;
        uint256 voidTimestamp;
        bytes32 loopID;
    }
    
    // SignedClaim
    struct SignedClaim {
        bytes claimData;
        uint8[2] sigsV;
        bytes32[2] sigsR;
        bytes32[2] sigsS;
    }
    
    // Settlement
    struct Settlement {
        uint256 amountPaid;
        uint256 amountDefaulted;
        bool settled;
    }
    
    // LoopProposal
    struct LoopProposal {
        bytes32 proposalName;
        address[] loop;
        uint256 minFlow;
        uint256 lockTimestamp;
        mapping (address => SignedClaim) claims;
        address[] committed;
    }
    
    // Reserves
    struct Reserves {
        address owner;
        uint256 balance;
        bytes32[] claimIDs;
        mapping (bytes32 => SignedClaim[]) claims;
        uint256 grossClaimed;
        uint256 grossDefaulted;
        uint256 grossPaid;
        mapping (bytes32 => uint256[2]) proposalTimestamps;
        mapping (bytes32 => Settlement) settlements;
    }
    
    uint256 public minVestDuration = 604800;
    uint256 public flatWithdrawFee = 10000000;
    uint256 public percentWithdrawFee = 1;
    address payable public networkAdmin;
    mapping (address => Reserves) public reserves;
    mapping (bytes32 => address) public aliases;
    mapping (bytes32 => address) public pendingAliases;
    mapping (bytes32 => LoopProposal) public loops;

    // Constructor function
    constructor (bytes32 salt) public {
        DOMAIN_SEPARATOR = keccak256(abi.encodePacked(EIP712HASH, this, salt));
        networkAdmin = msg.sender;
    }
    
    // Public State Modifying functions
    function createReserves(address reservesAddress, uint8 v, bytes32 r, bytes32 s) public {
        bytes32 hash = CashlessLib.hashClaimData(abi.encode(reservesAddress), DOMAIN_SEPARATOR);
        bytes32 defaultAlias = keccak256(abi.encode(reservesAddress));
        require(aliases[defaultAlias] == address(0));
        require(reserves[reservesAddress].balance == 0);
        require(reserves[reservesAddress].owner == address(0));
        require(ecrecover(hash, v, r, s) == reservesAddress);
        aliases[defaultAlias] = reservesAddress;
        reserves[reservesAddress].owner = reservesAddress;
    }
    
    function fundReserves(address accountOwner) public payable {
        require(accountOwner != address(0));
        require(address(reserves[accountOwner].owner) == accountOwner);
        require(msg.value > flatWithdrawFee);
        reserves[accountOwner].balance = SafeMath.add(reserves[accountOwner].balance, msg.value);
    }
    
    function withdrawReserves(uint256 amount, address payable targetReceiver, uint256 fee) public {
        require(reserves[msg.sender].owner == address(msg.sender));
        require(amount>0);
        uint256 minFee = SafeMath.add(SafeMath.div(SafeMath.mul(amount, percentWithdrawFee), 100), flatWithdrawFee);
        require(fee>=minFee);
        uint256 total = SafeMath.add(amount, fee);
        require(reserves[msg.sender].balance >= SafeMath.add(reserves[msg.sender].grossClaimed, total));
        reserves[msg.sender].balance = SafeMath.sub(reserves[msg.sender].balance, total);
        targetReceiver.transfer(amount);
        networkAdmin.transfer(fee);
    }
    
    function addAlias(bytes32 newAlias) public {
        require(reserves[msg.sender].owner == address(msg.sender));
        require(aliases[newAlias]==address(0));
        require(pendingAliases[newAlias]==address(0));
        aliases[newAlias] = msg.sender;
    }
    
    function deleteAlias(bytes32 existingAlias) public {
        require(aliases[existingAlias] == address(msg.sender));
        aliases[existingAlias] = address(0);
    }

    function addPendingAlias(bytes32 newAlias) public {
        require(reserves[msg.sender].owner == address(msg.sender));
        require(aliases[newAlias]==address(0));
        require(pendingAliases[newAlias]==address(0));
        pendingAliases[newAlias] = msg.sender;    
    }

    function commitPendingAlias(bytes32 newAlias, address addr) public {
        require(pendingAliases[newAlias] == msg.sender);
        require(reserves[addr].owner == addr);
        pendingAliases[newAlias] = address(0);
        aliases[newAlias] = addr;
    }
    
    function proposeSettlement(bytes memory claimData, uint8[2] memory sigsV, bytes32[2] memory sigsR, bytes32[2] memory sigsS) public {
        (address sender, bytes32 id, uint256 disputeDuration) = verifySettlement(claimData, sigsV, sigsR, sigsS, false); 
        reserves[sender].claimIDs.push(id);
        reserves[sender].claims[id].push(SignedClaim(claimData, sigsV, sigsR, sigsS));
        reserves[sender].proposalTimestamps[id][0] = now;
        reserves[sender].proposalTimestamps[id][1] = now;
        reserves[sender].grossClaimed = SafeMath.add(reserves[sender].grossClaimed, getAdjustedClaimAmount(sender, id));
        // if no dispute period settle immediately
        if (disputeDuration == 0) {
            closeSettlement(sender, id);
        }
    }

    function disputeSettlement(bytes memory claimData, uint8[2] memory sigsV, bytes32[2] memory sigsR, bytes32[2] memory sigsS) public {
        (address sender, bytes32 id, uint256 disputeDuration) = verifySettlement(claimData, sigsV, sigsR, sigsS, true); 
        // minimum required duration between vest and void time
        uint256 oldAmount = getAdjustedClaimAmount(sender, id);
        reserves[sender].claims[id].push(SignedClaim(claimData, sigsV, sigsR, sigsS));
        reserves[sender].proposalTimestamps[id][1] = now;
        uint256 newAmount = getAdjustedClaimAmount(sender, id);
        reserves[sender].grossClaimed = SafeMath.sub(reserves[sender].grossClaimed, oldAmount);
        reserves[sender].grossClaimed = SafeMath.add(reserves[sender].grossClaimed, newAmount);
        if (disputeDuration == 0) {
            closeSettlement(sender, id);
        }
    }
    
    function redeemClaim(address accountOwner, bytes32 claimID) public {
        require(reserves[accountOwner].settlements[claimID].settled == false);
        require(reserves[accountOwner].proposalTimestamps[claimID][1] > 0);
        require(reserves[accountOwner].claims[claimID].length > 0);
        uint256 index = reserves[accountOwner].claims[claimID].length - 1;
        (uint256[4] memory values, address[2] memory addrs, bytes32[3] memory ids, uint8 nonce) = abi.decode(reserves[accountOwner].claims[claimID][index].claimData, (uint256[4], address[2], bytes32[3], uint8));
        Claim memory claim = Claim(ids[0], address(addrs[0]), address(addrs[1]), ids[1], nonce, values[0], values[1], values[2], values[3], ids[2]);
        require(SafeMath.add(reserves[accountOwner].proposalTimestamps[claimID][1], claim.disputeDuration) < now);
        require(claim.amount > 0);
        closeSettlement(accountOwner, claimID);
    }
    
    function proposeLoop(bytes32 proposalName, address[] memory loop, uint256 minFlow, uint256 lockTimestamp) public {
        require(loop.length >= 2);
        bytes32 id = CashlessLib.getLoopID(proposalName, loop);
        bytes32 nil;
        require(loops[id].proposalName == nil);
        loops[id].proposalName = proposalName;
        loops[id].loop = loop;
        loops[id].lockTimestamp = lockTimestamp;
        loops[id].minFlow = minFlow;
    }
    
    function commitLoopClaim(bytes32 loopID, bytes memory encodedPriorClaim, bytes memory encodedClaim) public {
        (address sender, address receiver) = verifyLoopClaim(loopID, encodedPriorClaim, encodedClaim);
        bool found = false;
        for (uint256 i=0; i<loops[loopID].loop.length; i++) {
            if (loops[loopID].loop[i] == sender) {
                if (i==loops[loopID].loop.length-1) {
                    require(loops[loopID].loop[0]==receiver);
                } else {
                    require(loops[loopID].loop[i+1]==receiver);
                }
                found = true;
                break;
            }
        }
        require(found==true);
        for (uint256 j=0; j<loops[loopID].committed.length; j++) {
            require(loops[loopID].committed[j]!=sender);
        }
        (bytes memory claimData2, uint8[2] memory v2, bytes32[2] memory r2, bytes32[2] memory s2) = abi.decode(encodedClaim, (bytes, uint8[2], bytes32[2], bytes32[2]));
        loops[loopID].claims[sender] = SignedClaim(claimData2, v2, r2, s2);
        loops[loopID].committed.push(sender);
    }
    
    // Internal (Protected) State Modifying functions
    function verifySettlement(bytes memory claimData, uint8[2] memory sigsV, bytes32[2] memory sigsR, bytes32[2] memory sigsS, bool isDispute) internal view returns (address, bytes32, uint256) {
        (uint256[4] memory values, address[2] memory addrs, bytes32[3] memory ids, uint8 nonce) = abi.decode(claimData, (uint256[4], address[2], bytes32[3], uint8));
        Claim memory claim = Claim(ids[0], address(addrs[0]), address(addrs[1]), ids[1], nonce, values[0], values[1], values[2], values[3], ids[2]);
        require(reserves[claim.sender].owner == claim.sender);
        bytes32 id;
        if (claim.loopID != id) {
            require(loops[claim.loopID].committed.length > 0);
            require(loops[claim.loopID].committed.length == loops[claim.loopID].loop.length);
        }
        require(claim.nonce > 0);
        // minimum required duration between vest and void time
        require(SafeMath.sub(claim.voidTimestamp, claim.vestTimestamp) >= minVestDuration);
        require(now > claim.vestTimestamp);
        id = CashlessLib.getClaimID(claim.claimName, claim.sender, claim.receiver, claim.receiverAlias);
        if (isDispute) {
            require(reserves[claim.sender].claims[id].length > 0);
            uint256 lastIndex = reserves[claim.sender].claims[id].length - 1;
            (values, addrs, ids, nonce) = abi.decode(reserves[claim.sender].claims[id][lastIndex].claimData, (uint256[4], address[2], bytes32[3], uint8));
            Claim memory priorClaim = Claim(ids[0], address(addrs[0]), address(addrs[1]), ids[1], nonce, values[0], values[1], values[2], values[3], ids[2]);
            require(SafeMath.add(reserves[claim.sender].proposalTimestamps[id][1], priorClaim.disputeDuration) > now);
            require(claim.nonce > priorClaim.nonce);
        } else {
            for (uint256 i=0; i<reserves[claim.sender].claimIDs.length; i++) {
                require(reserves[claim.sender].claimIDs[i] != id);
            }
            require(now < claim.voidTimestamp);
            require(claim.amount > 0);  
        }
        require(verifyClaimSig(claimData, sigsV[0], sigsR[0], sigsS[0], true));
        require(verifyClaimSig(claimData, sigsV[1], sigsR[1], sigsS[1], false));
        require(reserves[claim.sender].settlements[id].settled == false);
        return (claim.sender, id, claim.disputeDuration);
    }
    
    function closeSettlement(address accountOwner, bytes32 claimID) internal {
        require(reserves[accountOwner].claims[claimID].length > 0);
        uint256 lastIndex = reserves[accountOwner].claims[claimID].length - 1;
        (uint256[4] memory values, address[2] memory addrs, bytes32[3] memory ids, uint8 nonce) = abi.decode(reserves[accountOwner].claims[claimID][lastIndex].claimData, (uint256[4], address[2], bytes32[3], uint8));
        Claim memory claim = Claim(ids[0], address(addrs[0]), address(addrs[1]), ids[1], nonce, values[0], values[1], values[2], values[3], ids[2]);
        uint256 amount = getAdjustedClaimAmount(accountOwner, claimID);
        reserves[claim.sender].grossClaimed = SafeMath.sub(reserves[claim.sender].grossClaimed, amount);
        address receiver;
        if (address(claim.receiver) == address(0)) {
            receiver = aliases[claim.receiverAlias];
        } else {
            receiver = claim.receiver;
        }
        if (reserves[claim.sender].balance >= amount) {
            reserves[claim.sender].settlements[claimID] = Settlement(amount, 0, true);
            reserves[claim.sender].grossPaid = SafeMath.add(reserves[claim.sender].grossPaid, amount);
            reserves[claim.sender].balance = SafeMath.sub(reserves[claim.sender].balance, amount);
            reserves[receiver].balance = SafeMath.add(reserves[receiver].balance, amount);
        } else {
            if (reserves[claim.sender].balance > 0) {
                uint256 defaultAmount = SafeMath.sub(amount, reserves[claim.sender].balance);
                reserves[claim.sender].settlements[claimID] = Settlement(reserves[claim.sender].balance, defaultAmount, true);
                reserves[claim.sender].grossPaid = SafeMath.add(reserves[claim.sender].grossPaid, reserves[claim.sender].balance);
                reserves[claim.sender].grossDefaulted = SafeMath.add(reserves[claim.sender].grossDefaulted, defaultAmount);
                reserves[receiver].balance = SafeMath.add(reserves[receiver].balance, reserves[claim.sender].balance);
                reserves[claim.sender].balance = 0;
            } else {
                reserves[claim.sender].settlements[claimID] = Settlement(0, amount, true);
                reserves[claim.sender].grossDefaulted = SafeMath.add(reserves[claim.sender].grossDefaulted, amount);
            }
        }
    }
    
    function verifyLoopClaim(bytes32 loopID, bytes memory encodedPriorClaim, bytes memory encodedClaim) internal view returns (address, address) {
        require(now < loops[loopID].lockTimestamp);
        (bytes memory claimData1, uint8[2] memory v1, bytes32[2] memory r1, bytes32[2] memory s1) = abi.decode(encodedPriorClaim, (bytes, uint8[2], bytes32[2], bytes32[2]));
        (bytes memory claimData2, uint8[2] memory v2, bytes32[2] memory r2, bytes32[2] memory s2) = abi.decode(encodedClaim, (bytes, uint8[2], bytes32[2], bytes32[2]));
        require(verifyClaimSig(claimData1, v1[0], r1[0], s1[0], true));
        require(verifyClaimSig(claimData1, v1[1], r1[1], s1[1], false));
        require(verifyClaimSig(claimData2, v2[0], r2[0], s2[0], true));
        require(verifyClaimSig(claimData2, v2[1], r2[1], s2[1], false));
        return validateLoopClaim(claimData1, claimData2, loopID);
    }
    
    function validateLoopClaim(bytes memory priorClaimData, bytes memory claimData, bytes32 loopID) internal  view  returns (address, address) {
        (uint256[4] memory values, address[2] memory addrs, bytes32[3] memory ids, uint8 nonce) = abi.decode(priorClaimData, (uint256[4], address[2], bytes32[3], uint8));
        Claim memory oldClaim = Claim(ids[0], address(addrs[0]), address(addrs[1]), ids[1], nonce, values[0], values[1], values[2], values[3], ids[2]);
        (values, addrs, ids, nonce) = abi.decode(claimData, (uint256[4], address[2], bytes32[3], uint8));
        Claim memory newClaim = Claim(ids[0], address(addrs[0]), address(addrs[1]), ids[1], nonce, values[0], values[1], values[2], values[3], ids[2]);
        require(newClaim.loopID==loopID);
        require(oldClaim.loopID!=loopID);
        require(newClaim.nonce==oldClaim.nonce+1);
        require(oldClaim.claimName==newClaim.claimName);
        require(oldClaim.sender==newClaim.sender);
        require(oldClaim.receiver==newClaim.receiver);
        require(oldClaim.receiverAlias==newClaim.receiverAlias);
        require(loops[loopID].minFlow > 0);
        require(SafeMath.sub(oldClaim.amount, newClaim.amount) == loops[loopID].minFlow);
        address receiver;
        if (oldClaim.receiver == receiver) {
            receiver = aliases[oldClaim.receiverAlias];
        } else {
            receiver = oldClaim.receiver;
        }
        return (oldClaim.sender, receiver);
    }
    
    // Public View/Pure functions
    function verifyClaimSig(bytes memory claimData, uint8 v, bytes32 r, bytes32 s, bool isOwner) public view returns (bool) {
        (uint256[4] memory values, address[2] memory addrs, bytes32[3] memory ids, uint8 nonce) = abi.decode(claimData, (uint256[4], address[2], bytes32[3], uint8));
        Claim memory claim = Claim(ids[0], address(addrs[0]), address(addrs[1]), ids[1], nonce, values[0], values[1], values[2], values[3], ids[2]);
        if (0 >= claim.nonce) {
            return false;
        }
        if (SafeMath.sub(claim.voidTimestamp, claim.vestTimestamp) < minVestDuration) {
            return false;
        }
        bytes32 hash = CashlessLib.hashClaimData(claimData, DOMAIN_SEPARATOR);
        address signer;
        if (isOwner) {
            signer = claim.sender;
        } else {
            if (address(0) != address(claim.receiver)) {
                signer = claim.receiver;
            } else {
                signer = aliases[claim.receiverAlias];
            }
        }
        if (ecrecover(hash, v, r, s) != signer) {
            return false;
        }
        return true;
    }
    
    function getAdjustedClaimAmount(address accountOwner, bytes32 claimID) public view returns (uint256) {
        require(reserves[accountOwner].claims[claimID].length > 0);
        uint256 lastIndex = reserves[accountOwner].claims[claimID].length - 1;
        (uint256[4] memory values, address[2] memory addrs, bytes32[3] memory ids, uint8 nonce) = abi.decode(reserves[accountOwner].claims[claimID][lastIndex].claimData, (uint256[4], address[2], bytes32[3], uint8));
        Claim memory claim = Claim(ids[0], address(addrs[0]), address(addrs[1]), ids[1], nonce, values[0], values[1], values[2], values[3], ids[2]);
        uint256 numerator = SafeMath.mul(100, SafeMath.sub(reserves[accountOwner].proposalTimestamps[claimID][0], claim.vestTimestamp));
        uint256 denominator = SafeMath.sub(claim.voidTimestamp, claim.vestTimestamp);
        uint256 percentLost = SafeMath.div(numerator, denominator);
        return SafeMath.div(SafeMath.sub(SafeMath.mul(100, claim.amount), SafeMath.mul(percentLost, claim.amount)), 100);
    }

    function getClaimIDs(address accountOwner) public view returns (bytes32[] memory) {
        return reserves[accountOwner].claimIDs;
    }
    
    function getReservesClaim(address accountOwner, bytes32 claimID, uint256 index) public view returns (bytes memory) {
        return reserves[accountOwner].claims[claimID][index].claimData;
    }

    function getReservesSettlement(address accountOwner, bytes32 claimID) public view returns (uint256, uint256, bool) {
        return (reserves[accountOwner].settlements[claimID].amountPaid, reserves[accountOwner].settlements[claimID].amountDefaulted, reserves[accountOwner].settlements[claimID].settled);
    }
    
    function getLoopStatus(bytes32 loopID) public view returns (address[] memory, address[] memory) {
        return (loops[loopID].loop, loops[loopID].committed);
    }

    // Fallback Funtion
    function () external {}
}