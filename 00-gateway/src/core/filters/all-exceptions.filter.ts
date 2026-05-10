import { ArgumentsHost, Catch, ExceptionFilter, HttpException, Logger } from '@nestjs/common';

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger('GatewayException');

  catch(exception: any, host: ArgumentsHost) {
    this.logger.error(exception?.message || exception, exception?.stack);

    if (exception instanceof HttpException) {
      throw exception;
    }

    throw exception;
  }
}
