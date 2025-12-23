// SPDX-License-Identifier: BSD-3-Clause-Clear
pragma solidity ^0.8.27;

import {ERC7984} from "@openzeppelin/confidential-contracts/token/ERC7984/ERC7984.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {ZamaEthereumConfig} from "@fhevm/solidity/config/ZamaConfig.sol";
import {FHE, euint64} from "@fhevm/solidity/lib/FHE.sol";

contract TestToken is ERC7984, Ownable, ZamaEthereumConfig {
    error NotMinter(address caller);

    address public minter;

    constructor() ERC7984("TEST", "TEST", "") Ownable(msg.sender) {
        minter = msg.sender;
    }

    function decimals() public view virtual override returns (uint8) {
        return 0;
    }

    function setMinter(address newMinter) external onlyOwner {
        minter = newMinter;
    }

    function mintFromMinter(address to, euint64 amount) external returns (euint64 transferred) {
        if (msg.sender != minter) revert NotMinter(msg.sender);
        transferred = _mint(to, amount);
        FHE.allowTransient(transferred, msg.sender);
    }
}
