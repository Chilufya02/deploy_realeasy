const test = require('node:test');
const assert = require('node:assert');
const {
  PaymentResult,
  CardPaymentProcessor,
  AirtelMoneyProcessor,
  MTNMoneyProcessor,
  TEST_CARDS,
  TEST_MOBILE_NUMBERS,
} = require('../src/services/paymentSimulation');

test('payment processors return PaymentResult with correct prefix', () => {
  const cases = [
    ['card', new CardPaymentProcessor(), { cardNumber: '4242424242424242', expiry: '12/25', cvv: '123' }],
    ['airtel', new AirtelMoneyProcessor(), { phoneNumber: '+260970000000' }],
    ['mtn', new MTNMoneyProcessor(), { phoneNumber: '+260760000000' }],
  ];
  for (const [prefix, processor, params] of cases) {
    const result = processor.process(100, params);
    assert.ok(result instanceof PaymentResult);
    assert.match(result.transactionId, new RegExp(`^${prefix}-`));
    assert.strictEqual(typeof result.message, 'string');
  }
});

test('test data arrays contain sample entries', () => {
  assert.ok(TEST_CARDS.length > 0);
  assert.ok(TEST_MOBILE_NUMBERS.length > 0);
});

test('payment simulator produces deterministic results', () => {
  delete require.cache[require.resolve('../src/services/paymentSimulation')];
  const { CardPaymentProcessor: FreshCardProcessor } = require('../src/services/paymentSimulation');
  const processor = new FreshCardProcessor();
  const ids = [];
  const successes = [];
  for (let i = 0; i < 12; i++) {
    const result = processor.process(100, { cardNumber: '4242424242424242', expiry: '12/25', cvv: '123' });
    ids.push(result.transactionId);
    successes.push(result.success);
  }
  assert.deepStrictEqual(ids.slice(0, 3), ['card-100000', 'card-100001', 'card-100002']);
  assert.ok(successes.slice(0, 9).every(Boolean));
  assert.strictEqual(successes[9], false);
  assert.strictEqual(successes[10], true);
});
