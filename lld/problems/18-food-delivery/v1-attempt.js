// ==================== ENUMS AND CONSTANTS ====================

const OrderStatus = Object.freeze({
    PLACED: 'PLACED',
    ACCEPTED: 'ACCEPTED',
    PREPARING: 'PREPARING',
    READY: 'READY',
    PICKED_UP: 'PICKED_UP',
    DELIVERED: 'DELIVERED',
    CANCELLED: 'CANCELLED'
});

const DriverStatus = Object.freeze({
    AVAILABLE: 'AVAILABLE',
    BUSY: 'BUSY',
    OFFLINE: 'OFFLINE'
});

const CANCELLATION_PENALTY = 50;

// ==================== LOCATION CLASS ====================

class Location {
    constructor(latitude, longitude) {
        this.latitude = latitude;
        this.longitude = longitude;
    }

    distanceTo(otherLocation) {
        const R = 6371; // Earth's radius in km
        const dLat = this._toRad(otherLocation.latitude - this.latitude);
        const dLon = this._toRad(otherLocation.longitude - this.longitude);

        const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(this._toRad(this.latitude)) *
            Math.cos(this._toRad(otherLocation.latitude)) *
            Math.sin(dLon / 2) * Math.sin(dLon / 2);

        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        return R * c;
    }

    _toRad(degrees) {
        return degrees * (Math.PI / 180);
    }
}

// ==================== BASIC ENTITIES ====================

class Customer {
    constructor(id, name, phone, location) {
        this.id = id;
        this.name = name;
        this.phone = phone;
        this.location = location;
    }
}

class Restaurant {
    constructor(id, name, location, menu = []) {
        this.id = id;
        this.name = name;
        this.location = location;
        this.menu = menu;
    }

    acceptOrder(order) {
        console.log(`✓ Restaurant ${this.name} accepted order ${order.id}`);
        return true;
    }

    startPreparation(order) {
        console.log(`👨‍🍳 Restaurant ${this.name} started preparing order ${order.id}`);
        return true;
    }

    markOrderReady(order) {
        console.log(`✓ Restaurant ${this.name} marked order ${order.id} as ready`);
        return true;
    }
}

class Driver {
    constructor(id, name, phone, vehicleNumber) {
        this.id = id;
        this.name = name;
        this.phone = phone;
        this.vehicleNumber = vehicleNumber;
        this.status = DriverStatus.AVAILABLE;
        this.currentLocation = null;
    }

    updateLocation(location) {
        this.currentLocation = location;
    }

    acceptDelivery(deliveryAssignment) {
        if (this.status !== DriverStatus.AVAILABLE) {
            console.log(`✗ Driver ${this.name} is not available`);
            return false;
        }
        this.status = DriverStatus.BUSY;
        console.log(`✓ Driver ${this.name} accepted delivery ${deliveryAssignment.id}`);
        return true;
    }

    rejectDelivery(deliveryAssignment) {
        console.log(`✗ Driver ${this.name} rejected delivery ${deliveryAssignment.id}`);
        return false;
    }

    completeDelivery() {
        this.status = DriverStatus.AVAILABLE;
        console.log(`✓ Driver ${this.name} is now available`);
    }
}

class OrderItem {
    constructor(menuItem, quantity, price) {
        this.menuItem = menuItem;
        this.quantity = quantity;
        this.price = price;
    }

    getTotalPrice() {
        return this.quantity * this.price;
    }
}

// ==================== STATE PATTERN - ORDER STATES ====================

class OrderState {
    constructor(order) {
        this.order = order;
    }

    cancel() {
        throw new Error('Cancel operation not allowed in this state');
    }

    accept() {
        throw new Error('Accept operation not allowed in this state');
    }

    startPreparation() {
        throw new Error('Start preparation not allowed in this state');
    }

    markReady() {
        throw new Error('Mark ready not allowed in this state');
    }

    pickUp() {
        throw new Error('Pick up not allowed in this state');
    }

    deliver() {
        throw new Error('Deliver not allowed in this state');
    }

    getStatus() {
        throw new Error('Must implement getStatus');
    }
}

class PlacedState extends OrderState {
    cancel() {
        this.order.setState(new CancelledState(this.order));
        return { success: true, penalty: 0 };
    }

    accept() {
        this.order.setState(new AcceptedState(this.order));
    }

    getStatus() {
        return OrderStatus.PLACED;
    }
}

class AcceptedState extends OrderState {
    cancel() {
        this.order.setState(new CancelledState(this.order));
        return { success: true, penalty: 0 };
    }

