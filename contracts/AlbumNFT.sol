pragma solidity ^0.8.19;

//"SPDX-License-Identifier: UNLICENSED
import "@openzeppelin/contracts/token/ERC721/ERC721.sol";

contract TrackNFT is ERC721 {
    constructor (string memory _name, string memory _symbol) ERC721(_name, _symbol) {
    }

    function mint(address _to, uint _tokenId) external{
        super._mint(_to, _tokenId);
    }

}


