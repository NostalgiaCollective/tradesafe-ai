// Only the expected database denial establishes a passing negative test.
// Transport failures, missing functions and malformed queries must fail the test.
export function expectDatabaseError(result, expected) {
  const match = expected.startsWith('TS_')
    ? result?.error?.code === 'P0001' && result.error.message === expected
    : result?.error?.code === expected
  if (!match) throw new Error('Expected database denial was not observed')
}
export function expectSuccess(result) {
  if (!result || result.error) throw new Error('Expected successful database operation')
  return result.data
}
