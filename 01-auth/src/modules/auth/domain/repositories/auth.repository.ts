import { Result } from 'neverthrow';
import { BaseException } from '../../../../core/exceptions/base.exception';
import { RefreshToken } from '../../infrastructure/entities/auth.entity';

export type RefreshTokenResult = Promise<Result<RefreshToken, BaseException>>;
export type VoidResult = Promise<Result<void, BaseException>>;

export abstract class AuthRepository {
  abstract saveToken(token: RefreshToken): RefreshTokenResult;
  abstract revokeToken(tokenId: string): VoidResult;
  abstract findValidToken(token: string, userId: string): Promise<Result<RefreshToken | null, BaseException>>;
}