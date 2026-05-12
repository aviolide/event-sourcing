import { QueryRunner } from 'typeorm';

export async function refill(
  queryRunner: QueryRunner,
  toUserId: string,
  amount: number,
  currency: string,
): Promise<{ to: any }> {
  await queryRunner.connect();
  await queryRunner.startTransaction('REPEATABLE READ');

  try {
    const users = await queryRunner.query(
      `
        SELECT u.id
        FROM users u
        JOIN wallets w ON w."userId" = u.id
        WHERE u.id = $1
        FOR UPDATE
      `,
      [toUserId],
    );

    if (!Array.isArray(users) || users.length === 0) {
      throw new Error('User wallet not found');
    }

    await queryRunner.query(
      `
        UPDATE wallets
        SET balance = balance + $1
        WHERE "userId" = $2
      `,
      [amount, toUserId],
    );

    const insertResult = await queryRunner.query(
      `
        INSERT INTO payments ("fromUserId", "toUserId", amount, currency, description, status)
        VALUES ($1, $2, $3, $4, '', 'COMPLETED')
        RETURNING id, "fromUserId", "toUserId", amount, currency, description, status, "createdAt", "updatedAt"
      `,
      [toUserId, toUserId, amount, currency],
    );

    await queryRunner.commitTransaction();

    return { to: insertResult[0] };
  } catch (error) {
    try {
      await queryRunner.rollbackTransaction();
    } catch {
      // ignore rollback failure
    }

    try {
      await queryRunner.query(
        `
          INSERT INTO payments ("fromUserId", "toUserId", amount, currency, description, status)
          VALUES ($1, $2, $3, $4, '', 'FAILED')
          RETURNING id, "fromUserId", "toUserId", amount, currency, description, status, "createdAt", "updatedAt"
        `,
        [toUserId, toUserId, amount, currency],
      );
    } catch {
      // ignore failed payment insert failure and return original error
    }

    throw error;
  } finally {
    await queryRunner.release();
  }
}