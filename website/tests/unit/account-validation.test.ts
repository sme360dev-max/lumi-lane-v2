import assert from 'node:assert/strict';
import { test } from 'node:test';
import { validateAccount } from '../../src/features/account/validation.ts';

const values = { fullName: '', email: '', password: '', confirmPassword: '' };

test('login requires email and password without applying registration rules', () => {
  assert.deepEqual(validateAccount('login', values), {
    email: 'Enter your email address.',
    password: 'Enter your password.',
  });
  assert.deepEqual(
    validateAccount('login', {
      ...values,
      email: ' alex@example.com ',
      password: 'present',
    }),
    {},
  );
});

test('registration requires a name, valid email, long enough password and exact confirmation', () => {
  assert.deepEqual(
    validateAccount('signup', {
      ...values,
      email: 'alex@',
      password: 'short',
      confirmPassword: 'different',
    }),
    {
      fullName: 'Enter your full name.',
      email: 'Enter a valid email address.',
      password: 'Use at least 8 characters.',
      confirmPassword: 'The passwords must match.',
    },
  );
  assert.deepEqual(
    validateAccount('signup', {
      fullName: 'Alex Example',
      email: 'alex@example.com',
      password: 'a test phrase',
      confirmPassword: 'a test phrase',
    }),
    {},
  );
});
