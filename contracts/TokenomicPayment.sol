// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
 import "hardhat/console.sol";


contract TokenomicPayment {
    address public owner;
    
    struct Claim {
        uint256 amount;
        uint256 date;
        bool claimed;
    }

    struct Account {
        address user;
        bool authorized;
    }
    
    struct Tokenomic {
        uint256 balance;
        address token;
        bool paused;
    }

    struct AccountInterface {
        address user;
        uint256[] amounts;
        uint256[] claimDates;
        bool authorized;
    }
    
    mapping (address => Tokenomic) public tokenomics;
    mapping (address => mapping (address => Account)) authorizedAccounts;
    mapping (address => mapping (address => Claim[])) claims;
    
    constructor() {
        owner = msg.sender;
    }
    
    function create(Tokenomic memory _tokenomic, AccountInterface[] memory _accounts) public {
        require(!exists(msg.sender), "There is an existent tokenomic. Please withdraw the tokens before");
        require(_accounts.length > 0, "Tokenomic: authorized accounts must not be empty");
        require(_tokenomic.balance > 0, "Tokenomic: balance must be greater than zero");
        require(_tokenomic.token != address(0), "Tokenomic: token address must be valid");
        for (uint i = 0; i < _accounts.length; i++) {
            AccountInterface memory accountParam = _accounts[i];
            authorizedAccounts[msg.sender][_accounts[i].user] = Account(accountParam.user, true);
            for(uint j = 0; j < accountParam.amounts.length; j++){
                claims[msg.sender][accountParam.user].push(Claim(accountParam.amounts[j], accountParam.claimDates[j], false));
            }
        }
        tokenomics[msg.sender] = _tokenomic;
        ERC20(_tokenomic.token).transferFrom(msg.sender, address(this), _tokenomic.balance);
    }

    function pause() public {
        tokenomics[msg.sender].paused = true;
    }

    function unpause() public {
        tokenomics[msg.sender].paused = false;
    }
    
    function modify(Tokenomic memory _tokenomic, AccountInterface[] memory _accounts) public {
        Tokenomic storage tokenomicToModify = tokenomics[msg.sender];
        require(tokenomicToModify.balance > 0, "Tokenomic: tokenomic does not exist");
        require(_tokenomic.balance + tokenomicToModify.balance > 0, "Tokenomic: balance must be greater than zero");

        tokenomicToModify.balance += _tokenomic.balance;
        for (uint i = 0; i < _accounts.length; i++) {
            AccountInterface memory accountParam = _accounts[i];
            authorizedAccounts[msg.sender][_accounts[i].user] = Account(accountParam.user, accountParam.authorized);
            for(uint j = 0; j < accountParam.amounts.length; j++){
                claims[msg.sender][accountParam.user].push(Claim(accountParam.amounts[j], accountParam.claimDates[j], false));
            }
        }
        ERC20(_tokenomic.token).transferFrom(msg.sender, address(this), _tokenomic.balance);
    }
    
    function claim(address _tokenomic) public {
        require(exists(_tokenomic), "Tokenomic: tokenomic does not exist");
        require(!tokenomics[_tokenomic].paused, "Tokenomic: tokenomic is paused");
        Tokenomic storage tokenomic = tokenomics[_tokenomic];
        
        require(account(_tokenomic, msg.sender).authorized, "Tokenomic: account is not authorized");
        uint256 amountToClaim = claimableAmount(_tokenomic);
        require(amountToClaim > 0, "Tokenomic: cannot claim tokens before the allowed time");
        require(tokenomics[_tokenomic].balance >= amountToClaim, "Not enough tokens in tokenomic");
        for (uint i = 0; i < claims[_tokenomic][msg.sender].length; i++) {
            if(claims[_tokenomic][msg.sender][i].date <= block.timestamp && !claims[_tokenomic][msg.sender][i].claimed){
                claims[_tokenomic][msg.sender][i].claimed = true;
            }
        }
        ERC20(tokenomic.token).transfer(msg.sender, amountToClaim);
    }

    function isAuthorized(address _tokenomic, address _user) public view returns (bool) {
        return (account(_tokenomic, _user).authorized);
    }

    function claimableAmount(address _tokenomic) public view returns (uint256) {
        uint256 amountToClaim = 0;
        Claim[] memory _claims = claims[_tokenomic][msg.sender];
        for(uint i = 0; i < _claims.length; i++){
            if(_claims[i].date <= block.timestamp && !_claims[i].claimed){
                amountToClaim += _claims[i].amount;
            }
        }
        return amountToClaim;
    }

    function balance(address _tokenomic) public view returns (uint256) {
        require(exists(_tokenomic), "Tokenomic does not exist");

        return tokenomics[_tokenomic].balance;
    }

    function exists(address _tokenomic) private view returns (bool) {
        Tokenomic storage tokenomic = tokenomics[_tokenomic];
        return tokenomic.token != address(0);
    }

    function account(address _tokenomic, address _user) private view returns (Account memory) {
        return  authorizedAccounts[_tokenomic][_user];
    }
}
