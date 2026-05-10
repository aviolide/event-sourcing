import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

// Guard = paso 2 del flujo NestJS
@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {}