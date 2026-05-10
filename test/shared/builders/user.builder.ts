export class UserBuilder {
  private props = {
    fullName: 'Test User',
    email: `user-${Date.now()}-${Math.random().toString(36).slice(2, 7)}@test.com`,
    phone: `+1${Math.floor(Math.random() * 1000000000).toString().padStart(10, '0')}`,
    password: 'Password123',
  };

  static aUser(): UserBuilder {
    return new UserBuilder();
  }

  withEmail(email: string): UserBuilder {
    this.props.email = email;
    return this;
  }

  withName(name: string): UserBuilder {
    this.props.fullName = name;
    return this;
  }

  withPhone(phone: string): UserBuilder {
    this.props.phone = phone;
    return this;
  }

  withPassword(password: string): UserBuilder {
    this.props.password = password;
    return this;
  }

  build() {
    return { ...this.props };
  }
}
