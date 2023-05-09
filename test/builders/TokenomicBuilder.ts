export class TokenomicBuilder {

    private tokenomic: {
        balance: number;
        token: string;
        paused: boolean;
    };

    constructor() {
        this.tokenomic = {
            balance: 0,
            token: "",
            paused: false,
        };
    }

    public withBalance(balance: number): TokenomicBuilder {
        this.tokenomic.balance = balance;
        return this;
    }

    public withToken(token: string): TokenomicBuilder {
        this.tokenomic.token = token;
        return this;
    }

    public withPaused(paused: boolean): TokenomicBuilder {
        this.tokenomic.paused = paused;
        return this;
    }

    public build(): {
        balance: number;
        token: string;
        paused: boolean;
    } {
        if (this.tokenomic.token === "") {
           this.tokenomic.token = Math.random().toString(36).substring(7);
        }
        return this.tokenomic;
    }

    public random() {
        this.tokenomic.balance = Math.floor(Math.random() * 100);
        this.tokenomic.token = Math.random().toString(36).substring(7);
        this.tokenomic.paused = Math.random() < 0.5;
        return this;
    }

    public static new(): TokenomicBuilder {
        return new TokenomicBuilder();
    }
}
