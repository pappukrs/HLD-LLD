const AccountType = {
  SAVINGS: 'SAVINGS',
  CURRENT: 'CURRENT'
};

const OperationType = {
  WITHDRAW: 'WITHDRAW',
  BALANCE_INQUIRY: 'BALANCE_INQUIRY',
  DEPOSIT: 'DEPOSIT'
};

const NotificationType = {
  SUCCESS: 'SUCCESS',
  ERROR: 'ERROR',
  WARNING: 'WARNING',
  INFO: 'INFO'
}

class NotificationService {
  sendNotification(message, type) {
    const timestamp = new Date().toLocaleString();
    console.log(`[${type}] ${timestamp}: ${message}`);
  }

  notifyInsufficientBalance() {
    this.sendNotification('Insufficient balance in your account', NotificationType.ERROR);
  }

  notifyInvalidPIN() {
    this.sendNotification('Invalid PIN entered', NotificationType.ERROR);
  }

  notifySuccessfulTransaction(details) {
    this.sendNotification(`Transaction successful: ${details}`, NotificationType.SUCCESS);
  }

  notifyInvalidCard() {
    this.sendNotification('Invalid card', NotificationType.ERROR);
  }

  notifyInsufficientCash() {
    this.sendNotification('ATM has insufficient cash', NotificationType.ERROR);
  }
}

class Card {
  constructor(cardNumber, pin, bankName) {
    this.cardNumber = cardNumber;
    this.pin = pin;
    this.bankName = bankName;
  }

  getCardNumber() {
    return this.cardNumber;
  }

  validatePIN(enteredPIN) {
    return this.pin === enteredPIN;
  }
}

class CashDispenser {
  constructor(initialCash = 100000) {
    this.availableCash = initialCash;
  }

  dispenseCash(amount) {
    if (this.checkAvailability(amount)) {
      this.availableCash -= amount;
      console.log(`Dispensing cash: $${amount}`);
      return true;
    }
    return false;
  }

  checkAvailability(amount) {
    return this.availableCash >= amount;
  }

  getAvailableCash() {
    return this.availableCash;
  }
}

class CardReader {
  readCard(card) {
    console.log(`Reading card: ${card.getCardNumber()}`);
    return card;
  }

  ejectCard() {
    console.log('Card ejected');
  }
}

class Screen {
  display(message) {
    console.log(`\nSCREEN: ${message}\n`);
  }

  showOptions(options) {
    console.log('SCREEN - Available Options:');
    options.forEach((option, index) => {
      console.log(`   ${index + 1}. ${option}`);
    });
  }
}

class Keypad {
  getInput() {
    return null;
  }
}

class AccountStrategy {
  withdraw(amount) {
    throw new Error('withdraw() must be implemented');
  }

  checkBalance() {
    throw new Error('checkBalance() must be implemented');
  }

  deposit(amount) {
    throw new Error('deposit() must be implemented');
  }

  getWithdrawalLimit() {
    throw new Error('getWithdrawalLimit() must be implemented');
  }
}

class SavingsAccount extends AccountStrategy {
  constructor(accountNumber, balance = 5000) {
    super();
    this.accountNumber = accountNumber;
    this.balance = balance;
    this.withdrawalLimit = 10000;
  }

  withdraw(amount) {
    if (amount > this.withdrawalLimit) {
      console.log(`Withdrawal limit exceeded. Max: $${this.withdrawalLimit}`);
      return false;
    }
    if (amount > this.balance) {
      console.log('Insufficient balance');
      return false;
    }
    this.balance -= amount;
    console.log(`Withdrawal successful. New balance: $${this.balance}`);
    return true;
  }

  checkBalance() {
    return this.balance;
  }

  deposit(amount) {
    this.balance += amount;
    console.log(`Deposit successful. New balance: $${this.balance}`);
    return true;
  }

  getWithdrawalLimit() {
    return this.withdrawalLimit;
  }
}

class CurrentAccount extends AccountStrategy {
  constructor(accountNumber, balance = 10000) {
    super();
    this.accountNumber = accountNumber;
    this.balance = balance;
    this.withdrawalLimit = 50000;
    this.overdraftLimit = 5000;
  }

  withdraw(amount) {
    if (amount > this.withdrawalLimit) {
      console.log(`Withdrawal limit exceeded. Max: $${this.withdrawalLimit}`);
      return false;
    }
    if (amount > this.balance + this.overdraftLimit) {
      console.log('Insufficient balance (including overdraft)');
      return false;
    }
    this.balance -= amount;
    console.log(`Withdrawal successful. New balance: $${this.balance}`);
    return true;
  }

