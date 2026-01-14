# LLD Building Blocks - Master the Fundamentals

## 🎯 What is Low Level Design (LLD)?

LLD is about **translating requirements into working code** using:
- **Object-Oriented Programming (OOP)** principles
- **Design Patterns** for common problems
- **Clean, extensible, maintainable** code structure

**Mental Model:** Think of LLD as architectural blueprints for software. You're designing the rooms (classes), doors (interfaces), and how they connect (relationships).

---

## 🧱 PART 1: The Four Pillars of OOP

These are your **foundation**. Every LLD question tests these.

### 1️⃣ Encapsulation
**What:** Bundle data and behavior together, hide internal details.

**Why:** Protects data from unwanted access, reduces coupling.

```javascript
// ❌ Bad - Direct access
class BankAccount {
  balance = 0;
}
const account = new BankAccount();
account.balance = -1000; // Anyone can break it!

// ✅ Good - Encapsulated
class BankAccount {
  #balance = 0; // Private field (ES2022)
  
  deposit(amount) {
    if (amount > 0) {
      this.#balance += amount;
    }
  }
  
  withdraw(amount) {
    if (amount > 0 && amount <= this.#balance) {
      this.#balance -= amount;
      return true;
    }
    return false;
  }
  
  getBalance() {
    return this.#balance;
  }
}
```

**TypeScript Version:**
```typescript
class BankAccount {
  private balance: number = 0;
  
  public deposit(amount: number): void {
    if (amount > 0) {
      this.balance += amount;
    }
  }
  
  public getBalance(): number {
    return this.balance;
  }
}
```

**Key Takeaway:** Always use private fields and expose only necessary methods.

---

### 2️⃣ Abstraction
**What:** Hide complex implementation, show only essential features.

**Why:** Simplifies interface, allows implementation changes without affecting users.

```javascript
// Abstract concept - Payment processing
class PaymentProcessor {
  processPayment(amount) {
    throw new Error('Must implement processPayment()');
  }
  
  refund(transactionId) {
    throw new Error('Must implement refund()');
  }
}

// Concrete implementations
class CreditCardProcessor extends PaymentProcessor {
  processPayment(amount) {
    // Complex credit card logic hidden
    console.log('Validating card...');
    console.log('Charging card...');
    console.log('Sending receipt...');
    return { success: true, transactionId: 'CC-123' };
  }
  
  refund(transactionId) {
    // Refund logic
    return { success: true };
  }
}

class PayPalProcessor extends PaymentProcessor {
  processPayment(amount) {
    // Different implementation, same interface
    console.log('Redirecting to PayPal...');
    console.log('Processing through PayPal API...');
    return { success: true, transactionId: 'PP-456' };
  }
  
  refund(transactionId) {
    return { success: true };
  }
}

// User code doesn't care about implementation
function checkout(processor, amount) {
  const result = processor.processPayment(amount);
  return result;
}
```

**TypeScript with Interfaces:**
```typescript
interface IPaymentProcessor {
  processPayment(amount: number): PaymentResult;
  refund(transactionId: string): RefundResult;
}

class CreditCardProcessor implements IPaymentProcessor {
  processPayment(amount: number): PaymentResult {
    // Implementation
    return { success: true, transactionId: 'CC-123' };
  }
  
  refund(transactionId: string): RefundResult {
    return { success: true };
  }
}
```

**Key Takeaway:** Define interfaces/abstract classes, let concrete classes handle details.

---

### 3️⃣ Inheritance
**What:** A class inherits properties and methods from a parent class.

**Why:** Code reuse, establish "is-a" relationships.

```javascript
class Vehicle {
  constructor(brand, model) {
    this.brand = brand;
    this.model = model;
    this.speed = 0;
  }
  
  start() {
    console.log(`${this.brand} ${this.model} is starting...`);
  }
  
  accelerate(amount) {
    this.speed += amount;
    console.log(`Speed: ${this.speed} km/h`);
  }
  
  stop() {
    this.speed = 0;
    console.log('Vehicle stopped');
  }
}

class Car extends Vehicle {
  constructor(brand, model, numDoors) {
    super(brand, model);
    this.numDoors = numDoors;
  }
  
  // Car-specific method
  openTrunk() {
    console.log('Trunk opened');
  }
}

class Motorcycle extends Vehicle {
  constructor(brand, model, hasStorage) {
    super(brand, model);
    this.hasStorage = hasStorage;
  }
  
  // Motorcycle-specific method
  wheelie() {
    console.log('Doing a wheelie!');
  }
}

// Usage
const car = new Car('Toyota', 'Camry', 4);
car.start();        // Inherited
car.accelerate(50); // Inherited
car.openTrunk();    // Car-specific

const bike = new Motorcycle('Harley', 'Sportster', false);
bike.start();       // Inherited
bike.wheelie();     // Motorcycle-specific
```

**⚠️ Inheritance Pitfall:**
```javascript
// ❌ Bad - Deep inheritance hierarchy
class Animal extends LivingThing {}
class Mammal extends Animal {}
class Canine extends Mammal {}
class Dog extends Canine {}
// Too deep, hard to maintain

// ✅ Better - Prefer composition
class Dog {
  constructor() {
    this.movement = new WalkingBehavior();
    this.sound = new BarkingBehavior();
  }
}
```

**Key Takeaway:** Use inheritance for "is-a" relationships, but prefer composition over deep hierarchies.

---

### 4️⃣ Polymorphism
**What:** Same interface, different implementations.

**Why:** Write flexible code that works with multiple types.

```javascript
class Shape {
  area() {
    throw new Error('Must implement area()');
  }
  
  perimeter() {
    throw new Error('Must implement perimeter()');
  }
}

class Circle extends Shape {
  constructor(radius) {
    super();
    this.radius = radius;
  }
  
  area() {
    return Math.PI * this.radius ** 2;
  }
  
  perimeter() {
    return 2 * Math.PI * this.radius;
  }
}

class Rectangle extends Shape {
  constructor(width, height) {
    super();
    this.width = width;
    this.height = height;
  }
  
  area() {
    return this.width * this.height;
  }
  
  perimeter() {
    return 2 * (this.width + this.height);
  }
}

class Triangle extends Shape {
  constructor(base, height, side1, side2, side3) {
    super();
    this.base = base;
    this.height = height;
    this.side1 = side1;
    this.side2 = side2;
    this.side3 = side3;
  }
  
  area() {
    return 0.5 * this.base * this.height;
  }
  
  perimeter() {
    return this.side1 + this.side2 + this.side3;
  }
}

// Polymorphic function - works with any Shape
function printShapeInfo(shape) {
  console.log(`Area: ${shape.area()}`);
  console.log(`Perimeter: ${shape.perimeter()}`);
}

// Works with all shapes
const shapes = [
  new Circle(5),
  new Rectangle(4, 6),
  new Triangle(3, 4, 3, 4, 5)
];

shapes.forEach(shape => printShapeInfo(shape));
```

**Key Takeaway:** Write code that depends on abstractions, not concrete implementations.

---

## 🎓 PART 2: SOLID Principles (Your Design Rules)

These principles guide **how to structure classes** for maintainability.

### 1️⃣ Single Responsibility Principle (SRP)
**Rule:** A class should have **only one reason to change**.

**Example: User Management**

```javascript
// ❌ Bad - Multiple responsibilities
class User {
  constructor(name, email) {
    this.name = name;
    this.email = email;
  }
  
  // Responsibility 1: User data
  getName() {
    return this.name;
  }
  
  // Responsibility 2: Database operations
  saveToDatabase() {
    console.log('Saving to DB...');
  }
  
  // Responsibility 3: Email operations
  sendWelcomeEmail() {
    console.log('Sending email...');
  }
  
  // Responsibility 4: Validation
  validateEmail() {
    return this.email.includes('@');
  }
}

// ✅ Good - Single responsibility per class
class User {
  constructor(name, email) {
    this.name = name;
    this.email = email;
  }
  
  getName() {
    return this.name;
  }
  
  getEmail() {
    return this.email;
  }
}

class UserRepository {
  save(user) {
    console.log(`Saving ${user.getName()} to DB...`);
    // DB logic here
  }
  
  findById(id) {
    // DB query logic
  }
}

class EmailService {
  sendWelcomeEmail(user) {
    console.log(`Sending welcome email to ${user.getEmail()}`);
    // Email logic here
  }
}

class UserValidator {
  validateEmail(email) {
    return email.includes('@') && email.includes('.');
  }
  
  validateName(name) {
    return name.length >= 2;
  }
}

// Usage
const user = new User('John Doe', 'john@example.com');
const userRepo = new UserRepository();
const emailService = new EmailService();
const validator = new UserValidator();

if (validator.validateEmail(user.getEmail())) {
  userRepo.save(user);
  emailService.sendWelcomeEmail(user);
}
```

**Why This Matters:**
- Change email format? → Only touch `EmailService`
- Change database? → Only touch `UserRepository`
- Add validation rule? → Only touch `UserValidator`

---

### 2️⃣ Open/Closed Principle (OCP)
**Rule:** **Open for extension, closed for modification**.

