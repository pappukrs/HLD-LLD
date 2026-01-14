interface IPaymentProcessor {
  processPayment(amount: number): PaymentResult;
  refund(transactionId: string): RefundResult;
}

class PaymentResult {
  public success: boolean | undefined;
  public transactionId: string | undefined;
}

class RefundResult {
  public success: boolean | undefined;
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


class PaypalProcessor implements IPaymentProcessor {
  processPayment(amount: number): PaymentResult {
    // Implementation
    return { success: true, transactionId: 'PP-123' };
  }

  refund(transactionId: string): RefundResult {
    return { success: true };
  }
}



class UpiProcessor implements IPaymentProcessor {
  processPayment(amount: number): PaymentResult {
    // Implementation
    return { success: true, transactionId: 'UPI-123' };
  }

  refund(transactionId: string): RefundResult {
    return { success: true };
  }
}



function checkout(processor: IPaymentProcessor, amount: number): PaymentResult {
  return processor.processPayment(amount);
}



const processor = new CreditCardProcessor();
const result = checkout(processor, 100);
console.log(result);



const processor2 = new PaypalProcessor();
const result2 = checkout(processor2, 100);
console.log(result2);


const processor3 = new UpiProcessor();
const result3 = checkout(processor3, 100);
console.log(result3);








export { }