    startPreparation() {
        this.order.preparationStartedAt = new Date();
        this.order.setState(new PreparingState(this.order));
    }

    getStatus() {
        return OrderStatus.ACCEPTED;
    }
}

class PreparingState extends OrderState {
    cancel() {
        this.order.setState(new CancelledState(this.order));
        return { success: true, penalty: CANCELLATION_PENALTY };
    }

    markReady() {
        this.order.setState(new ReadyState(this.order));
    }

    getStatus() {
        return OrderStatus.PREPARING;
    }
}

class ReadyState extends OrderState {
    cancel() {
        this.order.setState(new CancelledState(this.order));
        return { success: true, penalty: CANCELLATION_PENALTY };
    }

    pickUp() {
        this.order.setState(new PickedUpState(this.order));
    }

    getStatus() {
        return OrderStatus.READY;
    }
}

class PickedUpState extends OrderState {
    cancel() {
        throw new Error('Cannot cancel order after pickup');
    }

    deliver() {
        this.order.setState(new DeliveredState(this.order));
    }

    getStatus() {
        return OrderStatus.PICKED_UP;
    }
}

class DeliveredState extends OrderState {
    getStatus() {
        return OrderStatus.DELIVERED;
    }
}

class CancelledState extends OrderState {
    getStatus() {
        return OrderStatus.CANCELLED;
    }
}

// ==================== ORDER CLASS ====================

class Order {
    constructor(id, customer, restaurant, items) {
        this.id = id;
        this.customer = customer;
        this.restaurant = restaurant;
        this.items = items;
        this.state = new PlacedState(this);
        this.createdAt = new Date();
        this.preparationStartedAt = null;
        this.deliveryAssignment = null;
    }

    setState(state) {
        const oldStatus = this.state.getStatus();
        this.state = state;
        const newStatus = this.state.getStatus();
        console.log(`📦 Order ${this.id} status: ${oldStatus} → ${newStatus}`);
        this._notifyObservers();
    }

    getStatus() {
        return this.state.getStatus();
    }

    cancel() {
        return this.state.cancel();
    }

    accept() {
        this.state.accept();
    }

    startPreparation() {
        this.state.startPreparation();
    }

    markReady() {
        this.state.markReady();
    }

    pickUp() {
        this.state.pickUp();
    }

    deliver() {
        this.state.deliver();
    }

    getTotalAmount() {
        return this.items.reduce((sum, item) => sum + item.getTotalPrice(), 0);
    }

    assignDelivery(deliveryAssignment) {
        this.deliveryAssignment = deliveryAssignment;
    }

    _notifyObservers() {
        NotificationService.getInstance().notifyOrderUpdate(this);
    }
}

// ==================== DELIVERY ASSIGNMENT ====================

class DeliveryAssignment {
    constructor(id, order, driver) {
        this.id = id;
        this.order = order;
        this.driver = driver;
        this.assignedAt = new Date();
        this.acceptedAt = null;
        this.pickedUpAt = null;
        this.deliveredAt = null;
        this.status = 'ASSIGNED';
    }

    accept() {
        if (this.driver.acceptDelivery(this)) {
            this.acceptedAt = new Date();
            this.status = 'ACCEPTED';
            return true;
        }
        this.status = 'REJECTED';
        return false;
    }

    reject() {
        this.driver.rejectDelivery(this);
        this.status = 'REJECTED';
    }

    markPickedUp() {
        this.pickedUpAt = new Date();
        this.status = 'PICKED_UP';
        this.order.pickUp();
        console.log(`🚗 Driver picked up order ${this.order.id}`);
    }

    markDelivered() {
        this.deliveredAt = new Date();
        this.status = 'DELIVERED';
        this.order.deliver();
        this.driver.completeDelivery();
        console.log(`✓ Order ${this.order.id} delivered successfully`);
    }
}

// ==================== STRATEGY PATTERN - DRIVER ASSIGNMENT ====================

class DriverAssignmentStrategy {
    assignDriver(order, availableDrivers) {
        throw new Error('Must implement assignDriver method');
    }
}

class NearestDriverStrategy extends DriverAssignmentStrategy {
    assignDriver(order, availableDrivers) {
        if (!availableDrivers || availableDrivers.length === 0) {
            return null;
        }

        const restaurantLocation = order.restaurant.location;

        const driversWithDistance = availableDrivers
            .filter(driver => driver.status === DriverStatus.AVAILABLE && driver.currentLocation)
            .map(driver => ({
                driver,
                distance: driver.currentLocation.distanceTo(restaurantLocation)
            }))
            .sort((a, b) => a.distance - b.distance);

        if (driversWithDistance.length > 0) {
            console.log(`🔍 Found nearest driver: ${driversWithDistance[0].driver.name} (${driversWithDistance[0].distance.toFixed(2)} km away)`);
            return driversWithDistance[0].driver;
        }

        return null;
    }
}

