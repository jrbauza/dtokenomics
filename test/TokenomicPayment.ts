import { ethers } from "hardhat";
import { expect } from "chai";
import { loadFixture, time } from "@nomicfoundation/hardhat-network-helpers";
import { TokenomicBuilder } from "./builders/TokenomicBuilder";
import { AuthorizedAccountBuilder } from "./builders/AuthorizedAccountBuilder";

describe("TokenomicPayment", function () {
  async function deployTokenomicFixture() {
    const [owner, tokenomicOwner, user1, user2] = await ethers.getSigners();
    const TokenomicPayment = await ethers.getContractFactory("TokenomicPayment");
    TokenomicPayment.connect(owner);
    const tokenomicContract = await TokenomicPayment.deploy();
    return { owner, user1, user2, tokenomicOwner, tokenomicContract };
  }

  async function itializeTokenBalancesFixture(tokenomicOwner : Promise<string>, amount: number = 100) {
    const mockERC20Factory = await ethers.getContractFactory("MockERC20");
    const token = await mockERC20Factory.deploy("Mock Token", "MOCK");
    token.transfer(tokenomicOwner, amount);
    return { token };
  }

  describe("createTokenomic()", function () {
    it("should create a new tokenomic with the correct parameters", async function () {
      const { user1, user2, tokenomicOwner, tokenomicContract } = await loadFixture(deployTokenomicFixture);
      const { token } = await itializeTokenBalancesFixture(tokenomicOwner.getAddress(), 100);

      await token.connect(tokenomicOwner).approve(tokenomicContract.address, 100);
      const authorizedAccounts = 
        AuthorizedAccountBuilder.new()
        .user(await user1.getAddress())
        .period(10, await now() + days(0))
        .addAccount()
        .user(await user2.getAddress())
        .period(20, await now() + days(0))
        .addAccount()
        .build()
  

      const tokenomic = TokenomicBuilder.new()
      .withBalance(100)
      .withToken(token.address)
      .build();

      await tokenomicContract.connect(tokenomicOwner).create(tokenomic, authorizedAccounts);

      expect(await token.balanceOf(tokenomicContract.address)).to.equal(100);

      expect(await tokenomicContract.connect(user1).isAuthorized(tokenomicOwner.getAddress(), user1.getAddress())).to.be.true;
      expect(await tokenomicContract.connect(user1).claimableAmount(tokenomicOwner.getAddress())).to.equal(10);

      expect(await tokenomicContract.connect(user2).isAuthorized(tokenomicOwner.address, user1.getAddress())).to.be.true;
      expect(await tokenomicContract.connect(user2).claimableAmount(tokenomicOwner.address)).to.equal(20);
    });

    it("should fail create a new tokenomic with zero balance", async function () {
      const {owner, tokenomicOwner, tokenomicContract, user1} = await loadFixture(deployTokenomicFixture);
      const { token } = await itializeTokenBalancesFixture(tokenomicOwner.getAddress(), 100);

      const tokenomic = TokenomicBuilder.new()
      .withBalance(0)
      .withToken(token.address)
      .build();

      const authorizedAccounts = 
        AuthorizedAccountBuilder.new()
        .user(await user1.getAddress())
        .period(10, await now() + days(0))
        .addAccount()
        .build()
      
      await token.connect(tokenomicOwner).approve(tokenomicContract.address, 100);
      await expect(tokenomicContract.connect(tokenomicOwner).create(tokenomic, authorizedAccounts)).to.be.revertedWith(
        "Tokenomic: balance must be greater than zero"
      );
    });

    it("should fail create a new tokenomic with zero authorized accounts", async function () {
      const {tokenomicOwner, tokenomicContract, user1} = await loadFixture(deployTokenomicFixture);
      const { token } = await itializeTokenBalancesFixture(tokenomicOwner.getAddress(), 100);

      const tokenomic = TokenomicBuilder.new()
      .withBalance(100)
      .withToken(token.address)
      .build();

      const authorizedAccounts = AuthorizedAccountBuilder.new().empty().build();
      
      await token.connect(tokenomicOwner).approve(tokenomicContract.address, 100);
      await expect(tokenomicContract.connect(tokenomicOwner).create(tokenomic, authorizedAccounts)).to.be.revertedWith(
        "Tokenomic: authorized accounts must not be empty"
      );
    });

    it("should create a tokenomic with one authorized account and a balance of 10 tokens", async function () {
      const {user1, tokenomicOwner, tokenomicContract } = await loadFixture(deployTokenomicFixture);
      const { token } = await itializeTokenBalancesFixture(tokenomicOwner.getAddress(), 100); 

      const authorizedAccounts = AuthorizedAccountBuilder.new()
        .user(await user1.getAddress())
        .period(10, await now() + days(1))
        .addAccount()
        .build();

      const tokenomic = TokenomicBuilder.new()
      .withBalance(10)
      .withToken(token.address)
      .build();

      await token.connect(tokenomicOwner).approve(tokenomicContract.address, 10);
      await tokenomicContract.connect(tokenomicOwner).create(tokenomic, authorizedAccounts);
      expect(await tokenomicContract.connect(user1).balance(tokenomicOwner.address)).to.equal(10);
      expect(await tokenomicContract.connect(user1).isAuthorized(tokenomicOwner.address, user1.getAddress())).to.be.true;
    });

    it("should create a tokenomic with three authorized accounts and a balance of 20 tokens", async function () {
      const {owner, tokenomicOwner, user1, user2, tokenomicContract } = await loadFixture(deployTokenomicFixture);
      const { token } = await itializeTokenBalancesFixture(tokenomicOwner.getAddress(), 100); 

      const authorizedAccounts = 
        AuthorizedAccountBuilder.new()
        .user(await user1.getAddress())
        .period(5, await now() + days(1))
        .addAccount()
        .user(await user2.getAddress())
        .period(10, await now() + days(1))
        .addAccount()
        .user(await owner.getAddress())
        .period(5, await now() + days(1))
        .addAccount()
        .build()

      const tokenomic = TokenomicBuilder.new()
      .withBalance(20)
      .withToken(token.address)
      .build();
      
      await token.connect(tokenomicOwner).approve(tokenomicContract.address, 20);
      await tokenomicContract.connect(tokenomicOwner).create(tokenomic, authorizedAccounts);

      expect(await token.balanceOf(tokenomicContract.address)).to.equal(20);
      expect(await tokenomicContract.isAuthorized(tokenomicOwner.getAddress(), user1.getAddress())).to.be.true;
      expect(await tokenomicContract.isAuthorized(tokenomicOwner.getAddress(), user2.getAddress())).to.be.true;
      expect(await tokenomicContract.isAuthorized(tokenomicOwner.getAddress(), owner.getAddress())).to.be.true;
    });
  });

  describe("modifyTokenomic()", function () {
    it("should fail to modify a nonexistent tokenomic", async function () {
      const { tokenomicContract, tokenomicOwner } = await loadFixture(deployTokenomicFixture);
      const { token } = await itializeTokenBalancesFixture(tokenomicOwner.getAddress(), 100);

      const tokenomic = TokenomicBuilder.new()
      .withBalance(100)
      .withToken(token.address)
      .build();

      const authorizedAccounts = AuthorizedAccountBuilder.new().random().build();

      await expect(
        tokenomicContract.connect(tokenomicOwner).modify(tokenomic, authorizedAccounts)
      ).to.be.revertedWith("Tokenomic: tokenomic does not exist");
    });

    it("should fail to modify a tokenomic by not owner account", async function () {
      const { tokenomicContract, tokenomicOwner, user1 } = await loadFixture(deployTokenomicFixture);
      const { token } = await itializeTokenBalancesFixture(tokenomicOwner.getAddress(), 100);

      const tokenomic = TokenomicBuilder.new()
      .withBalance(10)
      .withToken(token.address)
      .build();

      const authorizedAccounts = AuthorizedAccountBuilder.new().random().build();

      await token.connect(tokenomicOwner).approve(tokenomicContract.address, 10);
      await tokenomicContract.connect(tokenomicOwner).create(tokenomic, authorizedAccounts);

      const modifiedTokenomic = TokenomicBuilder.new()
      .withBalance(100)
      .withToken(token.address)
      .build();

      await expect(tokenomicContract.connect(user1).modify(modifiedTokenomic, authorizedAccounts)).to.be.reverted;
    });

    it("should update the balance of a tokenomic", async function () {
      const { tokenomicContract, tokenomicOwner } = await loadFixture(deployTokenomicFixture);
      const { token } = await itializeTokenBalancesFixture(tokenomicOwner.getAddress(), 100);
      const tokenomic = TokenomicBuilder.new()
      .withBalance(10)
      .withToken(token.address)
      .build();
      const authorizedAccounts = AuthorizedAccountBuilder.new().random().build();

      await token.connect(tokenomicOwner).approve(tokenomicContract.address, 100);
      await tokenomicContract.connect(tokenomicOwner).create(tokenomic, authorizedAccounts);
    
      const modifiedTokenomic = TokenomicBuilder.new()
      .withBalance(20)
      .withToken(token.address)
      .build();

      await tokenomicContract.connect(tokenomicOwner).modify(modifiedTokenomic, authorizedAccounts);
      expect(await tokenomicContract.balance(tokenomicOwner.getAddress())).to.equal(30);
    });

    it("should update the authorized account of a tokenomic", async function () {
      const { tokenomicContract, tokenomicOwner, user1, user2 } = await loadFixture(deployTokenomicFixture);
      const { token } = await itializeTokenBalancesFixture(tokenomicOwner.getAddress(), 100);
      const tokenomic = TokenomicBuilder.new()
      .withBalance(10)
      .withToken(token.address)
      .build();
      const authorizedAccounts = 
        AuthorizedAccountBuilder.new()
        .user(await user1.getAddress())
        .period(10, await  now() + days(1))
        .addAccount()
        .build();
 
      await token.connect(tokenomicOwner).approve(tokenomicContract.address, 100);
      await tokenomicContract.connect(tokenomicOwner).create(tokenomic, authorizedAccounts);

      const modifiedAuthorizedAccounts = AuthorizedAccountBuilder.new()
        .user(await user1.getAddress())
        .withAuthorized(false)
        .addAccount()
        .user(await user2.getAddress())
        .period(10, await  now() + days(1))
        .addAccount()
        .build();

      await tokenomicContract.connect(tokenomicOwner).modify(tokenomic, modifiedAuthorizedAccounts);
      expect(await tokenomicContract.connect(user1).isAuthorized(tokenomicOwner.getAddress(), user1.getAddress())).to.be.false;
      expect(await tokenomicContract.connect(user2).isAuthorized(tokenomicOwner.getAddress(), user2.getAddress())).to.be.true;
    });
  });

  describe("claimTokens()", function () {
    it("should fail to claim tokens from a nonexistent tokenomic", async function () {
      const { tokenomicContract, tokenomicOwner, user1} = await loadFixture(deployTokenomicFixture);

      await expect(tokenomicContract.connect(user1).claim(tokenomicOwner.getAddress())).to.be.revertedWith(
        "Tokenomic: tokenomic does not exist"
      );
    });

    it("should fail to claim tokens from a tokenomic with zero balance", async function () {
      const { tokenomicContract, tokenomicOwner, user1, user2 } = await loadFixture(deployTokenomicFixture);
      const { token } = await itializeTokenBalancesFixture(tokenomicOwner.getAddress(), 100);

      const tokenomic = TokenomicBuilder.new()
      .withBalance(10)
      .withToken(token.address)
      .build();

      const authorizedAccounts = AuthorizedAccountBuilder.new()
        .user(await user1.getAddress())
        .period(10, await  now() + days(1))
        .addAccount()
        .user(await user2.getAddress())
        .period(10, await  now() + days(2))
        .addAccount()
        .build();

      await token.connect(tokenomicOwner).approve(tokenomicContract.address, 20);
      await tokenomicContract.connect(tokenomicOwner).create(tokenomic, authorizedAccounts);

      await ethers.provider.send("evm_increaseTime", [days(1)]);
      await tokenomicContract.connect(user1).claim(tokenomicOwner.getAddress());

      await expect(tokenomicContract.connect(user2).claim(tokenomicOwner.getAddress())).to.be.reverted;
    });

    it("should fail to claim tokens from a tokenomic before the allowed time", async function () {
      const { user1, tokenomicContract,tokenomicOwner } = await loadFixture(deployTokenomicFixture);

      const { token } = await itializeTokenBalancesFixture(tokenomicOwner.getAddress(), 100);

      const tokenomic = TokenomicBuilder.new()
      .withBalance(10)
      .withToken(token.address)
      .build();

      const authorizedAccounts = 
        AuthorizedAccountBuilder.new()
        .user(await user1.getAddress())
        .period(5, await  now() + days(1))
        .addAccount()
        .build();
  
      await token.connect(tokenomicOwner).approve(tokenomicContract.address, 10);
      await tokenomicContract.connect(tokenomicOwner).create(tokenomic, authorizedAccounts);

      await expect(tokenomicContract.connect(user1).claim(tokenomicOwner.getAddress())).to.be.revertedWith(
        "Tokenomic: cannot claim tokens before the allowed time"
      );
    });

    it("should fail to claim tokens from a tokenomic with not authorized account", async function () {
      const { user1, user2, tokenomicContract, tokenomicOwner } = await loadFixture(deployTokenomicFixture);
      const { token } = await itializeTokenBalancesFixture(tokenomicOwner.getAddress(), 100);

      const tokenomic = TokenomicBuilder.new()
      .withBalance(10)
      .withToken(token.address)
      .build();

      const authorizedAccounts = AuthorizedAccountBuilder.new()
        .user(await user1.getAddress())
        .period(10, await  now() + days(1))
        .addAccount()
        .build();

      await token.connect(tokenomicOwner).approve(tokenomicContract.address, 10);
      await tokenomicContract.connect(tokenomicOwner).create(tokenomic, authorizedAccounts);

      await ethers.provider.send("evm_increaseTime", [days(1)]);
      await expect(tokenomicContract.connect(user2).claim(tokenomicOwner.getAddress())).to.be.revertedWith(
        "Tokenomic: account is not authorized"
      );
    });

    it ("should fail to claim tokens from a already claimed tokenomic", async function () {
      const { user1, tokenomicContract, tokenomicOwner } = await loadFixture(deployTokenomicFixture);
      const { token } = await itializeTokenBalancesFixture(tokenomicOwner.getAddress(), 100);

      const tokenomic = TokenomicBuilder.new()
      .withBalance(10)
      .withToken(token.address)
      .build();

      const authorizedAccounts = AuthorizedAccountBuilder.new()
        .user(await user1.getAddress())
        .period(5, await  now() + days(1))
        .period(5, await  now() + days(2))
        .addAccount()
        .build();

      await token.connect(tokenomicOwner).approve(tokenomicContract.address, 10);
      await tokenomicContract.connect(tokenomicOwner).create(tokenomic, authorizedAccounts);

      await ethers.provider.send("evm_increaseTime", [days(1)]);
      await tokenomicContract.connect(user1).claim(tokenomicOwner.getAddress());

      await expect(tokenomicContract.connect(user1).claim(tokenomicOwner.getAddress())).to.be.revertedWith(
        "Tokenomic: cannot claim tokens before the allowed time"
      );
    });

    it("should transfer the correct amount of tokens from a tokenomic after the allowed time", async function () {
      const { user1, user2, tokenomicContract, tokenomicOwner } = await loadFixture(deployTokenomicFixture);
      const { token } = await itializeTokenBalancesFixture(tokenomicOwner.getAddress(), 100); 

      const tokenomic = TokenomicBuilder.new()
      .withBalance(20)
      .withToken(token.address)
      .build();

      const authorizedAccounts = AuthorizedAccountBuilder.new()
        .user(await user1.getAddress())
        .period(10, await  now() + days(1))
        .addAccount()
        .user(await user2.getAddress())
        .period(5, await  now() + days(1))
        .addAccount()
        .build();

      await token.connect(tokenomicOwner).approve(tokenomicContract.address, 20);
      await tokenomicContract.connect(tokenomicOwner).create(tokenomic, authorizedAccounts);

      await ethers.provider.send("evm_increaseTime", [days(1)]);
      await ethers.provider.send("evm_mine", []);
      const user1BalanceBefore = await token.balanceOf(user1.getAddress());
      await tokenomicContract.connect(user1).claim(tokenomicOwner.getAddress());
      const user1BalanceAfter = await token.balanceOf(user1.getAddress());
      expect(user1BalanceAfter.sub(user1BalanceBefore)).to.equal(10);
    });

    it("should fail to claim tokens from a tokenomic when the tokenomic is paused", async function () {
      const { user1, tokenomicContract, tokenomicOwner } = await loadFixture(deployTokenomicFixture);
      const { token } = await itializeTokenBalancesFixture(tokenomicOwner.getAddress(), 100);

      const tokenomic = TokenomicBuilder.new()
      .withBalance(10)
      .withToken(token.address)
      .build();

      const authorizedAccounts = AuthorizedAccountBuilder.new()
        .user(await user1.getAddress())
        .period(10, await  now() + days(1))
        .addAccount()
        .build();

      await token.connect(tokenomicOwner).approve(tokenomicContract.address, 10);
      await tokenomicContract.connect(tokenomicOwner).create(tokenomic, authorizedAccounts);

      await tokenomicContract.connect(tokenomicOwner).pause();

      await ethers.provider.send("evm_increaseTime", [days(1)]);
      await expect(tokenomicContract.connect(user1).claim(tokenomicOwner.getAddress())).to.be.revertedWith(
        "Tokenomic: tokenomic is paused"
      );
    });

    it("should allow to claim the correct amount of tokens from a tokenomic with multiple periods", async function () {
      const { user1, user2, tokenomicContract, tokenomicOwner } = await loadFixture(deployTokenomicFixture);
      const { token } = await itializeTokenBalancesFixture(tokenomicOwner.getAddress(), 100);

      const tokenomic = TokenomicBuilder.new()
      .withBalance(30)
      .withToken(token.address)
      .build();

      const authorizedAccounts = AuthorizedAccountBuilder.new()
        .user(await user1.getAddress())
        .period(10, await  now() + days(1))
        .period(10, await  now() + days(4))
        .addAccount()
        .user(await user2.getAddress())
        .period(5, await  now() + days(1))
        .period(5, await  now() + days(2))
        .addAccount()
        .build();

      await token.connect(tokenomicOwner).approve(tokenomicContract.address, 30);
      await tokenomicContract.connect(tokenomicOwner).create(tokenomic, authorizedAccounts);

      await ethers.provider.send("evm_increaseTime", [days(1)]);
      await ethers.provider.send("evm_mine", []);
      await tokenomicContract.connect(user1).claim(tokenomicOwner.getAddress());
      expect(await token.balanceOf(user1.getAddress())).to.equal(10);
      await ethers.provider.send("evm_increaseTime", [days(3)]);
      await ethers.provider.send("evm_mine", []);
      await tokenomicContract.connect(user1).claim(tokenomicOwner.getAddress());
      expect(await token.balanceOf(user1.getAddress())).to.equal(20);
      await tokenomicContract.connect(user2).claim(tokenomicOwner.getAddress());
      expect(await token.balanceOf(user2.getAddress())).to.equal(10);
    });

    it("should allow to claim tokens from a tokenomic when the tokenomic is paused and unpaused", async function () {
      const { user1, tokenomicContract, tokenomicOwner } = await loadFixture(deployTokenomicFixture);
      const { token } = await itializeTokenBalancesFixture(tokenomicOwner.getAddress(), 100);

      const tokenomic = TokenomicBuilder.new()
      .withBalance(100)
      .withToken(token.address)
      .build();

      const authorizedAccounts = AuthorizedAccountBuilder.new()
        .user(await user1.getAddress())
        .period(10, await now() + days(1))
        .period(10, await now() + days(4))
        .addAccount()
        .build();

      await token.connect(tokenomicOwner).approve(tokenomicContract.address, 100);
      await tokenomicContract.connect(tokenomicOwner).create(tokenomic, authorizedAccounts);

      await ethers.provider.send("evm_increaseTime", [days(1)]);
      await ethers.provider.send("evm_mine", []);
      await tokenomicContract.connect(user1).claim(tokenomicOwner.getAddress());
      expect(await token.balanceOf(user1.getAddress())).to.equal(10);

      await tokenomicContract.connect(tokenomicOwner).pause();

      await ethers.provider.send("evm_increaseTime", [days(3)]);
      await ethers.provider.send("evm_mine", []);
      await expect(tokenomicContract.connect(user1).claim(tokenomicOwner.getAddress())).to.be.revertedWith(
        "Tokenomic: tokenomic is paused"
      );
      await tokenomicContract.connect(tokenomicOwner).unpause();
      await tokenomicContract.connect(user1).claim(tokenomicOwner.getAddress())
      expect(await token.balanceOf(user1.getAddress())).to.equal(20);
  });
});
});

function days(days: number): number {
  return days * 24 * 60 * 60 * 1000;
}

async function now():Promise<number> {
  return time.latest();
}

