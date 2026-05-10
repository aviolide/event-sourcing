import { Inject, Injectable } from '@nestjs/common';
import { UserRepository } from '../domain/repositories/user.repository';
import { UserInfrastructure } from '../infrastructure/user.infrastructure';
import { User } from '../domain/user';

@Injectable()
export class UserApplication {
  constructor(
    @Inject(UserInfrastructure)
    private readonly repository: UserRepository,
  ) {}

  async save(user: User) {
    return this.repository.save(user);
  }

  async findByEmail(email: string) {
    return this.repository.findByEmail(email);
  }

  async findById(id: string) {
    return this.repository.findById(id);
  }
}