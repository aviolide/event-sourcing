export interface UserEssentials {
  phone: string;
  email: string;
  fullName: string;
}

export interface UserOptionals {
  id: string;
  passwordHash: string;
  createdAt: Date;
  updatedAt: Date;
}

export type UserProps = UserEssentials & Partial<UserOptionals>;

export class User {
  private readonly id: string;
  private phone: string;
  private email: string;
  private fullName: string;
  private passwordHash: string;
  private readonly createdAt: Date;
  private readonly updatedAt: Date;

  constructor(props: UserProps) {
    Object.assign(this, props);
  }

  properties(): UserProps {
    return {
      id: this.id,
      phone: this.phone,
      email: this.email,
      fullName: this.fullName,
      passwordHash: this.passwordHash,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
    };
  }

  setPasswordHash(hash: string) {
    this.passwordHash = hash;
  }
}