class HighestRatedDriverStrategy extends DriverAssignmentStrategy {
    assignDriver(order, availableDrivers) {
        // Could implement rating-based assignment
        // For now, fallback to nearest
        return new NearestDriverStrategy().assignDriver(order, availableDrivers);
    }
}

// ==================== OBSERVER PATTERN - NOTIFICATIONS ====================

class Observer {
    update(order, message) {
        console.log(`Notification: ${message}`);
    }

    updateDriver(driver, message) {
        console.log(`Driver Notification: ${message}`);
    }
}

class CustomerNotifier extends Observer {
    update(order, message) {
        console.log(`📱 SMS to ${order.customer.name} (${order.customer.phone}): ${message}`);
    }
}

class RestaurantNotifier extends Observer {
    update(order, message) {
        console.log(`🏪 Notification to ${order.restaurant.name}: ${message}`);
    }
}

class DriverNotifier extends Observer {
    updateDriver(driver, message) {
        console.log(`🚗 Push to Driver ${driver.name}: ${message}`);
    }
}

class NotificationService {
    static instance = null;

    constructor() {
        if (NotificationService.instance) {
            return NotificationService.instance;
        }
        this.observers = [];
        NotificationService.instance = this;
    }

    static getInstance() {
        if (!NotificationService.instance) {
            NotificationService.instance = new NotificationService();
        }
        return NotificationService.instance;
    }

    subscribe(observer) {
        this.observers.push(observer);
    }

    unsubscribe(observer) {
        this.observers = this.observers.filter(obs => obs !== observer);
    }

    notifyOrderUpdate(order) {
        const message = `Order ${order.id} status: ${order.getStatus()}`;
        this.observers.forEach(observer => {
            if (observer.update) {
                observer.update(order, message);
            }
        });
    }

    notifyDriverAssignment(driver, order) {
        const message = `New delivery: Order ${order.id} from ${order.restaurant.name}`;
        this.observers.forEach(observer => {
            if (observer.updateDriver) {
                observer.updateDriver(driver, message);
            }
        });
    }
}

// ==================== SINGLETON SERVICES ====================

class OrderService {
    static instance = null;

    constructor() {
        if (OrderService.instance) {
            return OrderService.instance;
        }
        this.orders = new Map();
        this.orderCounter = 1;
        OrderService.instance = this;
    }

    static getInstance() {
        if (!OrderService.instance) {
            OrderService.instance = new OrderService();
        }
        return OrderService.instance;
    }

    placeOrder(customer, restaurant, items) {
        const orderId = `ORD${String(this.orderCounter++).padStart(4, '0')}`;
        const order = new Order(orderId, customer, restaurant, items);
        this.orders.set(orderId, order);

        console.log(`\n🛒 Order ${orderId} placed by ${customer.name}`);
        console.log(`   Restaurant: ${restaurant.name}`);
        console.log(`   Total: $${order.getTotalAmount()}`);

        return order;
    }

    cancelOrder(orderId) {
        const order = this.orders.get(orderId);

        if (!order) {
            throw new Error('Order not found');
        }

        const currentStatus = order.getStatus();
        if (currentStatus === OrderStatus.CANCELLED) {
            throw new Error('Order already cancelled');
        }

        if (currentStatus === OrderStatus.DELIVERED) {
            throw new Error('Cannot cancel delivered order');
        }

        try {
            const result = order.cancel();

            if (result.penalty > 0) {
                console.log(`\n❌ Order ${orderId} cancelled with penalty: $${result.penalty}`);
            } else {
                console.log(`\n❌ Order ${orderId} cancelled (no penalty)`);
            }

            if (order.deliveryAssignment && order.deliveryAssignment.driver) {
                order.deliveryAssignment.driver.completeDelivery();
            }

            return result;
        } catch (error) {
            throw new Error(`Cannot cancel order: ${error.message}`);
        }
    }

    acceptOrder(orderId) {
        const order = this.orders.get(orderId);
        if (!order) {
            throw new Error('Order not found');
        }

        order.accept();
        order.restaurant.acceptOrder(order);

        const driverService = DriverAssignmentService.getInstance();
        driverService.assignDriverToOrder(order);
    }

