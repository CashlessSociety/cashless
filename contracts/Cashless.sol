pragma solidity ^0.6.0;
import "./CashlessLib.sol";
import "./../node_modules/@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "./../node_modules/@openzeppelin/contracts/math/SafeMath.sol";

contract Cashless {
    using SafeMath for uint256;

    // Precomputed hash for EIP712 domain separator
    bytes32 constant EIP712HASH = 0x0eff6c88c44fbde2113ba7421deef795c18fc5a553a55b2ba4d237269e1c2662;
    
    // Domain separator completed on contract construction
    bytes32 public DOMAIN_SEPARATOR;
    
    // Claim
    struct Claim {
        bytes32 claimName;
        address sender;
        address receiver;
        uint8 nonce;
        uint256 amount;
        uint256 disputeDuration;
        uint256 vestTimestamp;
        uint256 voidTimestamp;
        bytes32 loopID;
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
        address[] committed;
    }
    
    // Reserves
    struct Reserves {
        uint256 balance;
        bytes32[] claimIDs;
        mapping (bytes32 => bytes[]) claims;
        mapping (bytes32 => uint256) proposalTimestamp;
        mapping (bytes32 => Settlement) settlements;
    }
    
    uint256 public minVestDuration = 604800;
    address public tokenAddress;
    mapping (address => Reserves) public reserves;
    mapping (bytes32 => LoopProposal) public loops;

    // Constructor function
    constructor (bytes32 salt, address _tokenAddress) public {
        DOMAIN_SEPARATOR = keccak256(abi.encodePacked(EIP712HASH, this, salt));
        tokenAddress = _tokenAddress;
    }
    
    function fundReserves(address accountOwner, uint256 amount) public {
        reserves[accountOwner].balance = reserves[accountOwner].balance.add(amount);
        require(IERC20(tokenAddress).transferFrom(msg.sender, address(this), amount));
    }
    
    function withdrawReserves(uint256 amount, address targetReceiver) public {
        require(amount>0);
        require(reserves[msg.sender].balance >= amount);
        reserves[msg.sender].balance = reserves[msg.sender].balance.sub(amount);
        require(IERC20(tokenAddress).transfer(targetReceiver, amount));
    }
    
    function proposeSettlement(bytes memory claimData, uint8[2] memory sigsV, bytes32[2] memory sigsR, bytes32[2] memory sigsS) public {
        (address sender, bytes32 id, uint256 disputeDuration) = verifySettlement(claimData, sigsV, sigsR, sigsS, false); 
        reserves[sender].claimIDs.push(id);
        reserves[sender].claims[id].push(claimData);
        reserves[sender].proposalTimestamp[id] = now;
        // if no dispute period settle immediately
        if (disputeDuration == 0) {
            closeSettlement(sender, id);
        }
    }

    function disputeSettlement(bytes memory claimData, uint8[2] memory sigsV, bytes32[2] memory sigsR, bytes32[2] memory sigsS) public {
        (address sender, bytes32 id, uint256 disputeDuration) = verifySettlement(claimData, sigsV, sigsR, sigsS, true); 
        // minimum required duration between vest and void time
        reserves[sender].claims[id].push(claimData);
        reserves[sender].proposalTimestamp[id] = now;
        if (disputeDuration == 0) {
            closeSettlement(sender, id);
        }
    }
    
    function redeemClaim(address accountOwner, bytes32 claimID) public {
        require(reserves[accountOwner].settlements[claimID].settled == false);
        require(reserves[accountOwner].proposalTimestamp[claimID] > 0);
        require(reserves[accountOwner].claims[claimID].length > 0);
        uint256 index = reserves[accountOwner].claims[claimID].length - 1;
        (uint256[4] memory values, address[2] memory addrs, bytes32[2] memory ids, uint8 nonce) = abi.decode(reserves[accountOwner].claims[claimID][index], (uint256[4], address[2], bytes32[2], uint8));
        Claim memory claim = Claim(ids[0], address(addrs[0]), address(addrs[1]), nonce, values[0], values[1], values[2], values[3], ids[1]);
        require(reserves[accountOwner].proposalTimestamp[claimID].add(claim.disputeDuration) < now);
        require(claim.amount > 0);
        closeSettlement(accountOwner, claimID);
    }
    
    function proposeLoop(bytes32 proposalName, address[] memory loop, uint256 minFlow) public {
        require(loop.length >= 2);
        bytes32 id = CashlessLib.getLoopID(proposalName, loop);
        bytes32 nil;
        require(loops[id].proposalName == nil);
        loops[id].proposalName = proposalName;
        loops[id].loop = loop;
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
        loops[loopID].committed.push(sender);
    }
    
    // Internal (Protected) functions
    function verifySettlement(bytes memory claimData, uint8[2] memory sigsV, bytes32[2] memory sigsR, bytes32[2] memory sigsS, bool isDispute) internal view returns (address, bytes32, uint256) {
        (uint256[4] memory values, address[2] memory addrs, bytes32[2] memory ids, uint8 nonce) = abi.decode(claimData, (uint256[4], address[2], bytes32[2], uint8));
        Claim memory claim = Claim(ids[0], address(addrs[0]), address(addrs[1]), nonce, values[0], values[1], values[2], values[3], ids[1]);
        bytes32 id;
        if (claim.loopID != id) {
            require(loops[claim.loopID].committed.length > 0);
            require(loops[claim.loopID].committed.length == loops[claim.loopID].loop.length);
        }
        require(claim.nonce > 0);
        // minimum required duration between vest and void time
        require(claim.voidTimestamp.sub(claim.vestTimestamp) >= minVestDuration);
        require(now > claim.vestTimestamp);
        id = CashlessLib.getClaimID(claim.claimName, claim.sender, claim.receiver);
        if (isDispute) {
            require(reserves[claim.sender].claims[id].length > 0);
            uint256 lastIndex = reserves[claim.sender].claims[id].length - 1;
            (values, addrs, ids, nonce) = abi.decode(reserves[claim.sender].claims[id][lastIndex], (uint256[4], address[2], bytes32[2], uint8));
            Claim memory priorClaim = Claim(ids[0], address(addrs[0]), address(addrs[1]), nonce, values[0], values[1], values[2], values[3], ids[1]);
            require(reserves[claim.sender].proposalTimestamp[id].add(priorClaim.disputeDuration) > now);
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
        (uint256[4] memory values, address[2] memory addrs, bytes32[2] memory ids, uint8 nonce) = abi.decode(reserves[accountOwner].claims[claimID][lastIndex], (uint256[4], address[2], bytes32[2], uint8));
        Claim memory claim = Claim(ids[0], address(addrs[0]), address(addrs[1]), nonce, values[0], values[1], values[2], values[3], ids[1]);
        if (reserves[claim.sender].balance >= claim.amount) {
            reserves[claim.sender].settlements[claimID] = Settlement(claim.amount, 0, true);
            reserves[claim.sender].balance = reserves[claim.sender].balance.sub(claim.amount);
            reserves[claim.receiver].balance = reserves[claim.receiver].balance.add(claim.amount);
        } else {
            if (reserves[claim.sender].balance > 0) {
                uint256 defaultAmount = claim.amount.sub(reserves[claim.sender].balance);
                reserves[claim.sender].settlements[claimID] = Settlement(reserves[claim.sender].balance, defaultAmount, true);
                reserves[claim.receiver].balance = reserves[claim.receiver].balance.add(reserves[claim.sender].balance);
                reserves[claim.sender].balance = 0;
            } else {
                reserves[claim.sender].settlements[claimID] = Settlement(0, claim.amount, true);
            }
        }
    }
    
    function verifyLoopClaim(bytes32 loopID, bytes memory encodedPriorClaim, bytes memory encodedClaim) internal view returns (address, address) {
        (bytes memory claimData1, uint8[2] memory v1, bytes32[2] memory r1, bytes32[2] memory s1) = abi.decode(encodedPriorClaim, (bytes, uint8[2], bytes32[2], bytes32[2]));
        (bytes memory claimData2, uint8[2] memory v2, bytes32[2] memory r2, bytes32[2] memory s2) = abi.decode(encodedClaim, (bytes, uint8[2], bytes32[2], bytes32[2]));
        require(verifyClaimSig(claimData1, v1[0], r1[0], s1[0], true));
        require(verifyClaimSig(claimData1, v1[1], r1[1], s1[1], false));
        require(verifyClaimSig(claimData2, v2[0], r2[0], s2[0], true));
        require(verifyClaimSig(claimData2, v2[1], r2[1], s2[1], false));
        return validateLoopClaim(claimData1, claimData2, loopID);
    }
    
    function validateLoopClaim(bytes memory priorClaimData, bytes memory claimData, bytes32 loopID) internal  view  returns (address, address) {
        (uint256[4] memory values, address[2] memory addrs, bytes32[2] memory ids, uint8 nonce) = abi.decode(priorClaimData, (uint256[4], address[2], bytes32[2], uint8));
        Claim memory oldClaim = Claim(ids[0], address(addrs[0]), address(addrs[1]), nonce, values[0], values[1], values[2], values[3], ids[1]);
        (values, addrs, ids, nonce) = abi.decode(claimData, (uint256[4], address[2], bytes32[2], uint8));
        Claim memory newClaim = Claim(ids[0], address(addrs[0]), address(addrs[1]), nonce, values[0], values[1], values[2], values[3], ids[1]);
        require(newClaim.loopID==loopID);
        require(oldClaim.loopID!=loopID);
        require(newClaim.nonce==oldClaim.nonce+1);
        require(oldClaim.claimName==newClaim.claimName);
        require(oldClaim.sender==newClaim.sender);
        require(oldClaim.receiver==newClaim.receiver);
        require(loops[loopID].minFlow > 0);
        require(oldClaim.amount.sub(newClaim.amount) == loops[loopID].minFlow);
        return (oldClaim.sender, oldClaim.receiver);
    }
    
    // Public View/Pure functions
    function verifyClaimSig(bytes memory claimData, uint8 v, bytes32 r, bytes32 s, bool isOwner) public view returns (bool) {
        (uint256[4] memory values, address[2] memory addrs, bytes32[2] memory ids, uint8 nonce) = abi.decode(claimData, (uint256[4], address[2], bytes32[2], uint8));
        Claim memory claim = Claim(ids[0], address(addrs[0]), address(addrs[1]), nonce, values[0], values[1], values[2], values[3], ids[1]);
        if (0 >= claim.nonce) {
            return false;
        }
        if (claim.voidTimestamp.sub(claim.vestTimestamp) < minVestDuration) {
            return false;
        }
        bytes32 hash = CashlessLib.hashClaimData(claimData, DOMAIN_SEPARATOR);
        address signer;
        if (isOwner) {
            signer = claim.sender;
        } else {
            signer = claim.receiver;
        }
        if (ecrecover(hash, v, r, s) != signer) {
            return false;
        }
        return true;
    }

    function getClaimIDs(address accountOwner) public view returns (bytes32[] memory) {
        return reserves[accountOwner].claimIDs;
    }
    
    function getReservesClaim(address accountOwner, bytes32 claimID, uint256 index) public view returns (bytes memory) {
        return reserves[accountOwner].claims[claimID][index];
    }

    function getReservesSettlement(address accountOwner, bytes32 claimID) public view returns (uint256, uint256, bool) {
        return (reserves[accountOwner].settlements[claimID].amountPaid, reserves[accountOwner].settlements[claimID].amountDefaulted, reserves[accountOwner].settlements[claimID].settled);
    }
    
    function getLoopStatus(bytes32 loopID) public view returns (address[] memory, address[] memory) {
        return (loops[loopID].loop, loops[loopID].committed);
    }

    // Fallback Funtion
    fallback () external {}
}