class BankAccount {

    private balance: number = 0

    deposit(amount: number) {
        if (amount > 0) {
            this.balance += amount
        }
    }

    withdraw(amount: number) {
        if (amount > 0 && amount <= this.balance) {
            this.balance -= amount
        }
    }

    getBalance() {
        return this.balance
    }

}

const account = new BankAccount()
account.deposit(100)
account.withdraw(50)
console.log(account.getBalance())

// Convert to module to avoid global scope conflicts
export { }