  checkBalance() {
    return this.balance;
  }

  deposit(amount) {
    this.balance += amount;
    console.log(`Deposit successful. New balance: $${this.balance}`);
    return true;
  }

  getWithdrawalLimit() {
    return this.withdrawalLimit;
  }
}

class Transaction {
  constructor(account) {
    this.transactionId = `TXN${Date.now()}`;
    this.timestamp = new Date();
    this.account = account;
  }

  execute() {
    throw new Error('execute() must be implemented');
  }

  getDetails() {
    return `Transaction ID: ${this.transactionId}, Time: ${this.timestamp.toLocaleString()}`;
  }
}

class WithdrawTransaction extends Transaction {
  constructor(account, amount) {
    super(account);
    this.amount = amount;
  }

  execute() {
    return this.account.withdraw(this.amount);
  }

  getDetails() {
    return `${super.getDetails()}, Type: Withdrawal, Amount: $${this.amount}`;
  }
}

class BalanceInquiryTransaction extends Transaction {
  execute() {
    const balance = this.account.checkBalance();
    console.log(`Current Balance: $${balance}`);
    return true;
  }

  getDetails() {
    return `${super.getDetails()}, Type: Balance Inquiry`;
  }
}

class DepositTransaction extends Transaction {
  constructor(account, amount) {
    super(account);
    this.amount = amount;
  }

  execute() {
    return this.account.deposit(this.amount);
  }

  getDetails() {
    return `${super.getDetails()}, Type: Deposit, Amount: $${this.amount}`;
  }
}

class TransactionFactory {
  static createTransaction(type, account, amount = 0) {
    switch (type) {
      case OperationType.WITHDRAW:
        return new WithdrawTransaction(account, amount);
      case OperationType.BALANCE_INQUIRY:
        return new BalanceInquiryTransaction(account);
      case OperationType.DEPOSIT:
        return new DepositTransaction(account, amount);
      default:
        throw new Error('Invalid transaction type');
    }
  }
}

class BankService {
  constructor() {
    this.accounts = new Map();
    this.notificationService = new NotificationService();
  }

  addAccount(cardNumber, accountType, account) {
    const key = `${cardNumber}_${accountType}`;
    this.accounts.set(key, account);
  }

  validateCard(card) {
    const hasAccount = Array.from(this.accounts.keys()).some(key => 
      key.startsWith(card.getCardNumber())
    );
    if (!hasAccount) {
      this.notificationService.notifyInvalidCard();
      return false;
    }
    return true;
  }

  validatePIN(card, enteredPIN) {
    const isValid = card.validatePIN(enteredPIN);
    if (!isValid) {
      this.notificationService.notifyInvalidPIN();
    }
    return isValid;
  }

  getAccount(cardNumber, accountType) {
    const key = `${cardNumber}_${accountType}`;
    return this.accounts.get(key);
  }

  notifyTransaction(transactionDetails) {
    this.notificationService.notifySuccessfulTransaction(transactionDetails);
  }
}

class ATMState {
  insertCard(atm, card) {
    console.log('Invalid operation in current state');
  }

  ejectCard(atm) {
    console.log('Invalid operation in current state');
  }

  enterPIN(atm, pin) {
    console.log('Invalid operation in current state');
  }

  selectAccountType(atm, accountType) {
    console.log('Invalid operation in current state');
  }

  selectOperation(atm, operationType, amount) {
    console.log('Invalid operation in current state');
  }
}

class IdleState extends ATMState {
  insertCard(atm, card) {
    if (atm.bankService.validateCard(card)) {
      atm.currentCard = card;
      atm.screen.display('Please enter your PIN');
      atm.changeState(new CardInsertedState());
    } else {
      atm.cardReader.ejectCard();
    }
  }
}

class CardInsertedState extends ATMState {
  enterPIN(atm, pin) {
    if (atm.bankService.validatePIN(atm.currentCard, pin)) {
      atm.screen.display('PIN verified successfully');
      atm.screen.showOptions(['Savings Account', 'Current Account']);
      atm.changeState(new PINVerifiedState());
    } else {
      atm.screen.display('Invalid PIN. Card ejected.');
      atm.ejectCard();
    }
  }