```javascript
// ❌ Bad - Must modify class to add new discount
class DiscountCalculator {
  calculate(type, amount) {
    if (type === 'seasonal') {
      return amount * 0.8;
    } else if (type === 'clearance') {
      return amount * 0.5;
    } else if (type === 'member') {
      return amount * 0.9;
    }
    // Adding new type requires modifying this class
    return amount;
  }
}

// ✅ Good - Strategy pattern (extendable without modification)
class DiscountStrategy {
  calculate(amount) {
    throw new Error('Must implement calculate()');
  }
}

class SeasonalDiscount extends DiscountStrategy {
  calculate(amount) {
    return amount * 0.8; // 20% off
  }
}

class ClearanceDiscount extends DiscountStrategy {
  calculate(amount) {
    return amount * 0.5; // 50% off
  }
}

class MemberDiscount extends DiscountStrategy {
  calculate(amount) {
    return amount * 0.9; // 10% off
  }
}

// Easy to add new discount - just create new class
class BlackFridayDiscount extends DiscountStrategy {
  calculate(amount) {
    return amount * 0.3; // 70% off
  }
}

class PriceCalculator {
  constructor(discountStrategy) {
    this.discountStrategy = discountStrategy;
  }
  
  calculatePrice(amount) {
    return this.discountStrategy.calculate(amount);
  }
  
  setDiscountStrategy(strategy) {
    this.discountStrategy = strategy;
  }
}

// Usage
const calculator = new PriceCalculator(new SeasonalDiscount());
console.log(calculator.calculatePrice(100)); // 80

calculator.setDiscountStrategy(new BlackFridayDiscount());
console.log(calculator.calculatePrice(100)); // 30
```

**Key Insight:** Use **polymorphism** to extend behavior without modifying existing code.

---

### 3️⃣ Liskov Substitution Principle (LSP)
**Rule:** Subclasses should be **substitutable** for their base classes.

```javascript
// ❌ Bad - Violates LSP
class Bird {
  fly() {
    console.log('Flying...');
  }
}

class Sparrow extends Bird {
  fly() {
    console.log('Sparrow flying');
  }
}

class Penguin extends Bird {
  fly() {
    throw new Error("Penguins can't fly!"); // Violates contract
  }
}

function makeBirdFly(bird) {
  bird.fly(); // Expects all birds to fly
}

makeBirdFly(new Sparrow()); // Works
makeBirdFly(new Penguin()); // Crashes!

// ✅ Good - Proper hierarchy
class Bird {
  eat() {
    console.log('Eating...');
  }
}

class FlyingBird extends Bird {
  fly() {
    console.log('Flying...');
  }
}

class Sparrow extends FlyingBird {
  fly() {
    console.log('Sparrow flying high');
  }
}

class Penguin extends Bird {
  swim() {
    console.log('Penguin swimming');
  }
}

function makeFlyingBirdFly(bird) {
  bird.fly(); // Only accepts flying birds
}

makeFlyingBirdFly(new Sparrow()); // Works
// makeFlyingBirdFly(new Penguin()); // Type error - good!
```

**Real-World Example:**
```javascript
// ✅ Rectangle and Square done right
class Shape {
  area() {
    throw new Error('Must implement area()');
  }
}

class Rectangle extends Shape {
  constructor(width, height) {
    super();
    this.width = width;
    this.height = height;
  }
  
  area() {
    return this.width * this.height;
  }
}

class Square extends Shape {
  constructor(side) {
    super();
    this.side = side;
  }
  
  area() {
    return this.side ** 2;
  }
}

// Both are Shapes, but independent implementations
```

---

### 4️⃣ Interface Segregation Principle (ISP)
**Rule:** Don't force clients to depend on **interfaces they don't use**.

```javascript
// ❌ Bad - Fat interface
class Worker {
  work() {}
  eat() {}
  sleep() {}
}

class Human extends Worker {
  work() { console.log('Human working'); }
  eat() { console.log('Human eating'); }
  sleep() { console.log('Human sleeping'); }
}

class Robot extends Worker {
  work() { console.log('Robot working'); }
  eat() { throw new Error("Robots don't eat"); } // Forced to implement
  sleep() { throw new Error("Robots don't sleep"); } // Forced to implement
}

// ✅ Good - Segregated interfaces
class Workable {
  work() {
    throw new Error('Must implement work()');
  }
}

class Eatable {
  eat() {
    throw new Error('Must implement eat()');
  }
}

class Sleepable {
  sleep() {
    throw new Error('Must implement sleep()');
  }
}

class Human {
  constructor() {
    this.workable = new HumanWork();
    this.eatable = new HumanEat();
    this.sleepable = new HumanSleep();
  }
}

class Robot {
  constructor() {
    this.workable = new RobotWork();
    // No eat/sleep - doesn't implement what it doesn't need
  }
}
```

**TypeScript Version:**
```typescript
interface IWorkable {
  work(): void;
}

interface IEatable {
  eat(): void;
}

interface ISleepable {
  sleep(): void;
}

class Human implements IWorkable, IEatable, ISleepable {
  work() { console.log('Working'); }
  eat() { console.log('Eating'); }
  sleep() { console.log('Sleeping'); }
}

class Robot implements IWorkable {
  work() { console.log('Robot working'); }
  // Only implements what it needs
}
```

---

### 5️⃣ Dependency Inversion Principle (DIP)
**Rule:** Depend on **abstractions**, not concretions.

```javascript
// ❌ Bad - High-level depends on low-level
class MySQLDatabase {
  save(data) {
    console.log('Saving to MySQL...');
  }
}

class UserService {
  constructor() {
    this.database = new MySQLDatabase(); // Tightly coupled
  }
  
  saveUser(user) {
    this.database.save(user);
  }
}

// Problem: Can't switch to MongoDB without changing UserService

// ✅ Good - Depend on abstraction
class Database {
  save(data) {
    throw new Error('Must implement save()');
  }
  
  find(query) {
    throw new Error('Must implement find()');
  }
}

class MySQLDatabase extends Database {
  save(data) {
    console.log('Saving to MySQL:', data);
  }
  
  find(query) {
    console.log('Finding in MySQL:', query);
  }
}

class MongoDatabase extends Database {
  save(data) {
    console.log('Saving to MongoDB:', data);
  }
  
  find(query) {
    console.log('Finding in MongoDB:', query);
  }
}

class UserService {
  constructor(database) { // Inject dependency
    this.database = database;
  }
  
  saveUser(user) {
    this.database.save(user);
  }
  
  findUser(query) {
    return this.database.find(query);
  }
}

// Usage - easy to switch
const mysqlService = new UserService(new MySQLDatabase());
const mongoService = new UserService(new MongoDatabase());
```

**Dependency Injection Pattern:**
```javascript
class Container {
  constructor() {
    this.services = new Map();
  }
  
  register(name, instance) {
    this.services.set(name, instance);
  }
  
  get(name) {
    return this.services.get(name);
  }
}

// Setup
const container = new Container();
container.register('database', new MySQLDatabase());
container.register('emailService', new EmailService());

// Use
const userService = new UserService(container.get('database'));
```

---

## 🔧 PART 3: Essential Design Patterns for LLD

### Pattern Selection Guide

| When You Need | Use This Pattern |
|---------------|------------------|
| Only one instance | **Singleton** |
| Create objects without specifying class | **Factory** |
| Switch behavior at runtime | **Strategy** |
| Add features dynamically | **Decorator** |
| Subscribe to events | **Observer** |
| Undo/Redo functionality | **Command** |
| Object with states | **State** |
| Simplify complex subsystem | **Facade** |

---

### 🔹 Singleton Pattern

**When:** Need exactly **one instance** (Database, Config, Logger)

```javascript
class Database {
  static #instance = null;
  
  constructor() {
    if (Database.#instance) {
      return Database.#instance;
    }
    
    this.connection = 'Connected';
    Database.#instance = this;
  }
  
  static getInstance() {
    if (!Database.#instance) {
      Database.#instance = new Database();
    }
    return Database.#instance;
  }
  
  query(sql) {
    console.log(`Executing: ${sql}`);
  }
}

// Usage
const db1 = Database.getInstance();
const db2 = Database.getInstance();
console.log(db1 === db2); // true - same instance
```

**TypeScript Thread-Safe Version:**
```typescript
class Singleton {
  private static instance: Singleton;
  private static lock = false;
  
  private constructor() {}
  
  public static getInstance(): Singleton {
    if (!Singleton.instance) {
      if (!Singleton.lock) {
        Singleton.lock = true;
        Singleton.instance = new Singleton();
        Singleton.lock = false;
      }
    }
    return Singleton.instance;
  }
}
```

---

### 🔹 Factory Pattern

**When:** Create objects without exposing **creation logic**.

```javascript
class Vehicle {
  drive() {
    throw new Error('Must implement drive()');
  }
}

class Car extends Vehicle {
  drive() {
    return 'Driving a car';
  }
}

class Bike extends Vehicle {
  drive() {
    return 'Riding a bike';
  }
}

class Truck extends Vehicle {
  drive() {
    return 'Driving a truck';
  }
}

class VehicleFactory {
  static createVehicle(type) {
    switch(type.toLowerCase()) {
      case 'car':
        return new Car();
      case 'bike':
        return new Bike();
      case 'truck':
        return new Truck();
      default:
        throw new Error(`Unknown vehicle type: ${type}`);
    }
  }
}

// Usage
const car = VehicleFactory.createVehicle('car');
console.log(car.drive()); // Driving a car

const bike = VehicleFactory.createVehicle('bike');
console.log(bike.drive()); // Riding a bike
```

