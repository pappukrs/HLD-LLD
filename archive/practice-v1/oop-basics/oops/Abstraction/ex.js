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




class UpiPaymentProcessor extends PaymentProcessor {
    processPayment(amount) {
        // Different implementation, same interface
        console.log('Redirecting to Upi...');
        console.log('Processing through Upi API...');
        return { success: true, transactionId: 'UPI-789' };
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

const processor = new CreditCardProcessor();
console.log(checkout(processor, 100));

const processor2 = new PayPalProcessor();
console.log(checkout(processor2, 100));


const processor3 = new UpiPaymentProcessor();
console.log(checkout(processor3, 100));
