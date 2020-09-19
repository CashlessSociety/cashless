pragma solidity ^0.6.0;

import "./../node_modules/@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract TestERC20 is ERC20 {
    constructor(uint256 initialSupply) public ERC20("Test", "TEST") {
        _mint(msg.sender, initialSupply);
    }
}