    startPreparation(orderId) {
        const order = this.orders.get(orderId);
        if (!order) {
            throw new Error('Order not found');
        }

        order.startPreparation();
        order.restaurant.startPreparation(order);
    }

    markOrderReady(orderId) {
        const order = this.orders.get(orderId);
        if (!order) {
            throw new Error('Order not found');
        }

        order.markReady();
        order.restaurant.markOrderReady(order);
    }

    getOrder(orderId) {
        return this.orders.get(orderId);
    }

    getAllOrders() {
        return Array.from(this.orders.values());
    }
}

class DriverAssignmentService {
    static instance = null;

    constructor() {
        if (DriverAssignmentService.instance) {
            return DriverAssignmentService.instance;
        }
        this.assignmentStrategy = new NearestDriverStrategy();
        this.deliveryCounter = 1;
        DriverAssignmentService.instance = this;
    }

    static getInstance() {
        if (!DriverAssignmentService.instance) {
            DriverAssignmentService.instance = new DriverAssignmentService();
        }
        return DriverAssignmentService.instance;
    }

    setStrategy(strategy) {
        this.assignmentStrategy = strategy;
        console.log(`Strategy changed to: ${strategy.constructor.name}`);
    }

    assignDriverToOrder(order, maxRetries = 3) {
        console.log(`\n🔍 Assigning driver for order ${order.id}...`);

        let availableDrivers = DriverPoolManager.getInstance().getAvailableDrivers();
        let retries = 0;

        while (retries < maxRetries && availableDrivers.length > 0) {
            const driver = this.assignmentStrategy.assignDriver(order, availableDrivers);

            if (!driver) {
                console.log('❌ No available drivers found');
                return null;
            }

            const deliveryId = `DEL${String(this.deliveryCounter++).padStart(4, '0')}`;
            const assignment = new DeliveryAssignment(deliveryId, order, driver);

            const accepted = assignment.accept();

            if (accepted) {
                order.assignDelivery(assignment);
                NotificationService.getInstance().notifyDriverAssignment(driver, order);
                return assignment;
            }

            availableDrivers = availableDrivers.filter(d => d.id !== driver.id);
            retries++;
        }

        console.log('❌ Failed to assign driver after maximum retries');
        return null;
    }
}

class DriverPoolManager {
    static instance = null;

    constructor() {
        if (DriverPoolManager.instance) {
            return DriverPoolManager.instance;
        }
        this.drivers = new Map();
        DriverPoolManager.instance = this;
    }

    static getInstance() {
        if (!DriverPoolManager.instance) {
            DriverPoolManager.instance = new DriverPoolManager();
        }
        return DriverPoolManager.instance;
    }

    addDriver(driver) {
        this.drivers.set(driver.id, driver);
        console.log(`✓ Driver ${driver.name} added to pool`);
    }

    removeDriver(driverId) {
        this.drivers.delete(driverId);
    }

    getAvailableDrivers() {
        return Array.from(this.drivers.values())
            .filter(driver => driver.status === DriverStatus.AVAILABLE);
    }

    getDriver(driverId) {
        return this.drivers.get(driverId);
    }

    getAllDrivers() {
        return Array.from(this.drivers.values());
    }
}

// ==================== DEMO / TESTING ====================

