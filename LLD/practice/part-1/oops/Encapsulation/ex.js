

// What: Bundle data and behavior together, hide internal details.

// Why: Protects data from unwanted access, reduces coupling.




// Anyone can access the balance property and modify it directly.
// class BankAccount {
//     balance = 0;

// }

// const account = new BankAccount();
// account.balance = 100;
// console.log(account.balance);
// account.balance = -100;
// console.log(account.balance);







class BankAccount {
    #balance = 0; // Private field (ES2022)


    deposit(amount) {

        if (amount > 0) {
            this.#balance += amount;
        }
        // this.#balance += amount;
    }

    withdraw(amount) {
        if (amount > 0 && amount <= this.#balance) {
            this.#balance -= amount;
        }
    }

    getBalance() {
        return this.#balance;
    }
}

const account = new BankAccount();
account.deposit(100);
account.withdraw(50);
console.log(account.getBalance());


