import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios, { AxiosInstance } from 'axios';

@Injectable()
export class AuthHttpClient {
  private readonly auth: AxiosInstance;

  constructor(private readonly config: ConfigService) {
    this.auth = axios.create({ baseURL: this.config.getOrThrow('AUTH_SERVICE_URL') });
  }

  async register(dto: {
    fullName: string;
    email: string;
    phone?: string;
    password: string;
  }) {
    const { data } = await this.auth.post('/auth/register', dto);
    return data;
  }

  async login(dto: { identifier: string; password: string }) {
    const { data } = await this.auth.post('/auth/login', dto);
    return data;
  }

  async refresh(dto: { refreshToken: string }) {
    const { data } = await this.auth.post('/auth/refresh', dto);
    return data;
  }
}