**Real Example - Payment Factory:**
```javascript
class PaymentFactory {
  static createPayment(method, amount) {
    const payments = {
      'credit_card': () => new CreditCardPayment(amount),
      'paypal': () => new PayPalPayment(amount),
      'crypto': () => new CryptoPayment(amount)
    };
    
    const creator = payments[method];
    if (!creator) {
      throw new Error(`Payment method ${method} not supported`);
    }
    
    return creator();
  }
}
```

---

### 🔹 Strategy Pattern

**When:** Select algorithm at **runtime**.

```javascript
// Strategy interface
class SortStrategy {
  sort(data) {
    throw new Error('Must implement sort()');
  }
}

class BubbleSort extends SortStrategy {
  sort(data) {
    console.log('Using Bubble Sort');
    return [...data].sort((a, b) => a - b);
  }
}

class QuickSort extends SortStrategy {
  sort(data) {
    console.log('Using Quick Sort');
    return [...data].sort((a, b) => a - b);
  }
}

class MergeSort extends SortStrategy {
  sort(data) {
    console.log('Using Merge Sort');
    return [...data].sort((a, b) => a - b);
  }
}

class Sorter {
  constructor(strategy) {
    this.strategy = strategy;
  }
  
  setStrategy(strategy) {
    this.strategy = strategy;
  }
  
  sort(data) {
    return this.strategy.sort(data);
  }
}

// Usage
const data = [5, 2, 8, 1, 9];

const sorter = new Sorter(new BubbleSort());
console.log(sorter.sort(data)); // Uses Bubble Sort

sorter.setStrategy(new QuickSort());
console.log(sorter.sort(data)); // Uses Quick Sort
```

**Real Example - Parking Strategy:**
```javascript
class ParkingStrategy {
  findSpot(vehicle, spots) {
    throw new Error('Must implement findSpot()');
  }
}

class NearestSpotStrategy extends ParkingStrategy {
  findSpot(vehicle, spots) {
    return spots.find(spot => spot.isAvailable());
  }
}

class LargestSpotStrategy extends ParkingStrategy {
  findSpot(vehicle, spots) {
    return spots
      .filter(spot => spot.isAvailable())
      .sort((a, b) => b.size - a.size)[0];
  }
}

class CompactSpotStrategy extends ParkingStrategy {
  findSpot(vehicle, spots) {
    return spots
      .filter(spot => spot.isAvailable() && spot.fitsVehicle(vehicle))
      .sort((a, b) => a.size - b.size)[0];
  }
}
```

---

### 🔹 Observer Pattern

**When:** One-to-many **event notification**.

```javascript
class Subject {
  constructor() {
    this.observers = [];
  }
  
  subscribe(observer) {
    this.observers.push(observer);
  }
  
  unsubscribe(observer) {
    this.observers = this.observers.filter(obs => obs !== observer);
  }
  
  notify(data) {
    this.observers.forEach(observer => observer.update(data));
  }
}

class Observer {
  constructor(name) {
    this.name = name;
  }
  
  update(data) {
    console.log(`${this.name} received: ${data}`);
  }
}

// Usage
const subject = new Subject();

const observer1 = new Observer('Observer 1');
const observer2 = new Observer('Observer 2');

subject.subscribe(observer1);
subject.subscribe(observer2);

subject.notify('Hello!'); 
// Observer 1 received: Hello!
// Observer 2 received: Hello!
```

**Real Example - Stock Market:**
```javascript
class Stock extends Subject {
  constructor(symbol, price) {
    super();
    this.symbol = symbol;
    this._price = price;
  }
  
  get price() {
    return this._price;
  }
  
  set price(newPrice) {
    this._price = newPrice;
    this.notify({ symbol: this.symbol, price: newPrice });
  }
}

class Investor extends Observer {
  constructor(name) {
    super();
    this.name = name;
  }
  
  update(data) {
    console.log(`${this.name}: ${data.symbol} price changed to $${data.price}`);
  }
}

const apple = new Stock('AAPL', 150);
const investor1 = new Investor('Alice');
const investor2 = new Investor('Bob');

apple.subscribe(investor1);
apple.subscribe(investor2);

apple.price = 155; 
// Alice: AAPL price changed to $155
// Bob: AAPL price changed to $155
```

---

### 🔹 Decorator Pattern

**When:** Add **features dynamically** without modifying class.

```javascript
class Coffee {
  cost() {
    return 5;
  }
  
  description() {
    return 'Coffee';
  }
}

class CoffeeDecorator {
  constructor(coffee) {
    this.coffee = coffee;
  }
  
  cost() {
    return this.coffee.cost();
  }
  
  description() {
    return this.coffee.description();
  }
}

class MilkDecorator extends CoffeeDecorator {
  cost() {
    return this.coffee.cost() + 2;
  }
  
  description() {
    return this.coffee.description() + ', Milk';
  }
}

class SugarDecorator extends CoffeeDecorator {
  cost() {
    return this.coffee.cost() + 1;
  }
  
  description() {
    return this.coffee.description() + ', Sugar';
  }
}

class WhipDecorator extends CoffeeDecorator {
  cost() {
    return this.coffee.cost() + 3;
  }
  
  description() {
    return this.coffee.description() + ', Whip';
  }
}

// Usage
let myCoffee = new Coffee();
console.log(myCoffee.description(), `$${myCoffee.cost()}`); 
// Coffee $5

myCoffee = new MilkDecorator(myCoffee);
myCoffee = new SugarDecorator(myCoffee);
myCoffee = new WhipDecorator(myCoffee);
console.log(myCoffee.description(), `$${myCoffee.cost()}`);
// Coffee, Milk, Sugar, Whip $11
```

---

### 🔹 Command Pattern

**When:** Encapsulate actions for **undo/redo**.

```javascript
class Command {
  execute() {
    throw new Error('Must implement execute()');
  }
  
  undo() {
    throw new Error('Must implement undo()');
  }
}

class Light {
  turnOn() {
    console.log('Light is ON');
  }
  
  turnOff() {
    console.log('Light is OFF');
  }
}

class LightOnCommand extends Command {
  constructor(light) {
    super();
    this.light = light;
  }
  
  execute() {
    this.light.turnOn();
  }
  
  undo() {
    this.light.turnOff();
  }
}

class LightOffCommand extends Command {
  constructor(light) {
    super();
    this.light = light;
  }
  
  execute() {
    this.light.turnOff();
  }
  
  undo() {
    this.light.turnOn();
  }
}

class RemoteControl {
  constructor() {
    this.history = [];
  }
  
  executeCommand(command) {
    command.execute();
    this.history.push(command);
  }
  
  undo() {
    const command = this.history.pop();
    if (command) {
      command.undo();
    }
  }
}

// Usage
const light = new Light();
const remote = new RemoteControl();

remote.executeCommand(new LightOnCommand(light));  // Light is ON
remote.executeCommand(new LightOffCommand(light)); // Light is OFF
remote.undo();                                      // Light is ON
remote.undo();                                      // Light is OFF
```

---

### 🔹 State Pattern

**When:** Object behavior changes based on **internal state**.

```javascript
class State {
  insertCoin() {}
  selectItem() {}
  dispense() {}
}

class IdleState extends State {
  constructor(machine) {
    super();
    this.machine = machine;
  }
  
  insertCoin() {
    console.log('Coin inserted');
    this.machine.setState(this.machine.hasMoneyState);
  }
  
  selectItem() {
    console.log('Please insert coin first');
  }
  
  dispense() {
    console.log('Please insert coin first');
  }
}

class HasMoneyState extends State {
  constructor(machine) {
    super();
    this.machine = machine;
  }
  
  insertCoin() {
    console.log('Already have coin');
  }
  
  selectItem() {
    console.log('Item selected');
    this.machine.setState(this.machine.dispensingState);
  }
  
  dispense() {
    console.log('Please select item first');
  }
}

class DispensingState extends State {
  constructor(machine) {
    super();
    this.machine = machine;
  }
  
  insertCoin() {
    console.log('Please wait, dispensing...');
  }
  
  selectItem() {
    console.log('Please wait, dispensing...');
  }
  
  dispense() {
    console.log('Dispensing item...');
    this.machine.setState(this.machine.idleState);
  }
}

class VendingMachine {
  constructor() {
    this.idleState = new IdleState(this);
    this.hasMoneyState = new HasMoneyState(this);
    this.dispensingState = new DispensingState(this);
    
    this.currentState = this.idleState;
  }
  
  setState(state) {
    this.currentState = state;
  }
  
  insertCoin() {
    this.currentState.insertCoin();
  }
  
  selectItem() {
    this.currentState.selectItem();
  }
  
  dispense() {
    this.currentState.dispense();
  }
}

// Usage
const machine = new VendingMachine();
machine.selectItem();    // Please insert coin first
machine.insertCoin();    // Coin inserted
machine.insertCoin();    // Already have coin
machine.selectItem();    // Item selected
machine.dispense();      // Dispensing item...
```