function runDemo() {
    console.log('='.repeat(70));
    console.log('FOOD DELIVERY SYSTEM - LOW LEVEL DESIGN DEMO');
    console.log('='.repeat(70));

    // Initialize notification system
    const notificationService = NotificationService.getInstance();
    notificationService.subscribe(new CustomerNotifier());
    notificationService.subscribe(new RestaurantNotifier());
    notificationService.subscribe(new DriverNotifier());

    // Create locations
    const customerLocation = new Location(12.9716, 77.5946); // Bangalore
    const restaurantLocation = new Location(12.9750, 77.5980);
    const driver1Location = new Location(12.9760, 77.5985); // 0.5 km
    const driver2Location = new Location(12.9800, 77.6000); // 1.2 km

    // Create entities
    const customer = new Customer('C001', 'John Doe', '+91-9876543210', customerLocation);
    const restaurant = new Restaurant('R001', 'Pizza Paradise', restaurantLocation);

    // Create drivers
    const driver1 = new Driver('D001', 'Rajesh Kumar', '+91-9876543211', 'KA01AB1234');
    driver1.updateLocation(driver1Location);

    const driver2 = new Driver('D002', 'Suresh Patel', '+91-9876543212', 'KA01AB5678');
    driver2.updateLocation(driver2Location);

    // Add drivers to pool
    const driverPool = DriverPoolManager.getInstance();
    driverPool.addDriver(driver1);
    driverPool.addDriver(driver2);

    console.log('\n' + '='.repeat(70));
    console.log('SCENARIO 1: Normal Order Flow with Delivery');
    console.log('='.repeat(70));

    // Create order
    const items1 = [
        new OrderItem('Margherita Pizza', 2, 300),
        new OrderItem('Garlic Bread', 1, 150),
        new OrderItem('Coke', 2, 50)
    ];

    const orderService = OrderService.getInstance();
    const order1 = orderService.placeOrder(customer, restaurant, items1);

    // Restaurant accepts
    console.log('\n--- Restaurant Processing ---');
    orderService.acceptOrder(order1.id);

    // Start preparation
    console.log('\n--- Preparation Phase ---');
    orderService.startPreparation(order1.id);

    // Mark ready
    console.log('\n--- Order Ready ---');
    orderService.markOrderReady(order1.id);

    // Pickup
    console.log('\n--- Pickup ---');
    if (order1.deliveryAssignment) {
        order1.deliveryAssignment.markPickedUp();
    }

    // Delivery
    console.log('\n--- Delivery ---');
    if (order1.deliveryAssignment) {
        order1.deliveryAssignment.markDelivered();
    }

    console.log('\n' + '='.repeat(70));
    console.log('SCENARIO 2: Cancellation BEFORE Preparation (No Penalty)');
    console.log('='.repeat(70));

    const items2 = [
        new OrderItem('Pepperoni Pizza', 1, 350)
    ];

    const order2 = orderService.placeOrder(customer, restaurant, items2);
    orderService.acceptOrder(order2.id);

    console.log('\n--- Attempting Cancellation ---');
    try {
        const result = orderService.cancelOrder(order2.id);
        console.log(`💰 Cancellation Penalty: $${result.penalty}`);
    } catch (error) {
        console.log(`Error: ${error.message}`);
    }

    console.log('\n' + '='.repeat(70));
    console.log('SCENARIO 3: Cancellation AFTER Preparation (With Penalty)');
    console.log('='.repeat(70));

    const items3 = [
        new OrderItem('Chicken Pizza', 1, 400),
        new OrderItem('French Fries', 1, 100)
    ];

    const order3 = orderService.placeOrder(customer, restaurant, items3);
    orderService.acceptOrder(order3.id);
    orderService.startPreparation(order3.id);

    console.log('\n--- Attempting Cancellation ---');
    try {
        const result = orderService.cancelOrder(order3.id);
        console.log(`💰 Cancellation Penalty: $${result.penalty}`);
    } catch (error) {
        console.log(`Error: ${error.message}`);
    }

    console.log('\n' + '='.repeat(70));
    console.log('SCENARIO 4: Edge Case - Cannot Cancel After Delivery');
    console.log('='.repeat(70));

    console.log('\n--- Attempting to Cancel Delivered Order ---');
    try {
        orderService.cancelOrder(order1.id);
    } catch (error) {
        console.log(`❌ Error: ${error.message}`);
    }

    console.log('\n' + '='.repeat(70));
    console.log('SCENARIO 5: Driver Assignment Strategy Change');
    console.log('='.repeat(70));

    const driverAssignmentService = DriverAssignmentService.getInstance();
    console.log('\n--- Changing Strategy to Highest Rated ---');
    driverAssignmentService.setStrategy(new HighestRatedDriverStrategy());

    const items4 = [
        new OrderItem('Veg Pizza', 1, 250)
    ];
    const order4 = orderService.placeOrder(customer, restaurant, items4);
    orderService.acceptOrder(order4.id);

    console.log('\n' + '='.repeat(70));
    console.log('FINAL SUMMARY');
    console.log('='.repeat(70));

    const allOrders = orderService.getAllOrders();
    console.log(`\nTotal Orders: ${allOrders.length}`);
    allOrders.forEach(order => {
        console.log(`  ${order.id}: ${order.getStatus()} - $${order.getTotalAmount()}`);
    });

    const allDrivers = driverPool.getAllDrivers();
    console.log(`\nDriver Status:`);
    allDrivers.forEach(driver => {
        console.log(`  ${driver.name}: ${driver.status}`);
    });

    console.log('\n' + '='.repeat(70));
    console.log('DEMO COMPLETED');
    console.log('='.repeat(70));
}


runDemo();