/*****************************************************************
 * RIDE SHARING LLD (OLA / UBER)
 * Patterns Used:
 * 1. Factory Pattern    → Vehicle creation
 * 2. Strategy Pattern   → Driver matching & Notification channel
 * 3. Observer Pattern   → Ride lifecycle notifications
 *****************************************************************/


/***********************
 * ENUMS / CONSTANTS
 ***********************/

const RideStatus = {
  CREATED: "CREATED",
  DRIVER_ASSIGNED: "DRIVER_ASSIGNED",
  ON_THE_WAY: "ON_THE_WAY",
  COMPLETED: "COMPLETED",
};

const VehicleType = {
  AUTO: "AUTO",
  CAR: "CAR",
  AC_CAR: "AC_CAR",
  BIKE: "BIKE",
  EV: "EV",
};


/********************************************************
 * FACTORY PATTERN
 * Responsibility: Create Vehicle objects based on user
 * choice (Auto, Car, AC Car, Bike, EV)
 ********************************************************/

class Vehicle {
  constructor(type) {
    this.type = type;
  }
}

class Auto extends Vehicle {
  constructor() {
    super(VehicleType.AUTO);
  }
}

class Car extends Vehicle {
  constructor() {
    super(VehicleType.CAR);
  }
}

class ACCar extends Vehicle {
  constructor() {
    super(VehicleType.AC_CAR);
  }
}

class Bike extends Vehicle {
  constructor() {
    super(VehicleType.BIKE);
  }
}

class EV extends Vehicle {
  constructor() {
    super(VehicleType.EV);
  }
}

// 🔥 Factory Pattern
class VehicleFactory {
  static create(vehicleType) {


    switch (vehicleType) {
      case VehicleType.AUTO:
        return new Auto();
      case VehicleType.CAR:
        return new Car();
      case VehicleType.AC_CAR:
        return new ACCar();
      case VehicleType.BIKE:
        return new Bike();
      case VehicleType.EV:
        return new EV();
      default:
        throw new Error("Invalid vehicle type");
    }
  }
}


/********************************************************
 * STRATEGY PATTERN
 * Responsibility: Driver matching logic
 ********************************************************/

// Strategy Interface
class DriverMatchingStrategy {
  findDriver(ride, drivers) {
    throw new Error("Method not implemented");
  }
}

// Concrete Strategy
class NearestDriverStrategy extends DriverMatchingStrategy {
  findDriver(ride, drivers) {
    // Simplified: return first eligible driver
    return drivers.find(
      d => d.vehicle.type === ride.vehicle.type
    );
  }
}


/********************************************************
 * OBSERVER PATTERN
 * Responsibility: React to ride lifecycle changes
 ********************************************************/

// Observer Interface
class RideObserver {
  update(ride) {
    throw new Error("Method not implemented");
  }
}


/********************************************************
 * STRATEGY PATTERN (again)
 * Responsibility: Notification delivery mechanism
 ********************************************************/

class NotificationChannel {
  send(message) {
    throw new Error("Method not implemented");
  }
}

class SMSChannel extends NotificationChannel {
  send(message) {
    console.log("📱 SMS:", message);
  }
}

class PushChannel extends NotificationChannel {
  send(message) {
    console.log("🔔 Push:", message);
  }
}


/********************************************************
 * CONCRETE OBSERVERS
 * Observer + Strategy combined
 ********************************************************/

class RiderNotificationObserver extends RideObserver {
  constructor(channel) {
    super();
    this.channel = channel; // Strategy injected
  }

  update(ride) {
    this.channel.send(
      `Ride ${ride.rideId} status changed to ${ride.status}`
    );
  }
}

class DriverNotificationObserver extends RideObserver {
  constructor(channel) {
    super();
    this.channel = channel;
  }

  update(ride) {
    if (ride.assignedDriver) {
      this.channel.send(
        `Driver assigned for ride ${ride.rideId}`
      );
    }
  }
}


/********************************************************
 * SUBJECT (Observer Pattern)
 * Ride entity
 ********************************************************/

class Ride {
  constructor(rideId, pickup, drop, vehicle) {
    this.rideId = rideId;
    this.pickup = pickup;
    this.drop = drop;
    this.vehicle = vehicle;
    this.status = RideStatus.CREATED;
    this.assignedDriver = null;
    this.observers = [];
  }

  addObserver(observer) {
    this.observers.push(observer);
  }

  notifyObservers() {
    this.observers.forEach(o => o.update(this));
  }

  updateStatus(status) {
    this.status = status;
    this.notifyObservers();
  }

  assignDriver(driver) {
    this.assignedDriver = driver;
    this.updateStatus(RideStatus.DRIVER_ASSIGNED);
  }
}


/********************************************************
 * DRIVER ENTITY
 ********************************************************/

class Driver {
  constructor(id, name, vehicle) {
    this.id = id;
    this.name = name;
    this.vehicle = vehicle;
  }
}


/********************************************************
 * APPLICATION FLOW (DEMO)
 * This is what you walk through in interview
 ********************************************************/

// 1️⃣ User selects vehicle type
const selectedVehicle =
  VehicleFactory.create(VehicleType.AC_CAR);

// 2️⃣ Create Ride
const ride = new Ride(
  101,
  "BTM Layout",
  "Electronic City",
  selectedVehicle
);

// 3️⃣ Attach observers (Observer Pattern)
ride.addObserver(
  new RiderNotificationObserver(new PushChannel())
);
ride.addObserver(
  new DriverNotificationObserver(new SMSChannel())
);

// 4️⃣ Available drivers
const drivers = [
  new Driver(1, "Ravi", VehicleFactory.create(VehicleType.AC_CAR)),
  new Driver(2, "Suresh", VehicleFactory.create(VehicleType.AUTO)),
];

// 5️⃣ Driver matching (Strategy Pattern)
const matchingStrategy = new NearestDriverStrategy();
const matchedDriver =
  matchingStrategy.findDriver(ride, drivers);

// 6️⃣ Assign driver
ride.assignDriver(matchedDriver);

// 7️⃣ Ride lifecycle updates
ride.updateStatus(RideStatus.ON_THE_WAY);
ride.updateStatus(RideStatus.COMPLETED);