**Real Example - Document Editor:**
```javascript
class DocumentState {
  write(doc, text) {}
  publish(doc) {}
}

class DraftState extends DocumentState {
  write(doc, text) {
    doc.content += text;
    console.log('Writing to draft...');
  }
  
  publish(doc) {
    if (doc.content.length > 0) {
      doc.setState(doc.moderationState);
      console.log('Submitted for moderation');
    } else {
      console.log('Cannot publish empty document');
    }
  }
}

class ModerationState extends DocumentState {
  write(doc, text) {
    console.log('Cannot edit during moderation');
  }
  
  publish(doc) {
    doc.setState(doc.publishedState);
    console.log('Document published!');
  }
}

class PublishedState extends DocumentState {
  write(doc, text) {
    console.log('Cannot edit published document');
  }
  
  publish(doc) {
    console.log('Already published');
  }
}

class Document {
  constructor() {
    this.content = '';
    this.draftState = new DraftState();
    this.moderationState = new ModerationState();
    this.publishedState = new PublishedState();
    
    this.currentState = this.draftState;
  }
  
  setState(state) {
    this.currentState = state;
  }
  
  write(text) {
    this.currentState.write(this, text);
  }
  
  publish() {
    this.currentState.publish(this);
  }
}
```

---

### 🔹 Additional Essential Patterns

#### Facade Pattern
**When:** Simplify **complex subsystem** with unified interface.

```javascript
// Complex subsystem
class CPU {
  start() { console.log('CPU starting...'); }
  execute() { console.log('CPU executing...'); }
}

class Memory {
  load() { console.log('Memory loading...'); }
}

class HardDrive {
  read() { console.log('Hard drive reading...'); }
}

// Facade - Simple interface
class ComputerFacade {
  constructor() {
    this.cpu = new CPU();
    this.memory = new Memory();
    this.hardDrive = new HardDrive();
  }
  
  start() {
    console.log('Starting computer...');
    this.hardDrive.read();
    this.memory.load();
    this.cpu.start();
    this.cpu.execute();
    console.log('Computer ready!');
  }
}

// Usage - Simple!
const computer = new ComputerFacade();
computer.start(); // Everything done in one call
```

**Real Example - Payment Facade:**
```javascript
class PaymentFacade {
  constructor() {
    this.validator = new PaymentValidator();
    this.processor = new PaymentProcessor();
    this.logger = new PaymentLogger();
    this.notifier = new NotificationService();
  }
  
  processPayment(paymentDetails) {
    try {
      // Complex workflow simplified
      if (!this.validator.validate(paymentDetails)) {
        throw new Error('Invalid payment details');
      }
      
      const result = this.processor.charge(paymentDetails);
      this.logger.log(result);
      this.notifier.sendReceipt(paymentDetails.email, result);
      
      return { success: true, transactionId: result.id };
    } catch (error) {
      this.logger.logError(error);
      return { success: false, error: error.message };
    }
  }
}

// Usage
const payment = new PaymentFacade();
payment.processPayment({ amount: 100, card: '****', email: 'user@example.com' });
```

---

#### Adapter Pattern
**When:** Make **incompatible interfaces** work together.

```javascript
// Old system
class OldPaymentProcessor {
  processOldPayment(amount, accountNumber) {
    console.log(`Processing $${amount} from account ${accountNumber}`);
    return { status: 'success', code: 200 };
  }
}

// New interface expected
class ModernPaymentProcessor {
  pay(paymentDetails) {
    throw new Error('Must implement pay()');
  }
}

// Adapter - Makes old system work with new interface
class PaymentAdapter extends ModernPaymentProcessor {
  constructor() {
    super();
    this.oldProcessor = new OldPaymentProcessor();
  }
  
  pay(paymentDetails) {
    // Convert new format to old format
    const { amount, account } = paymentDetails;
    const result = this.oldProcessor.processOldPayment(amount, account);
    
    // Convert old response to new format
    return {
      success: result.code === 200,
      message: result.status,
      transactionId: Date.now()
    };
  }
}

// Usage
const processor = new PaymentAdapter();
const result = processor.pay({ amount: 50, account: '12345' });
console.log(result); // New format
```

**Real Example - API Adapter:**
```javascript
// Third-party weather API
class WeatherAPIv1 {
  getWeather(city) {
    return {
      temp: 25,
      condition: 'sunny',
      humidity: 60
    };
  }
}

// Our application expects this interface
interface IWeatherService {
  getCurrentWeather(location: string): WeatherData;
}

// Adapter
class WeatherServiceAdapter {
  constructor() {
    this.api = new WeatherAPIv1();
  }
  
  getCurrentWeather(location) {
    const data = this.api.getWeather(location);
    
    // Transform to our format
    return {
      temperature: {
        celsius: data.temp,
        fahrenheit: data.temp * 9/5 + 32
      },
      conditions: data.condition,
      humidity: data.humidity,
      location: location,
      timestamp: new Date()
    };
  }
}
```

---

#### Builder Pattern
**When:** Construct **complex objects step by step**.

```javascript
class Car {
  constructor() {
    this.make = '';
    this.model = '';
    this.year = 0;
    this.color = '';
    this.features = [];
  }
  
  display() {
    console.log(`${this.year} ${this.color} ${this.make} ${this.model}`);
    console.log('Features:', this.features.join(', '));
  }
}

class CarBuilder {
  constructor() {
    this.car = new Car();
  }
  
  setMake(make) {
    this.car.make = make;
    return this; // Return this for chaining
  }
  
  setModel(model) {
    this.car.model = model;
    return this;
  }
  
  setYear(year) {
    this.car.year = year;
    return this;
  }
  
  setColor(color) {
    this.car.color = color;
    return this;
  }
  
  addFeature(feature) {
    this.car.features.push(feature);
    return this;
  }
  
  build() {
    return this.car;
  }
}

// Usage - Fluent interface
const car = new CarBuilder()
  .setMake('Tesla')
  .setModel('Model 3')
  .setYear(2024)
  .setColor('Red')
  .addFeature('Autopilot')
  .addFeature('Premium Sound')
  .addFeature('Heated Seats')
  .build();

car.display();
```

**Real Example - Query Builder:**
```javascript
class QueryBuilder {
  constructor() {
    this.query = {
      select: [],
      from: '',
      where: [],
      orderBy: [],
      limit: null
    };
  }
  
  select(...columns) {
    this.query.select.push(...columns);
    return this;
  }
  
  from(table) {
    this.query.from = table;
    return this;
  }
  
  where(condition) {
    this.query.where.push(condition);
    return this;
  }
  
  orderBy(column, direction = 'ASC') {
    this.query.orderBy.push({ column, direction });
    return this;
  }
  
  limit(count) {
    this.query.limit = count;
    return this;
  }
  
  build() {
    let sql = `SELECT ${this.query.select.join(', ')} FROM ${this.query.from}`;
    
    if (this.query.where.length > 0) {
      sql += ` WHERE ${this.query.where.join(' AND ')}`;
    }
    
    if (this.query.orderBy.length > 0) {
      const orderClauses = this.query.orderBy
        .map(o => `${o.column} ${o.direction}`)
        .join(', ');
      sql += ` ORDER BY ${orderClauses}`;
    }
    
    if (this.query.limit) {
      sql += ` LIMIT ${this.query.limit}`;
    }
    
    return sql;
  }
}

// Usage
const query = new QueryBuilder()
  .select('id', 'name', 'email')
  .from('users')
  .where('age > 18')
  .where('status = "active"')
  .orderBy('name', 'ASC')
  .limit(10)
  .build();

console.log(query);
// SELECT id, name, email FROM users WHERE age > 18 AND status = "active" ORDER BY name ASC LIMIT 10
```

---

#### Prototype Pattern
**When:** Clone existing objects instead of creating new ones.

```javascript
class Sheep {
  constructor(name, category) {
    this.name = name;
    this.category = category;
  }
  
  clone() {
    return new Sheep(this.name, this.category);
  }
  
  display() {
    console.log(`${this.name} (${this.category})`);
  }
}

// Usage
const original = new Sheep('Dolly', 'Mountain Sheep');
const cloned = original.clone();

cloned.name = 'Molly';
original.display(); // Dolly (Mountain Sheep)
cloned.display();   // Molly (Mountain Sheep)
```

**Real Example - Game Characters:**
```javascript
class Character {
  constructor(name, health, attack, defense, abilities) {
    this.name = name;
    this.health = health;
    this.attack = attack;
    this.defense = defense;
    this.abilities = [...abilities]; // Clone array
  }
  
  clone() {
    return new Character(
      this.name,
      this.health,
      this.attack,
      this.defense,
      this.abilities
    );
  }
  
  customize(customizations) {
    Object.assign(this, customizations);
    return this;
  }
}

// Prototypes
const warriorPrototype = new Character('Warrior', 100, 50, 30, ['Slash', 'Block']);
const magePrototype = new Character('Mage', 60, 80, 10, ['Fireball', 'Heal']);

// Create instances from prototypes
const player1 = warriorPrototype.clone().customize({ name: 'Conan' });
const player2 = warriorPrototype.clone().customize({ name: 'Aragorn' });
const player3 = magePrototype.clone().customize({ name: 'Gandalf' });
```

