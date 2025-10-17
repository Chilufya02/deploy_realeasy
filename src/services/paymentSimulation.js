// Simple payment simulation service for development/testing only.
// Provides fake processors for card, Airtel Money, and MTN Money payments.
// All processors deterministically approve nine transactions and decline the tenth.

// Global counters ensure deterministic behaviour across runs.
let idCounter = 100000;
let successCounter = 0;

function generateTransactionId(prefix) {
  return `${prefix}-${idCounter++}`;
}

function isSuccessful() {
  successCounter++;
  return successCounter % 10 !== 0;
}

class PaymentResult {
  constructor(success, message, transactionId) {
    this.success = success;
    this.message = message;
    this.transactionId = transactionId;
  }
}

class CardPaymentProcessor {
  process(amount, { cardNumber, expiry, cvv }) {
    const transactionId = generateTransactionId('card');
    const success = isSuccessful();
    const message = success ? 'Card payment approved.' : 'Card payment declined.';
    return new PaymentResult(success, message, transactionId);
  }
}

class AirtelMoneyProcessor {
  process(amount, { phoneNumber }) {
    const transactionId = generateTransactionId('airtel');
    const success = isSuccessful();
    const message = success ? 'Airtel Money payment approved.' : 'Airtel Money payment declined.';
    return new PaymentResult(success, message, transactionId);
  }
}

class MTNMoneyProcessor {
  process(amount, { phoneNumber }) {
    const transactionId = generateTransactionId('mtn');
    const success = isSuccessful();
    const message = success ? 'MTN Money payment approved.' : 'MTN Money payment declined.';
    return new PaymentResult(success, message, transactionId);
  }
}

// Example test data for simulation only. Not linked to real accounts.
const TEST_CARDS = [
  { brand: 'Visa', cardNumber: '4242424242424242', expiry: '12/25', cvv: '123' },
  { brand: 'MasterCard', cardNumber: '5555555555554444', expiry: '12/25', cvv: '123' },
  { brand: 'Amex', cardNumber: '378282246310005', expiry: '12/25', cvv: '1234' }
];

const TEST_MOBILE_NUMBERS = [
  { service: 'Airtel Money', countryCode: '+250', phoneNumber: '+250780000000' },
  { service: 'Airtel Money', countryCode: '+233', phoneNumber: '+233260000000' },
  { service: 'MTN Money', countryCode: '+256', phoneNumber: '+256760000000' },
  { service: 'MTN Money', countryCode: '+233', phoneNumber: '+233540000000' }
];

module.exports = {
  PaymentResult,
  CardPaymentProcessor,
  AirtelMoneyProcessor,
  MTNMoneyProcessor,
  TEST_CARDS,
  TEST_MOBILE_NUMBERS
};
