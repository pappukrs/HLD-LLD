// Strategy Interface
class NotificationChannel {
  send(message) {
    throw new Error("Not implemented");
  }
}

// Concrete Strategies
class EmailChannel extends NotificationChannel {
  send(message) {
    console.log("📧 Email:", message);
  }
}

class SmsChannel extends NotificationChannel {
  send(message) {
    console.log("📱 SMS:", message);
  }
}

class PushChannel extends NotificationChannel {
  send(message) {
    console.log("🔔 Push:", message);
  }
}





// Observer (Subscriber)

class NotificationObserver {
  constructor(channel) {
    this.channel = channel; // Strategy injected
  }

  notify(message) {
    this.channel.send(message);
  }
}



// Subject (Publisher)


class NotificationService {
  constructor() {
    this.observers = [];
  }

  subscribe(observer) {
    this.observers.push(observer);
  }

  notifyAll(message) {
    for (const observer of this.observers) {
      observer.notify(message);
    }
  }
}






const service = new NotificationService();

service.subscribe(new NotificationObserver(new EmailChannel()));
service.subscribe(new NotificationObserver(new SmsChannel()));
service.subscribe(new NotificationObserver(new PushChannel()));

service.notifyAll("Order placed successfully");

