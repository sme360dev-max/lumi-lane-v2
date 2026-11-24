export type AccountMode = 'login' | 'signup';
export type AccountField = 'fullName' | 'email' | 'password' | 'confirmPassword';
export type AccountErrors = Partial<Record<AccountField, string>>;
export const PASSWORD_MINIMUM = 8;

export function validateAccount(mode: AccountMode, values: Record<AccountField, string>): AccountErrors {
  const errors: AccountErrors = {};
  if (mode === 'signup' && !values.fullName.trim()) errors.fullName = 'Enter your full name.';
  if (!values.email.trim()) errors.email = 'Enter your email address.';
  else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.email.trim())) errors.email = 'Enter a valid email address.';
  if (!values.password.trim()) errors.password = 'Enter your password.';
  else if (mode === 'signup' && values.password.length < PASSWORD_MINIMUM) {
    errors.password = `Use at least ${PASSWORD_MINIMUM} characters.`;
  }
  if (mode === 'signup') {
    if (!values.confirmPassword) errors.confirmPassword = 'Confirm your password.';
    else if (values.confirmPassword !== values.password) errors.confirmPassword = 'The passwords must match.';
  }
  return errors;
}
