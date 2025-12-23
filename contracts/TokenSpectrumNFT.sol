// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

import {ERC721} from "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import {ERC721Enumerable} from "@openzeppelin/contracts/token/ERC721/extensions/ERC721Enumerable.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

import {FHE, euint8, euint64} from "@fhevm/solidity/lib/FHE.sol";
import {ZamaEthereumConfig} from "@fhevm/solidity/config/ZamaConfig.sol";

interface ITestToken {
    function mintFromMinter(address to, euint64 amount) external returns (euint64 transferred);
}

contract TokenSpectrumNFT is ERC721Enumerable, Ownable, ZamaEthereumConfig {
    error AlreadyClaimed(uint256 tokenId);
    error NotTokenOwner(address caller, uint256 tokenId);

    event Minted(address indexed to, uint256 indexed tokenId, euint8 encryptedTest);
    event Claimed(address indexed to, uint256 indexed tokenId, euint64 encryptedAmount);

    ITestToken public immutable testToken;

    uint256 private _nextTokenId;
    mapping(uint256 tokenId => euint8) private _encryptedTestByTokenId;
    mapping(uint256 tokenId => bool) private _claimed;

    constructor(address testTokenAddress) ERC721("TokenSpectrum", "TSPEC") Ownable(msg.sender) {
        testToken = ITestToken(testTokenAddress);
        _nextTokenId = 1;
    }

    function mint() external returns (uint256 tokenId) {
        tokenId = _nextTokenId++;
        _safeMint(msg.sender, tokenId);

        euint8 encryptedTest = FHE.add(FHE.rem(FHE.randEuint8(), 100), FHE.asEuint8(1));
        _encryptedTestByTokenId[tokenId] = encryptedTest;

        FHE.allowThis(encryptedTest);
        FHE.allow(encryptedTest, msg.sender);

        emit Minted(msg.sender, tokenId, encryptedTest);
    }

    function isClaimed(uint256 tokenId) external view returns (bool) {
        return _claimed[tokenId];
    }

    function encryptedTestOf(uint256 tokenId) external view returns (euint8) {
        _requireOwned(tokenId);
        return _encryptedTestByTokenId[tokenId];
    }

    function claim(uint256 tokenId) external {
        if (ownerOf(tokenId) != msg.sender) revert NotTokenOwner(msg.sender, tokenId);
        if (_claimed[tokenId]) revert AlreadyClaimed(tokenId);
        _claimed[tokenId] = true;

        euint64 amount = FHE.asEuint64(_encryptedTestByTokenId[tokenId]);
        FHE.allowTransient(amount, address(testToken));

        euint64 transferred = testToken.mintFromMinter(msg.sender, amount);
        emit Claimed(msg.sender, tokenId, transferred);
    }

    function _update(address to, uint256 tokenId, address auth) internal virtual override returns (address from) {
        from = super._update(to, tokenId, auth);

        if (to != address(0)) {
            euint8 encryptedTest = _encryptedTestByTokenId[tokenId];
            if (FHE.isInitialized(encryptedTest)) {
                FHE.allow(encryptedTest, to);
            }
        }
    }
}
