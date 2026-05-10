import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios, { AxiosInstance } from 'axios';

@Injectable()
export class DownstreamHttpClient {
  private readonly auth: AxiosInstance;
  private readonly wallet: AxiosInstance;
  private readonly payments: AxiosInstance;

  constructor(private readonly config: ConfigService) {
    this.auth = axios.create({ baseURL: this.config.getOrThrow('AUTH_SERVICE_URL') });
    this.wallet = axios.create({ baseURL: this.config.getOrThrow('WALLET_SERVICE_URL') });
    this.payments = axios.create({ baseURL: this.config.getOrThrow('PAYMENTS_SERVICE_URL') });
  }

  // AUTH
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

  // WALLET
  async getWallet(userId: string) {
    const { data } = await this.wallet.get(`/wallets/${userId}`);
    return data;
  }

  // PAYMENTS
  async transfer(payload: {
    toUserId: string;
    amount: number;
    currency: string;
    description?: string;
  }, bearer: string) {
    const { data } = await this.payments.post(
      `/payments/transfer`,
      payload,
      { headers: { Authorization: bearer } },
    );
    console.log("🚀 ~ DownstreamHttpClient ~ data:", data)
    return data;
  }
}
