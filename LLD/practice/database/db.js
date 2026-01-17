/*****************************************************
 * 1️⃣ SINGLETON: Database Connection Manager
 *****************************************************/
class Database {
    static instance;

    constructor() {
        if (Database.instance) {
            return Database.instance;
        }

        console.log("DB Connected (Singleton)");

        // Simulated tables
        this.users = new Map();          // stable schema
        this.userMetadata = new Map();   // flexible attributes

        Database.instance = this;
    }

    static getInstance() {
        if (!Database.instance) {
            Database.instance = new Database();
        }
        return Database.instance;
    }
}

/*****************************************************
 * 2️⃣ ENTITY (Stable, Never Changes)
 *****************************************************/
class User {
    constructor(id, name, email) {
        this.id = id;
        this.name = name;
        this.email = email;
        this.createdAt = new Date();
    }
}

/*****************************************************
 * 3️⃣ REPOSITORY (DB Access Layer)
 *****************************************************/
class UserRepository {
    constructor() {
        this.db = Database.getInstance(); // Singleton usage
    }

    saveUser(user) {
        this.db.users.set(user.id, user);
        this.db.userMetadata.set(user.id, {}); // flexible data
    }

    saveAttribute(userId, key, value) {
        const metadata = this.db.userMetadata.get(userId);
        metadata[key] = value;
    }

    getUser(userId) {
        const user = this.db.users.get(userId);
        const metadata = this.db.userMetadata.get(userId);

        return {
            ...user,
            metadata
        };
    }
}

/*****************************************************
 * 4️⃣ SERVICE LAYER (Business Logic)
 *****************************************************/
class UserService {
    constructor() {
        this.userRepo = new UserRepository();
    }

    createUser(id, name, email) {
        const user = new User(id, name, email);
        this.userRepo.saveUser(user);
    }

    addUserAttribute(userId, key, value) {
        this.userRepo.saveAttribute(userId, key, value);
    }

    getUserProfile(userId) {
        return this.userRepo.getUser(userId);
    }
}

/*****************************************************
 * 5️⃣ CLIENT / USAGE
 *****************************************************/
const userService = new UserService();

// Create user (core schema)
userService.createUser(1, "Pappu", "pappu@gmail.com");

// Add attributes (NO DB CHANGE REQUIRED)
userService.addUserAttribute(1, "age", 26);
userService.addUserAttribute(1, "salary", 50000);
userService.addUserAttribute(1, "cibilScore", 780);
userService.addUserAttribute(1, "company", "MoneyPlant");

// Fetch full profile
console.log(userService.getUserProfile(1));

/*****************************************************
 * OUTPUT:
 * {
 *   id: 1,
 *   name: 'Pappu',
 *   email: 'pappu@gmail.com',
 *   createdAt: '...',
 *   metadata: {
 *     age: 26,
 *     salary: 50000,
 *     cibilScore: 780,
 *     company: 'MoneyPlant'
 *   }
 * }
 *****************************************************/
