// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/Ownable.sol";

contract ZillobEscrow is Ownable {
    mapping(uint256 => uint256) public deposits;

    event Deposited(uint256 indexed listingId, address indexed from, uint256 amount);
    event Released(uint256 indexed listingId, address indexed to, uint256 amount);
    event Refunded(uint256 indexed listingId, address indexed to, uint256 amount);

    constructor(address _owner) Ownable(_owner) {}

    function deposit(uint256 listingId) external payable {
        require(msg.value > 0, "No value");
        deposits[listingId] += msg.value;
        emit Deposited(listingId, msg.sender, msg.value);
    }

    function release(uint256 listingId, address to) external onlyOwner {
        uint256 amount = deposits[listingId];
        require(amount > 0, "No funds");
        deposits[listingId] = 0;
        (bool ok, ) = payable(to).call{value: amount}("");
        require(ok, "Transfer failed");
        emit Released(listingId, to, amount);
    }

    function refund(uint256 listingId, address to) external onlyOwner {
        uint256 amount = deposits[listingId];
        require(amount > 0, "No funds");
        deposits[listingId] = 0;
        (bool ok, ) = payable(to).call{value: amount}("");
        require(ok, "Transfer failed");
        emit Refunded(listingId, to, amount);
    }
}