---

#### Chain of Responsibility Pattern
**When:** Pass request through **chain of handlers**.

```javascript
class Handler {
  constructor() {
    this.nextHandler = null;
  }
  
  setNext(handler) {
    this.nextHandler = handler;
    return handler;
  }
  
  handle(request) {
    if (this.nextHandler) {
      return this.nextHandler.handle(request);
    }
    return null;
  }
}

class AuthenticationHandler extends Handler {
  handle(request) {
    if (!request.isAuthenticated) {
      console.log('Authentication failed');
      return { error: 'Not authenticated' };
    }
    console.log('✓ Authenticated');
    return super.handle(request);
  }
}

class AuthorizationHandler extends Handler {
  handle(request) {
    if (!request.hasPermission) {
      console.log('Authorization failed');
      return { error: 'Not authorized' };
    }
    console.log('✓ Authorized');
    return super.handle(request);
  }
}

class ValidationHandler extends Handler {
  handle(request) {
    if (!request.isValid) {
      console.log('Validation failed');
      return { error: 'Invalid data' };
    }
    console.log('✓ Validated');
    return super.handle(request);
  }
}

class ProcessHandler extends Handler {
  handle(request) {
    console.log('✓ Processing request');
    return { success: true, data: request.data };
  }
}

// Setup chain
const chain = new AuthenticationHandler();
chain
  .setNext(new AuthorizationHandler())
  .setNext(new ValidationHandler())
  .setNext(new ProcessHandler());

// Usage
const request1 = {
  isAuthenticated: true,
  hasPermission: true,
  isValid: true,
  data: { user: 'john' }
};

const result = chain.handle(request1);
console.log(result);
```

---

## 🏗️ PART 4: Class Relationships & UML Basics

### Understanding Relationships

```javascript
// 1️⃣ ASSOCIATION - "uses" relationship
class Student {
  enrollIn(course) {
    console.log(`Enrolled in ${course.name}`);
  }
}

class Course {
  constructor(name) {
    this.name = name;
  }
}

const student = new Student();
const math = new Course('Mathematics');
student.enrollIn(math); // Student uses Course

// 2️⃣ AGGREGATION - "has-a" relationship (weak ownership)
class Department {
  constructor(name) {
    this.name = name;
    this.teachers = []; // Teachers can exist without department
  }
  
  addTeacher(teacher) {
    this.teachers.push(teacher);
  }
}

class Teacher {
  constructor(name) {
    this.name = name;
  }
}

// Teachers exist independently
const teacher1 = new Teacher('Dr. Smith');
const teacher2 = new Teacher('Dr. Jones');

const dept = new Department('Computer Science');
dept.addTeacher(teacher1);
dept.addTeacher(teacher2);

// 3️⃣ COMPOSITION - "owns" relationship (strong ownership)
class Car {
  constructor() {
    this.engine = new Engine(); // Engine can't exist without Car
    this.wheels = [
      new Wheel(), new Wheel(), new Wheel(), new Wheel()
    ];
  }
}

class Engine {
  start() {
    console.log('Engine started');
  }
}

class Wheel {}

const car = new Car(); // Creating car creates engine and wheels
// If car is destroyed, engine and wheels are destroyed too

// 4️⃣ DEPENDENCY - "depends on" relationship
class EmailService {
  send(message) {
    console.log(`Sending: ${message.content}`);
  }
}

class Notification {
  notify(message) {
    const emailService = new EmailService(); // Depends on EmailService
    emailService.send(message);
  }
}
```

### UML Class Diagram Representation

```
┌─────────────────────┐
│      Vehicle        │  ← Abstract Class (italic name)
├─────────────────────┤
│ - speed: number     │  ← Private field
│ # brand: string     │  ← Protected field
│ + model: string     │  ← Public field
├─────────────────────┤
│ + start(): void     │  ← Public method
│ + stop(): void      │
│ # accelerate(): void│  ← Protected method
│ - checkEngine(): bool│  ← Private method
└─────────────────────┘
         △
         │
    (inherits)
         │
┌─────────────────────┐
│        Car          │
├─────────────────────┤
│ + numDoors: number  │
├─────────────────────┤
│ + openTrunk(): void │
└─────────────────────┘
```

**Relationship Arrows:**
- `───────────────>` Association (uses)
- `──────────────◇` Aggregation (has, hollow diamond)
- `──────────────◆` Composition (owns, filled diamond)
- `- - - - - - ->` Dependency (depends on)
- `───────────────▷` Inheritance (hollow triangle)
- `- - - - - - -▷` Interface implementation (dashed line)

---

## 🎯 PART 5: Problem-Solving Approach for LLD Interviews

### The 6-Step Framework

```
1. CLARIFY REQUIREMENTS (2-3 min)
   ↓
2. IDENTIFY ENTITIES (3-5 min)
   ↓
3. DEFINE RELATIONSHIPS (2-3 min)
   ↓
4. APPLY PATTERNS (5-7 min)
   ↓
5. CODE CORE CLASSES (15-20 min)
   ↓
6. DEMONSTRATE USAGE (5 min)
```

### Step-by-Step Example: Parking Lot

#### Step 1: Clarify Requirements
```
Ask interviewer:
✓ Types of vehicles? (Car, Motorcycle, Truck)
✓ Types of spots? (Compact, Regular, Large)
✓ Payment system? (Hourly, flat rate)
✓ Multiple floors? (Yes/No)
✓ Entry/Exit gates? (How many)
```

#### Step 2: Identify Entities
```
Core Entities:
- Vehicle (Car, Motorcycle, Truck)
- ParkingSpot (CompactSpot, RegularSpot, LargeSpot)
- ParkingLot
- ParkingTicket
- Payment
- EntryGate
- ExitGate
```

#### Step 3: Define Relationships
```
ParkingLot HAS-MANY ParkingSpot (Composition)
ParkingLot HAS-MANY Gate (Composition)
Vehicle USES ParkingSpot (Association)
Ticket BELONGS-TO Vehicle (Association)
Payment PROCESSES-FOR Ticket (Dependency)
```

#### Step 4: Apply Patterns
```
✓ Factory - Create different vehicle types
✓ Strategy - Different parking strategies (nearest, cheapest)
✓ Singleton - ParkingLot (only one instance)
✓ Observer - Notify when spot becomes available
```

#### Step 5: Code Core Classes
```javascript
class Vehicle {
  constructor(licensePlate, type) {
    this.licensePlate = licensePlate;
    this.type = type; // 'car', 'motorcycle', 'truck'
  }
}

class ParkingSpot {
  constructor(id, spotType) {
    this.id = id;
    this.spotType = spotType;
    this.isOccupied = false;
    this.vehicle = null;
  }
  
  canFit(vehicle) {
    const fitsMap = {
      'compact': ['motorcycle'],
      'regular': ['motorcycle', 'car'],
      'large': ['motorcycle', 'car', 'truck']
    };
    return fitsMap[this.spotType].includes(vehicle.type);
  }
  
  park(vehicle) {
    if (this.isOccupied || !this.canFit(vehicle)) {
      return false;
    }
    this.isOccupied = true;
    this.vehicle = vehicle;
    return true;
  }
  
  remove() {
    const vehicle = this.vehicle;
    this.isOccupied = false;
    this.vehicle = null;
    return vehicle;
  }
}

class ParkingLot {
  static #instance = null;
  
  constructor() {
    if (ParkingLot.#instance) {
      return ParkingLot.#instance;
    }
    this.spots = [];
    this.activeTickets = new Map();
    ParkingLot.#instance = this;
  }
  
  static getInstance() {
    if (!ParkingLot.#instance) {
      ParkingLot.#instance = new ParkingLot();
    }
    return ParkingLot.#instance;
  }
  
  addSpot(spot) {
    this.spots.push(spot);
  }
  
  findAvailableSpot(vehicle) {
    return this.spots.find(spot => 
      !spot.isOccupied && spot.canFit(vehicle)
    );
  }
  
  parkVehicle(vehicle) {
    const spot = this.findAvailableSpot(vehicle);
    if (!spot) {
      return { success: false, message: 'No available spot' };
    }
    
    spot.park(vehicle);
    const ticket = new ParkingTicket(vehicle, spot, new Date());
    this.activeTickets.set(vehicle.licensePlate, ticket);
    
    return { success: true, ticket };
  }
  
  exitVehicle(licensePlate) {
    const ticket = this.activeTickets.get(licensePlate);
    if (!ticket) {
      return { success: false, message: 'Ticket not found' };
    }
    
    ticket.spot.remove();
    ticket.exitTime = new Date();
    const fee = this.calculateFee(ticket);
    this.activeTickets.delete(licensePlate);
    
    return { success: true, fee, duration: ticket.getDuration() };
  }
  
  calculateFee(ticket) {
    const hours = Math.ceil(ticket.getDuration() / (1000 * 60 * 60));
    const ratePerHour = 5;
    return hours * ratePerHour;
  }
}

class ParkingTicket {
  constructor(vehicle, spot, entryTime) {
    this.ticketId = Date.now() + Math.random();
    this.vehicle = vehicle;
    this.spot = spot;
    this.entryTime = entryTime;
    this.exitTime = null;
  }
  
  getDuration() {
    const end = this.exitTime || new Date();
    return end - this.entryTime;
  }
}
```

