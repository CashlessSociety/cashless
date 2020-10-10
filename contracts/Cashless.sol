pragma solidity ^0.6.0;
import "./CashlessLib.sol";
import "./../node_modules/@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "./../node_modules/@openzeppelin/contracts/math/SafeMath.sol";

contract Cashless is IERC20 {
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
    
    struct ClaimHistory {
        bytes32[] claimIDs;
        mapping (bytes32 => bytes[]) claims;
        mapping (bytes32 => uint256) proposalTimestamp;
        mapping (bytes32 => Settlement) settlements;
    }
    
    uint256 public minVestDuration = 604800;
    address public redeemableTokenAddress;
    mapping (address => ClaimHistory) private history;
    mapping (bytes32 => LoopProposal) public loops;
    mapping (address => uint256) private _balances;
    mapping (address => mapping (address => uint256)) private _allowances;
    uint256 private _totalSupply;
    string private _name;
    string private _symbol;
    uint8 private _decimals;

    constructor (bytes32 salt, address _redeemableTokenAddress) public {
        _name = "Reserve USD Coin";
        _symbol = "RESERVE";
        _decimals = 6;
        DOMAIN_SEPARATOR = keccak256(abi.encodePacked(EIP712HASH, this, salt));
        redeemableTokenAddress = _redeemableTokenAddress;
    }
    
    function fund(address collectingAccount, uint256 amount) public {
        require(IERC20(redeemableTokenAddress).transferFrom(msg.sender, address(this), amount));
        _mint(collectingAccount, amount);
    }
    
    function redeem(uint256 amount, address targetReceiver) public {
        require(amount>0);
        require(IERC20(redeemableTokenAddress).transfer(targetReceiver, amount));
        _burn(msg.sender, amount);
    }
    
    function proposeSettlement(bytes memory claimData, uint8[2] memory sigsV, bytes32[2] memory sigsR, bytes32[2] memory sigsS) public {
        (address sender, bytes32 id, uint256 disputeDuration) = verifySettlement(claimData, sigsV, sigsR, sigsS, false); 
        history[sender].claimIDs.push(id);
        history[sender].claims[id].push(claimData);
        history[sender].proposalTimestamp[id] = now;
        // if no dispute period settle immediately
        if (disputeDuration == 0) {
            closeSettlement(sender, id);
        }
    }

    function disputeSettlement(bytes memory claimData, uint8[2] memory sigsV, bytes32[2] memory sigsR, bytes32[2] memory sigsS) public {
        (address sender, bytes32 id, uint256 disputeDuration) = verifySettlement(claimData, sigsV, sigsR, sigsS, true); 
        // minimum required duration between vest and void time
        history[sender].claims[id].push(claimData);
        history[sender].proposalTimestamp[id] = now;
        if (disputeDuration == 0) {
            closeSettlement(sender, id);
        }
    }
    
    function commitSettlement(address accountOwner, bytes32 claimID) public {
        require(history[accountOwner].settlements[claimID].settled == false);
        require(history[accountOwner].proposalTimestamp[claimID] > 0);
        require(history[accountOwner].claims[claimID].length > 0);
        uint256 index = history[accountOwner].claims[claimID].length - 1;
        (uint256[4] memory values, address[2] memory addrs, bytes32[2] memory ids, uint8 nonce) = abi.decode(history[accountOwner].claims[claimID][index], (uint256[4], address[2], bytes32[2], uint8));
        Claim memory claim = Claim(ids[0], address(addrs[0]), address(addrs[1]), nonce, values[0], values[1], values[2], values[3], ids[1]);
        require(history[accountOwner].proposalTimestamp[claimID].add(claim.disputeDuration) < now);
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
            require(history[claim.sender].claims[id].length > 0);
            uint256 lastIndex = history[claim.sender].claims[id].length - 1;
            (values, addrs, ids, nonce) = abi.decode(history[claim.sender].claims[id][lastIndex], (uint256[4], address[2], bytes32[2], uint8));
            Claim memory priorClaim = Claim(ids[0], address(addrs[0]), address(addrs[1]), nonce, values[0], values[1], values[2], values[3], ids[1]);
            require(history[claim.sender].proposalTimestamp[id].add(priorClaim.disputeDuration) > now);
            require(claim.nonce > priorClaim.nonce);
        } else {
            for (uint256 i=0; i<history[claim.sender].claimIDs.length; i++) {
                require(history[claim.sender].claimIDs[i] != id);
            }
            require(now < claim.voidTimestamp);
            require(claim.amount > 0); 
        }
        require(verifyClaimSig(claimData, sigsV[0], sigsR[0], sigsS[0], true));
        require(verifyClaimSig(claimData, sigsV[1], sigsR[1], sigsS[1], false));
        require(history[claim.sender].settlements[id].settled == false);
        return (claim.sender, id, claim.disputeDuration);
    }
    
    function closeSettlement(address accountOwner, bytes32 claimID) internal {
        require(history[accountOwner].claims[claimID].length > 0);
        uint256 lastIndex = history[accountOwner].claims[claimID].length - 1;
        (uint256[4] memory values, address[2] memory addrs, bytes32[2] memory ids, uint8 nonce) = abi.decode(history[accountOwner].claims[claimID][lastIndex], (uint256[4], address[2], bytes32[2], uint8));
        Claim memory claim = Claim(ids[0], address(addrs[0]), address(addrs[1]), nonce, values[0], values[1], values[2], values[3], ids[1]);
        if (_balances[claim.sender] >= claim.amount) {
            history[claim.sender].settlements[claimID] = Settlement(claim.amount, 0, true);
            _transfer(claim.sender, claim.receiver, claim.amount);
        } else {
            if (_balances[claim.sender] > 0) {
                uint256 defaultAmount = claim.amount.sub(_balances[claim.sender]);
                history[claim.sender].settlements[claimID] = Settlement(_balances[claim.sender], defaultAmount, true);
                _transfer(claim.sender, claim.receiver, _balances[claim.sender]);
            } else {
                history[claim.sender].settlements[claimID] = Settlement(0, claim.amount, true);
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
        bytes32 hash = CashlessLib.messageHash(CashlessLib.hashClaimData(claimData, DOMAIN_SEPARATOR));
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
        return history[accountOwner].claimIDs;
    }
    
    function getClaim(address accountOwner, bytes32 claimID, uint256 index) public view returns (bytes memory) {
        return history[accountOwner].claims[claimID][index];
    }

    function getSettlement(address accountOwner, bytes32 claimID) public view returns (uint256, uint256, bool) {
        return (history[accountOwner].settlements[claimID].amountPaid, history[accountOwner].settlements[claimID].amountDefaulted, history[accountOwner].settlements[claimID].settled);
    }
    
    function getLoopStatus(bytes32 loopID) public view returns (address[] memory, address[] memory) {
        return (loops[loopID].loop, loops[loopID].committed);
    }

    function name() public view returns (string memory) {
        return _name;
    }

    function symbol() public view returns (string memory) {
        return _symbol;
    }

    function decimals() public view returns (uint8) {
        return _decimals;
    }

    function totalSupply() public view override returns (uint256) {
        return _totalSupply;
    }

    function balanceOf(address account) public view override returns (uint256) {
        return _balances[account];
    }

    function transfer(address recipient, uint256 amount) public override returns (bool) {
        _transfer(msg.sender, recipient, amount);
        return true;
    }

    function allowance(address owner, address spender) public view override returns (uint256) {
        return _allowances[owner][spender];
    }

    function approve(address spender, uint256 amount) public override returns (bool) {
        _approve(msg.sender, spender, amount);
        return true;
    }

    function transferFrom(address sender, address recipient, uint256 amount) public override returns (bool) {
        _transfer(sender, recipient, amount);
        _approve(sender, msg.sender, _allowances[sender][msg.sender].sub(amount, "ERC20: transfer amount exceeds allowance"));
        return true;
    }

    function increaseAllowance(address spender, uint256 addedValue) public returns (bool) {
        _approve(msg.sender, spender, _allowances[msg.sender][spender].add(addedValue));
        return true;
    }

    function decreaseAllowance(address spender, uint256 subtractedValue) public returns (bool) {
        _approve(msg.sender, spender, _allowances[msg.sender][spender].sub(subtractedValue, "ERC20: decreased allowance below zero"));
        return true;
    }

    function _transfer(address sender, address recipient, uint256 amount) internal {
        require(sender != address(0), "ERC20: transfer from the zero address");
        require(recipient != address(0), "ERC20: transfer to the zero address");

        _balances[sender] = _balances[sender].sub(amount, "ERC20: transfer amount exceeds balance");
        _balances[recipient] = _balances[recipient].add(amount);
        emit Transfer(sender, recipient, amount);
    }

    function _mint(address account, uint256 amount) internal {
        require(account != address(0), "ERC20: mint to the zero address");

        _totalSupply = _totalSupply.add(amount);
        _balances[account] = _balances[account].add(amount);
        emit Transfer(address(0), account, amount);
    }

    function _burn(address account, uint256 amount) internal {
        require(account != address(0), "ERC20: burn from the zero address");

        _balances[account] = _balances[account].sub(amount, "ERC20: burn amount exceeds balance");
        _totalSupply = _totalSupply.sub(amount);
        emit Transfer(account, address(0), amount);
    }

    function _approve(address owner, address spender, uint256 amount) internal  {
        require(owner != address(0), "ERC20: approve from the zero address");
        require(spender != address(0), "ERC20: approve to the zero address");

        _allowances[owner][spender] = amount;
        emit Approval(owner, spender, amount);
    }

    function _setupDecimals(uint8 decimals_) internal {
        _decimals = decimals_;
    }

    // Fallback Funtion
    fallback () external {}
}