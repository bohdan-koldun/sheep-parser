import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ConfigService } from 'nestjs-config';
import { LoggerService } from './logger/logger.service';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    logger: false,
  });
  app.useLogger(app.get(LoggerService));
  const configService: ConfigService = app.get(ConfigService);
  await app.listen(configService.get('app.port'));
}
bootstrap();