  ejectCard(atm) {
    atm.cardReader.ejectCard();
    atm.currentCard = null;
    atm.changeState(new IdleState());
  }
}

class PINVerifiedState extends ATMState {
  selectAccountType(atm, accountType) {
    const account = atm.bankService.getAccount(
      atm.currentCard.getCardNumber(),
      accountType
    );
    
    if (account) {
      atm.selectedAccount = account;
      atm.screen.display(`${accountType} Account selected`);
      atm.screen.showOptions(['Withdraw', 'Balance Inquiry', 'Deposit']);
      atm.changeState(new AccountSelectedState());
    } else {
      atm.screen.display('Account not found');
      atm.ejectCard();
    }
  }

  ejectCard(atm) {
    atm.cardReader.ejectCard();
    atm.currentCard = null;
    atm.selectedAccount = null;
    atm.changeState(new IdleState());
  }
}

class AccountSelectedState extends ATMState {
  selectOperation(atm, operationType, amount = 0) {
    atm.changeState(new TransactionState());
    
    const transaction = TransactionFactory.createTransaction(
      operationType,
      atm.selectedAccount,
      amount
    );
    
    const success = transaction.execute();
    
    if (success) {
      atm.bankService.notifyTransaction(transaction.getDetails());
      
      // For withdrawals, dispense cash
      if (operationType === OperationType.WITHDRAW) {
        if (atm.cashDispenser.checkAvailability(amount)) {
          atm.cashDispenser.dispenseCash(amount);
        } else {
          atm.bankService.notificationService.notifyInsufficientCash();
        }
      }
    }
    
    atm.screen.display('Transaction completed. Card ejected.');
    atm.ejectCard();
  }

  ejectCard(atm) {
    atm.cardReader.ejectCard();
    atm.currentCard = null;
    atm.selectedAccount = null;
    atm.changeState(new IdleState());
  }
}

class TransactionState extends ATMState {
}

class ATM {
  constructor() {
    this.currentState = new IdleState();
    this.currentCard = null;
    this.selectedAccount = null;
    this.cashDispenser = new CashDispenser(100000);
    this.cardReader = new CardReader();
    this.screen = new Screen();
    this.keypad = new Keypad();
    this.bankService = new BankService();
  }

  insertCard(card) {
    this.currentState.insertCard(this, card);
  }

  ejectCard() {
    this.currentState.ejectCard(this);
  }

  enterPIN(pin) {
    this.currentState.enterPIN(this, pin);
  }

  selectAccountType(accountType) {
    this.currentState.selectAccountType(this, accountType);
  }

  selectOperation(operationType, amount = 0) {
    this.currentState.selectOperation(this, operationType, amount);
  }

  changeState(newState) {
    this.currentState = newState;
    console.log(`State changed to: ${newState.constructor.name}`);
  }
}

const atm = new ATM();

const card1 = new Card('1234-5678-9012-3456', '1234', 'XYZ Bank');

const savingsAccount = new SavingsAccount('ACC001', 5000);
const currentAccount = new CurrentAccount('ACC002', 10000);

atm.bankService.addAccount(card1.getCardNumber(), AccountType.SAVINGS, savingsAccount);
atm.bankService.addAccount(card1.getCardNumber(), AccountType.CURRENT, currentAccount);

console.log('Scenario 1: Successful Withdrawal from Savings');
atm.insertCard(card1);
atm.enterPIN('1234');
atm.selectAccountType(AccountType.SAVINGS);
atm.selectOperation(OperationType.WITHDRAW, 1000);

console.log('\nScenario 2: Balance Inquiry from Current Account');
const card2 = new Card('1234-5678-9012-3456', '1234', 'XYZ Bank');
atm.insertCard(card2);
atm.enterPIN('1234');
atm.selectAccountType(AccountType.CURRENT);
atm.selectOperation(OperationType.BALANCE_INQUIRY);

console.log('\nScenario 3: Invalid PIN');
const card3 = new Card('1234-5678-9012-3456', '1234', 'XYZ Bank');
atm.insertCard(card3);
atm.enterPIN('9999');

console.log('\nScenario 4: Deposit to Savings');
const card4 = new Card('1234-5678-9012-3456', '1234', 'XYZ Bank');
atm.insertCard(card4);
atm.enterPIN('1234');
atm.selectAccountType(AccountType.SAVINGS);
atm.selectOperation(OperationType.DEPOSIT, 2000);