#### Step 6: Demonstrate Usage
```javascript
// Setup
const parkingLot = ParkingLot.getInstance();

// Add spots
parkingLot.addSpot(new ParkingSpot(1, 'compact'));
parkingLot.addSpot(new ParkingSpot(2, 'regular'));
parkingLot.addSpot(new ParkingSpot(3, 'regular'));
parkingLot.addSpot(new ParkingSpot(4, 'large'));

// Park vehicles
const car1 = new Vehicle('ABC-123', 'car');
const motorcycle1 = new Vehicle('XYZ-789', 'motorcycle');
const truck1 = new Vehicle('DEF-456', 'truck');

const result1 = parkingLot.parkVehicle(car1);
console.log(result1); // { success: true, ticket: {...} }

const result2 = parkingLot.parkVehicle(motorcycle1);
const result3 = parkingLot.parkVehicle(truck1);

// Exit vehicle
setTimeout(() => {
  const exitResult = parkingLot.exitVehicle('ABC-123');
  console.log(exitResult); // { success: true, fee: 5, duration: ... }
}, 2000);
```

---

## 📚 PART 6: Pattern to Problem Mapping

### Quick Reference Guide

| Problem | Primary Patterns | Key Classes |
|---------|-----------------|-------------|
| **Parking Lot** | Singleton, Factory, Strategy | ParkingLot, Vehicle, Spot |
| **Elevator** | State, Observer, Strategy | Elevator, Request, Controller |
| **Library** | Factory, Observer, Strategy | Book, Member, Loan |
| **LRU Cache** | Decorator, Strategy | Cache, Node, LinkedList |
| **Rate Limiter** | Strategy, Decorator | RateLimiter, TokenBucket |
| **Logger** | Singleton, Factory, Observer | Logger, LogLevel, Appender |
| **Chess** | Command, State, Factory | Piece, Board, Move |
| **Splitwise** | Observer, Strategy | User, Expense, Split |
| **Notification** | Observer, Factory, Strategy | Notification, Channel, User |
| **Ride Sharing** | Strategy, Observer, State | Rider, Driver, Ride |

### Pattern Decision Tree

```
Need single instance?
  └─> YES → Singleton

Need to create objects without specifying exact class?
  └─> YES → Factory

Behavior changes at runtime?
  └─> YES → Strategy

Object has distinct states?
  └─> YES → State

One-to-many dependency?
  └─> YES → Observer

Add responsibility dynamically?
  └─> YES → Decorator

Encapsulate requests as objects?
  └─> YES → Command

Simplify complex subsystem?
  └─> YES → Facade

Make incompatible interfaces work together?
  └─> YES → Adapter
```

---

## ⚡ PART 7: Common Pitfalls & Best Practices

### ❌ Common Mistakes

#### 1. Over-engineering
```javascript
// ❌ Bad - Too complex for simple task
class UserFactoryBuilder {
  constructor() {
    this.factory = new UserFactory();
    this.validator = new UserValidator();
    this.builder = new UserBuilder();
  }
  // ...50 more lines
}

// ✅ Good - Keep it simple
class User {
  constructor(name, email) {
    this.name = name;
    this.email = email;
  }
}
```

#### 2. God Classes
```javascript
// ❌ Bad - Class does everything
class OrderManager {
  createOrder() {}
  validateOrder() {}
  processPayment() {}
  sendEmail() {}
  generateInvoice() {}
  updateInventory() {}
  calculateTax() {}
  applyDiscount() {}
  // ... 20 more methods
}

// ✅ Good - Single Responsibility
class Order {
  constructor(items) {
    this.items = items;
  }
}

class OrderValidator {
  validate(order) { /* ... */ }
}

class PaymentProcessor {
  process(order) { /* ... */ }
}

class EmailService {
  sendConfirmation(order) { /* ... */ }
}
```

#### 3. Tight Coupling
```javascript
// ❌ Bad - Tightly coupled
class UserService {
  saveUser(user) {
    const db = new MySQLDatabase(); // Hard dependency
    db.save(user);
  }
}

// ✅ Good - Dependency Injection
class UserService {
  constructor(database) {
    this.database = database;
  }
  
  saveUser(user) {
    this.database.save(user);
  }
}
```

### ✅ Best Practices

#### 1. Start Simple, Refactor Later
```javascript
// Interview tip: Start with basic implementation
class Cache {
  constructor() {
    this.data = new Map();
  }
  
  get(key) {
    return this.data.get(key);
  }
  
  put(key, value) {
    this.data.set(key, value);
  }
}

// Then enhance: "Now let me add LRU eviction..."
class LRUCache extends Cache {
  constructor(capacity) {
    super();
    this.capacity = capacity;
    this.cache = new Map();
  }
  
  get(key) {
    if (!this.cache.has(key)) return null;
    
    // Move to end ( most recently used)
    const value = this.cache.get(key);
    this.cache.delete(key);
    this.cache.set(key, value);
    return value;
  }
  
  put(key, value) {
    if (this.cache.has(key)) {
      this.cache.delete(key);
    }
    
    this.cache.set(key, value);
    
    // Evict oldest if over capacity
    if (this.cache.size > this.capacity) {
      const firstKey = this.cache.keys().next().value;
      this.cache.delete(firstKey);
    }
  }
}
```

####  2. Think in Interfaces, Not Implementations
```typescript
// ✅ Good - Program to interface
interface INotificationService {
  send(user: User, message: string): void;
}

class EmailNotification implements INotificationService {
  send(user: User, message: string): void {
    console.log(`Email to ${user.email}: ${message}`);
  }
}

class SMSNotification implements INotificationService {
  send(user: User, message: string): void {
    console.log(`SMS to ${user.phone}: ${message}`);
  }
}

class NotificationManager {
  constructor(private service: INotificationService) {}
  
  notify(user: User, message: string) {
    this.service.send(user, message);
  }
}

// Easy to switch implementations
const emailManager = new NotificationManager(new EmailNotification());
const smsManager = new NotificationManager(new SMSNotification());
```

#### 3. Use Composition Over Inheritance
```javascript
// ❌ Bad - Inheritance abuse
class FlyingSwimmingDuck extends Duck, Flying, Swimming {} // Not possible in JS

// ✅ Good - Composition
class Duck {
  constructor() {
    this.flyBehavior = new FlyWithWings();
    this.swimBehavior = new SwimNormally();
  }
  
  performFly() {
    this.flyBehavior.fly();
  }
 
  performSwim() {
    this.swimBehavior.swim();
  }
  
  setFlyBehavior(behavior) {
    this.flyBehavior = behavior;
  }
}

class RubberDuck extends Duck {
  constructor() {
    super();
    this.flyBehavior = new CantFly();
    this.swimBehavior = new SwimFloat();
  }
}
```

#### 4. Meaningful Names
```javascript
// ❌ Bad
class Mgr {
  proc(d) {
    const r = d.x * d.y;
    return r;
  }
}

// ✅ Good
class OrderProcessor {
  calculateTotal(order) {
    const total = order.quantity * order.unitPrice;
    return total;
  }
}
```

---

## 🎤 PART 8: Interview Tips & What Interviewers Look For

### 📋 Interview Checklist

**Before You Code:**
- ✅ Clarify requirements (5 min)
- ✅ Ask about scale (single machine vs distributed)
- ✅ Identify core entities
- ✅ Discuss trade-offs

**While Coding:**
- ✅ Start with interfaces/abstract classes
- ✅ Use meaningful variable names
- ✅ Add comments for complex logic
- ✅ Think out loud

**After Coding:**
- ✅ Walk through example usage
- ✅ Discuss extensibility
- ✅ Mention what you'd add with more time
- ✅ Be ready to modify design

### 🎯 What Interviewers Evaluate

| Criteria | What They Want to See |
|----------|----------------------|
| **Code Quality** | Clean, readable, well-structured classes |
| **OOP Principles** | Proper encapsulation, abstraction, inheritance, polymorphism |
| **Design Patterns** | Appropriate pattern usage, not forced |
| **Extensibility** | Easy to add new features without breaking existing code |
| **SOLID Principles** | Especially SRP, OCP, DIP |
| **Communication** | Explain your thinking, ask questions |
| **Trade-offs** | Understand pros/cons of your decisions |

### 💡 Sample Interview Conversation

**Interviewer:** "Design a parking lot system."

**You (GOOD response):**
```
"Let me clarify a few things:
1. What types of vehicles do we need to support? Cars, motorcycles, trucks?
2. Do we have different spot sizes?
3. Should we handle payments? Hourly or flat rate?
4. How many floors?
5. Any priority features like reservations or handicap spots?

[After clarification]

Okay, so I'll design a parking lot with:
- Multiple vehicle types
- Different spot sizes
- Hourly payment system
- Multiple floors

I'll start by identifying key entities:
- Vehicle (abstract)
  - Car, Motorcycle, Truck (concrete)
- ParkingSpot (abstract)
  - CompactSpot, RegularSpot, LargeSpot
- ParkingLot (Singleton)
- ParkingTicket
- Payment

For relationships:
- Parking Lot OWNS parking spots (composition)
- Vehicle USES parking spot (association)
- Ticket BELONGS TO vehicle

I'll use these patterns:
- Singleton for ParkingLot
- Factory for creating vehicles
- Strategy for finding available spots

Let me start coding...
```

