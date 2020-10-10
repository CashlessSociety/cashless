pragma solidity ^0.6.0;

import "./../node_modules/@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract USDTest is ERC20 {
    constructor(uint256 initialSupply) public ERC20("Test USDC", "USDC") {
        _setupDecimals(6);
        _mint(msg.sender, initialSupply);
    }
}