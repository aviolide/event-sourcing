import { Result } from 'neverthrow';
import { BaseException } from '../../../../core/exceptions/base.exception';
import { User } from '../user';

export type UserResult = Promise<Result<User, BaseException>>;
export type OptionalUserResult = Promise<Result<User | null, BaseException>>;

export abstract class UserRepository {
  abstract save(user: User): UserResult;
  abstract findByEmail(email: string): OptionalUserResult;
  abstract findById(id: string): OptionalUserResult;
}