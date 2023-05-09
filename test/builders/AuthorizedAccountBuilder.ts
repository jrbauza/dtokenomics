
import { ethers } from "hardhat";

export class AuthorizedAccountBuilder {

    private account: {
        amounts: number[];
        claimDates: number[];
        user: string;
        authorized: boolean;
    };

    private accounts: {
        amounts: number[];
        claimDates: number[];
        user: string;
        authorized: boolean;
    }[];

    constructor() {
        this.account = {
            amounts: [],
            claimDates: [],
            user: "",
            authorized: true,
        };
        this.accounts = [];
    }

    public period(amount: number, claimDate: number): AuthorizedAccountBuilder {
        this.account.amounts.push(amount);
        this.account.claimDates.push(claimDate);
        return this;
    }

    public addAccount(): AuthorizedAccountBuilder {
        this.accounts.push(this.account);
        this.account = {
            amounts: [],
            claimDates: [],
            user: "",
            authorized: true,
        };
        return this;
    }

    public user(user: string): AuthorizedAccountBuilder {
        this.account.user = user;
        return this;
    }

    public withAuthorized(authorized: boolean): AuthorizedAccountBuilder {
        this.account.authorized = authorized;
        return this;
    }

    public build(): {
        amounts: number[];
        claimDates: number[];
        user: string,
        authorized: boolean;
    }[] {
        return this.accounts;
    }

    public static new(): AuthorizedAccountBuilder {
        return new AuthorizedAccountBuilder();
    }

    public random() {
        let accountsNumber = Math.floor(Math.random() * 10) + 1;
        for (let i = 0; i < accountsNumber; i++) {
            this.account.amounts.push(Math.floor(Math.random() * 100));
            this.account.claimDates.push(Math.floor(Math.random() * 100));
            this.account.user = ethers.Wallet.createRandom().address;
            this.accounts.push(this.account);
        }
        return this;
    }

    public empty() {
        this.accounts = [];
        return this
    }
}
