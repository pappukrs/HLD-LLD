// ===== Strategy Interface =====
class RateLimitStrategy {
  allowRequest() {
    throw new Error("Method not implemented");
  }
}

// ===== Token Bucket Strategy =====
class TokenBucket extends RateLimitStrategy {
  constructor(capacity, refillRatePerSec) {
    super();
    this.capacity = capacity;
    this.tokens = capacity;
    this.refillRatePerSec = refillRatePerSec;
    this.lastRefill = Date.now();
  }

  refill() {
    const now = Date.now();
    const elapsedSec = (now - this.lastRefill) / 1000;
    this.tokens = Math.min(
      this.capacity,
      this.tokens + elapsedSec * this.refillRatePerSec
    );
    this.lastRefill = now;
  }

  allowRequest() {
    this.refill();
    if (this.tokens >= 1) {
      this.tokens--;
      return true;
    }
    return false;
  }
}

// ===== Fixed Window Strategy =====
class FixedWindow extends RateLimitStrategy {
  constructor(maxRequests, windowMillis) {
    super();
    this.maxRequests = maxRequests;
    this.windowMillis = windowMillis;
    this.counter = 0;
    this.windowStart = Date.now();
  }

  allowRequest() {
    const now = Date.now();
    if (now - this.windowStart > this.windowMillis) {
      this.counter = 0;
      this.windowStart = now;
    }
    if (this.counter < this.maxRequests) {
      this.counter++;
      return true;
    }
    return false;
  }
}

// ===== Factory =====
class RateLimitStrategyFactory {
  static create(config) {
    switch (config.type) {
      case "free":
        return new TokenBucket(config.limit, config.refillRate);
      case "premium":
        return new FixedWindow(config.limit, config.windowSec * 1000);
      default:
        throw new Error("Unknown user tier");
    }
  }
}

// ===== RateLimiter (Context) =====
class RateLimiter {
  constructor() {
    this.userLimiters = new Map();
  }

  registerUser(userId, config) {
    const limiter = RateLimitStrategyFactory.create(config);
    this.userLimiters.set(userId, limiter);
  }

  allow(userId) {
    const limiter = this.userLimiters.get(userId);
    if (!limiter) throw new Error("User not registered");
    return limiter.allowRequest();
  }
}

// ===== Demo / Test =====
const limiter = new RateLimiter();

limiter.registerUser("freeUser", {
  type: "free",
  limit: 5,
  refillRate: 1,
});

limiter.registerUser("premiumUser", {
  type: "premium",
  limit: 10,
  windowSec: 1,
});

async function simulateRequest(userId) {
  await Promise.resolve();
  console.log(
    userId,
    limiter.allow(userId) ? "✔ ALLOWED" : "✘ RATE LIMITED"
  );
}

async function testConcurrency() {
  // const BATCH_SIZE = 1000;

  // for (let i = 0; i < 50_000_000; i += BATCH_SIZE) {
  //   const batch = [];
  //   for (let j = 0; j < BATCH_SIZE; j++) {
  //     batch.push(simulateRequest("freeUser"));
  //     batch.push(simulateRequest("premiumUser"));
  //   }
  //   await Promise.all(batch);
  // }




  for (let i = 0; i < 50; i++) {
    const batch = [];
    // for (let j = 0; j < BATCH_SIZE; j++) {
      batch.push(simulateRequest("freeUser"));
      batch.push(simulateRequest("premiumUser"));
    // }
    await Promise.all(batch);
  }

  console.log("All requests attempted");
}

testConcurrency();