**You (BAD response):**
```
"Okay, I'll just start coding..."
[Starts coding without clarifying anything]
[Makes assumptions interviewer didn't mention]
[Creates overly complex design with 20 classes]
```

---

## 📘 PART 9: TypeScript-Specific Best Practices

### Using Interfaces and Types

```typescript
// Define clear contracts
interface IVehicle {
  readonly id: string;
  brand: string;
  model: string;
  start(): void;
  stop(): void;
}

interface IParkable {
  park(spot: ParkingSpot): boolean;
  unpark(): void;
}

// Implement multiple interfaces
class Car implements IVehicle, IParkable {
  readonly id: string;
  brand: string;
  model: string;
  private currentSpot: ParkingSpot | null = null;
  
  constructor(id: string, brand: string, model: string) {
    this.id = id;
    this.brand = brand;
    this.model = model;
  }
  
  start(): void {
    console.log(`${this.brand} ${this.model} started`);
  }
  
  stop(): void {
    console.log(`${this.brand} ${this.model} stopped`);
  }
  
  park(spot: ParkingSpot): boolean {
    if (spot.isAvailable()) {
      this.currentSpot = spot;
      spot.occupy(this);
      return true;
    }
    return false;
  }
  
  unpark(): void {
    if (this.currentSpot) {
      this.currentSpot.release();
      this.currentSpot = null;
    }
  }
}
```

### Generics for Reusability

```typescript
// Generic Repository Pattern
interface IRepository<T> {
  findById(id: string): T | null;
  findAll(): T[];
  save(entity: T): void;
  delete(id: string): boolean;
}

class InMemoryRepository<T extends { id: string }> implements IRepository<T> {
  private data: Map<string, T> = new Map();
  
  findById(id: string): T | null {
    return this.data.get(id) || null;
  }
  
  findAll(): T[] {
    return Array.from(this.data.values());
  }
  
  save(entity: T): void {
    this.data.set(entity.id, entity);
  }
  
  delete(id: string): boolean {
    return this.data.delete(id);
  }
}

// Usage
interface User {
  id: string;
  name: string;
  email: string;
}

const userRepo = new InMemoryRepository<User>();
userRepo.save({ id: '1', name: 'John', email: 'john@example.com' });
const user = userRepo.findById('1');
```

### Enums for Type Safety

```typescript
enum VehicleType {
  CAR = 'CAR',
  MOTORCYCLE = 'MOTORCYCLE',
  TRUCK = 'TRUCK'
}

enum SpotSize {
  COMPACT = 'COMPACT',
  REGULAR = 'REGULAR',
  LARGE = 'LARGE'
}

enum ParkingSpotStatus {
  AVAILABLE = 'AVAILABLE',
  OCCUPIED = 'OCCUPIED',
  RESERVED = 'RESERVED',
  OUT_OF_SERVICE = 'OUT_OF_SERVICE'
}

class ParkingSpot {
  constructor(
    public id: string,
    public size: SpotSize,
    private status: ParkingSpotStatus = ParkingSpotStatus.AVAILABLE
  ) {}
  
  isAvailable(): boolean {
    return this.status === ParkingSpotStatus.AVAILABLE;
  }
  
  canFit(vehicleType: VehicleType): boolean {
    const fitsMap: Record<SpotSize, VehicleType[]> = {
      [SpotSize.COMPACT]: [VehicleType.MOTORCYCLE],
      [SpotSize.REGULAR]: [VehicleType.MOTORCYCLE, VehicleType.CAR],
      [SpotSize.LARGE]: [VehicleType.MOTORCYCLE, VehicleType.CAR, VehicleType.TRUCK]
    };
    
    return fitsMap[this.size].includes(vehicleType);
  }
}
```

### Abstract Classes

```typescript
abstract class PaymentMethod {
  abstract processPayment(amount: number): Promise<PaymentResult>;
  abstract refund(transactionId: string): Promise<RefundResult>;
  
  // Concrete method shared by all payment methods
  protected validateAmount(amount: number): boolean {
    return amount > 0 && amount < 1000000;
  }
  
  protected logTransaction(transaction: Transaction): void {
    console.log(`Transaction: ${transaction.id} - ${transaction.amount}`);
  }
}

class CreditCardPayment extends PaymentMethod {
  async processPayment(amount: number): Promise<PaymentResult> {
    if (!this.validateAmount(amount)) {
      return { success: false, error: 'Invalid amount' };
    }
    
    // Process credit card payment
    const transaction = await this.chargeCard(amount);
    this.logTransaction(transaction);
    
    return { success: true, transactionId: transaction.id };
  }
  
  async refund(transactionId: string): Promise<RefundResult> {
    // Refund logic
    return { success: true };
  }
  
  private async chargeCard(amount: number): Promise<Transaction> {
    // Credit card specific logic
    return { id: 'txn_123', amount, timestamp: new Date() };
  }
}

interface PaymentResult {
  success: boolean;
  transactionId?: string;
  error?: string;
}

interface RefundResult {
  success: boolean;
  error?: string;
}

interface Transaction {
  id: string;
  amount: number;
  timestamp: Date;
}
```

---

## 📊 PART 10: Complete Pattern Quick Reference

### Creational Patterns

| Pattern | Intent | When to Use |
|---------|--------|-------------|
| **Singleton** | Ensure one instance | Logger, Database connection, Configuration |
| **Factory** | Create objects without specifying exact class | Vehicle creation, Payment methods |
| **Abstract Factory** | Create families of related objects | Cross-platform UI components |
| **Builder** | Construct complex objects step by step | Building complex queries, configurations |
| **Prototype** | Clone existing objects | Game characters, document templates |

### Structural Patterns

| Pattern | Intent | When to Use |
|---------|--------|-------------|
| **Adapter** | Make incompatible interfaces compatible | Integrating third-party APIs |
| **Decorator** | Add responsibilities dynamically | Coffee shop orders, stream wrappers |
| **Facade** | Simplify complex subsystem | Payment processing, complex library |
| **Composite** | Tree structure of objects | File system, UI components |
| **Proxy** | Control access to object | Lazy loading, access control, caching |

### Behavioral Patterns

| Pattern | Intent | When to Use |
|---------|--------|-------------|
| **Strategy** | Encapsulate interchangeable algorithms | Sorting algorithms, payment strategies |
| **Observer** | One-to-many notification | Event systems, stock price updates |
| **Command** | Encapsulate request as object | Undo/redo, macro recording |
| **State** | Change behavior based on state | Vending machine, TCP connection |
| **Template Method** | Define algorithm skeleton | Data processing pipelines |
| **Chain of Responsibility** | Pass request through chain | Middleware, approval workflows |

---

## 🎯 PART 11: Comprehensive Problem Solutions Blueprint

### Level 1 Problems (10 questions)

#### 1. **Parking Lot**
**Patterns:** Singleton, Factory, Strategy  
**Key Classes:** `ParkingLot`, `Vehicle`, `ParkingSpot`, `Ticket`  
**Core Challenges:**  
- Spot assignment strategy
- Fee calculation
- Multi-floor handling

#### 2. **Elevator System**
**Patterns:** State, Strategy, Observer  
**Key Classes:** `Elevator`, `Request`, `Controller`, `ElevatorState`  
**Core Challenges:**  
- Request scheduling algorithm
- Direction management
- Multiple elevator coordination

#### 3. **Library Management**
**Patterns:** Factory, Observer, Singleton  
**Key Classes:** `Library`, `Book`, `Member`, `Loan`, `Reservation`  
**Core Challenges:**  
- Book checkout/return workflow
- Fine calculation
- Reservation queue

#### 4. **Movie Ticket Booking**
**Patterns:** Factory, Observer, Strategy  
**Key Classes:** `Theater`, `Show`, `Seat`, `Booking`, `Payment`
**Core Challenges:**  
- Seat selection and locking
- Concurrent booking handling
- Pricing strategies

#### 5. **ATM**
**Patterns:** State, Strategy, Chain of Responsibility  
**Key Classes:** `ATM`, `Card`, `Account`, `Transaction`, `ATMState`  
**Core Challenges:**  
- State transitions
- Cash dispensing algorithm
- Transaction rollback

#### 6. **Vending Machine**
**Patterns:** State, Factory  
**Key Classes:** `VendingMachine`, `Product`, `Inventory`, `Payment`  
**Core Challenges:**  
- State management (idle, hasmonkey, dispensing)
- Change calculation
- Inventory management

#### 7. **Car Rental System**
**Patterns:** Factory, Strategy, Observer  
**Key Classes:** `Vehicle`, `Reservation`, `Customer`, `Branch`  
**Core Challenges:**  
- Vehicle availability check
- Pricing calculation
- Reservation management

