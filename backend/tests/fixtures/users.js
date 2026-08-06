// Shared test data builders. Keeping these centralized means every test
// creates users the same way, and a schema change only needs updating here.
export const validSignupPayload = (overrides = {}) => ({
  name: "Ada Lovelace",
  email: "ada@example.com",
  password: "correct-horse-battery-staple",
  confirmPassword: "correct-horse-battery-staple",
  ...overrides,
});
