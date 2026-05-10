import { DataSource } from 'typeorm';

export async function assertNoNegativeBalances(
  dataSource: DataSource,
): Promise<void> {
  const rows = await dataSource.query(
    `SELECT id, balance FROM wallets WHERE balance::numeric < 0`,
  );
  expect(rows).toHaveLength(0);
}

export async function assertTotalMoneyConserved(
  dataSource: DataSource,
  expectedTotal: number,
): Promise<void> {
  const result = await dataSource.query(
    `SELECT COALESCE(SUM(balance::numeric), 0) as total FROM wallets`,
  );
  const total = parseFloat(result[0].total);
  expect(total).toBe(expectedTotal);
}

export async function assertUniqueEmails(
  dataSource: DataSource,
): Promise<void> {
  const rows = await dataSource.query(
    `SELECT email, COUNT(*) as count FROM users GROUP BY email HAVING COUNT(*) > 1`,
  );
  expect(rows).toHaveLength(0);
}

export async function assertPaymentConsistency(
  dataSource: DataSource,
): Promise<void> {
  const invalidPayments = await dataSource.query(
    `SELECT id FROM payments WHERE status NOT IN ('PENDING', 'COMPLETED', 'FAILED')`,
  );
  expect(invalidPayments).toHaveLength(0);
}

export async function assertWalletCount(
  dataSource: DataSource,
  expected: number,
): Promise<void> {
  const result = await dataSource.query(
    `SELECT COUNT(*) as count FROM wallets`,
  );
  expect(parseInt(result[0].count, 10)).toBe(expected);
}