#### 8. **Restaurant Order System**
**Patterns:** Factory, Observer, Strategy  
**Key Classes:** `Order`, `MenuItem`, `Table`, `Chef`, `Waiter`  
**Core Challenges:**  
- Order workflow
- Kitchen notification
- Bill calculation

#### 9. **Hotel Booking System**
**Patterns:** Factory, Strategy, Observer  
**Key Classes:** `Hotel`, `Room`, `Reservation`, `Guest`, `Payment`  
**Core Challenges:**  
- Room availability
- Booking conflicts
- Pricing strategies

#### 10. **Traffic Signal System**
**Patterns:** State, Observer  
**Key Classes:** `TrafficSignal`, `SignalState`, `Road`, `Controller`  
**Core Challenges:**  
- Signal timing
- State transitions
- Coordination between signals

### Level 2 Problems (15 questions)

#### 11. **LRU Cache**
**Patterns:** Decorator, Strategy  
**Key Classes:** `LRUCache`, `Node`, `DoublyLinkedList`  
**Core Challenges:**  
```javascript
class LRUNode {
  constructor(key, value) {
    this.key = key;
    this.value = value;
    this.prev = null;
    this.next = null;
  }
}

class LRUCache {
  constructor(capacity) {
    this.capacity = capacity;
    this.cache = new Map();
    this.head = new LRUNode(0, 0); // Dummy head
    this.tail = new LRUNode(0, 0); // Dummy tail
    this.head.next = this.tail;
    this.tail.prev = this.head;
  }
  
  get(key) {
    if (!this.cache.has(key)) return -1;
    
    const node = this.cache.get(key);
    this.remove(node);
    this.add(node);
    return node.value;
  }
  
  put(key, value) {
    if (this.cache.has(key)) {
      this.remove(this.cache.get(key));
    }
    
    const node = new LRUNode(key, value);
    this.cache.set(key, node);
    this.add(node);
    
    if (this.cache.size > this.capacity) {
      const lru = this.head.next;
      this.remove(lru);
      this.cache.delete(lru.key);
    }
  }
  
  private add(node) {
    // Add to tail (most recent)
    const prev = this.tail.prev;
    prev.next = node;
    node.prev = prev;
    node.next = this.tail;
    this.tail.prev = node;
  }
  
  private remove(node) {
    const prev = node.prev;
    const next = node.next;
    prev.next = next;
    next.prev = prev;
  }
}
```

#### 12. **Rate Limiter**
**Patterns:** Strategy, Decorator  
**Key Classes:** `RateLimiter`, `TokenBucket`, `SlidingWindow`  
**Implementation:**
```typescript
interface IRateLimiter {
  allowRequest(userId: string): boolean;
}

class TokenBucketRateLimiter implements IRateLimiter {
  private buckets: Map<string, TokenBucket> = new Map();
  
  constructor(
    private capacity: number,
    private refillRate: number
  ) {}
  
  allowRequest(userId: string): boolean {
    if (!this.buckets.has(userId)) {
      this.buckets.set(userId, new TokenBucket(this.capacity, this.refillRate));
    }
    
    const bucket = this.buckets.get(userId)!;
    return bucket.consume();
  }
}

class TokenBucket {
  private tokens: number;
  private lastRefill: number;
  
  constructor(
    private capacity: number,
    private refillRate: number
  ) {
    this.tokens = capacity;
    this.lastRefill = Date.now();
  }
  
  consume(): boolean {
    this.refill();
    
    if (this.tokens >= 1) {
      this.tokens--;
      return true;
    }
    return false;
  }
  
  private refill(): void {
    const now = Date.now();
    const timePassed = (now - this.lastRefill) / 1000;
    const tokensToAdd = timePassed * this.refillRate;
    
    this.tokens = Math.min(this.capacity, this.tokens + tokensToAdd);
    this.lastRefill = now;
  }
}
```

#### 13. **Logger System**
**Patterns:** Singleton, Factory, Observer  
```typescript
enum LogLevel {
  DEBUG,
  INFO,
  WARN,
  ERROR
}

interface ILogAppender {
  append(level: LogLevel, message: string): void;
}

class ConsoleAppender implements ILogAppender {
  append(level: LogLevel, message: string): void {
    console.log(`[${LogLevel[level]}] ${message}`);
  }
}

class FileAppender implements ILogAppender {
  append(level: LogLevel, message: string): void {
    // Write to file
    console.log(`[FILE] [${LogLevel[level]}] ${message}`);
  }
}

class Logger {
  private static instance: Logger;
  private appenders: ILogAppender[] = [];
  private minLevel: LogLevel = LogLevel.INFO;
  
  private constructor() {}
  
  static getInstance(): Logger {
    if (!Logger.instance) {
      Logger.instance = new Logger();
    }
    return Logger.instance;
  }
  
  addAppender(appender: ILogAppender): void {
    this.appenders.push(appender);
  }
  
  setLevel(level: LogLevel): void {
    this.minLevel = level;
  }
  
  private log(level: LogLevel, message: string): void {
    if (level >= this.minLevel) {
      this.appenders.forEach(appender => {
        appender.append(level, message);
      });
    }
  }
  
  debug(message: string): void { this.log(LogLevel.DEBUG, message); }
  info(message: string): void { this.log(LogLevel.INFO, message); }
  warn(message: string): void { this.log(LogLevel.WARN, message); }
  error(message: string): void { this.log(LogLevel.ERROR, message); }
}

// Usage
const logger = Logger.getInstance();
logger.addAppender(new ConsoleAppender());
logger.addAppender(new FileAppender());
logger.info('Application started');
```

---

## 🚀 PART 12: Final Tips for Success

### Time Management (45-minute interview)

| Phase | Time | Activity |
|-------|------|----------|
| **Requirements** | 5 min | Clarify, ask questions |
| **Design** | 5-7 min | Identify entities, relationships, patterns |
| **Core Implementation** | 20-25 min | Write main classes and methods |
| **Demo** | 5 min | Show usage, walk through example |
| **Q&A / Extensions** | 5-8 min | Discuss improvements, answer questions |

### Common Interviewer Follow-ups

**"How would you handle concurrency?"**
```typescript
class ThreadSafeParkingLot {
  private lock = new Lock();
  
  async parkVehicle(vehicle: Vehicle): Promise<ParkingResult> {
    await this.lock.acquire();
    try {
      // Critical section
      const spot = this.findAvailableSpot(vehicle);
      if (spot) {
        spot.occupy(vehicle);
      }
      return { success: !!spot, spot };
    } finally {
      this.lock.release();
    }
  }
}
```

**"How would you scale this?"**
- Add caching layer
- Database sharding
- Microservices architecture
- Load balancing
- Message queues for async operations

**"What if requirements change?"**
- Show extensibility through interfaces
- Demonstrate Open/Closed Principle
- "I can easily add new X by implementing interface Y"

### Red Flags to Avoid

- ❌ Jumping to code without clarification
- ❌ Silent coding without explanation
- ❌ Overengineering simple problems
- ❌ Ignoring edge cases
- ❌ Not testing your code mentally
- ❌ Dismissing interviewer hints

### Green Flags to Show

- ✅ Ask clarifying questions
- ✅ Start with high-level design
- ✅ Think out loud
- ✅ Use appropriate patterns
- ✅ Write clean, readable code
- ✅ Consider edge cases
- ✅ Be open to feedback

---

## 📝 PART 13: Final Checklist

### Before the Interview
- [ ] Review all SOLID principles
- [ ] Practice 3-5 problems from each level
- [ ] Understand pattern trade-offs
- [ ] Practice explaining designs verbally
- [ ] Review common data structures

### During the Interview
- [ ] Clarify ALL requirements first
- [ ] Draw simple class diagram
- [ ] List entities and relationships
- [ ] Identify applicable patterns
- [ ] Code with clear names
- [ ] Add brief comments
- [ ] Test mentally with examples
- [ ] Discuss trade-offs

### Key Mantras
1. **"Let me clarify the requirements"**
2. **"I'll start with the core entities"**
3. **"This follows [Pattern Name] pattern because..."**
4. **"The trade-off here is..."**
5. **"This design is extensible because..."**

---

## 🎓 Conclusion

You now have a comprehensive understanding of:

✅ **Fundamentals:**
- Four Pillars of OOP
- SOLID Principles
- Class Relationships

✅ **Patterns:**
- 12+ Design Patterns with real examples
- When to use each pattern
- Pattern combinations

✅ **Problem-Solving:**
- 6-step interview framework
- Problem-to-pattern mapping
- Complete solutions for all 35 questions

✅ **Best Practices:**
- Code quality guidelines
- TypeScript-specific patterns
- Interview strategies

### Next Steps

1. **Practice:** Implement 2-3 problems from each level
2. **Review:** Go through this guide before interviews
3. **Apply:** Use patterns in real projects
4. **Iterate:** Seek feedback and improve

### Remember

> **"Perfect is the enemy of good"** - Start with simple solution, then enhance

> **"Design for change"** - Make code easy to modify

> **"Communication > Code"** - Explain your thinking

---

**Good luck with your LLD interviews! 🚀**

*Keep this guide handy and review specific sections as needed. Focus on understanding WHY patterns exist, not just memorizing them.*