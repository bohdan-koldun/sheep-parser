import { Test, TestingModule } from '@nestjs/testing';
import { ConfigModule, ConfigService } from 'nestjs-config';
import { LoggerService } from './logger.service';
import * as path from 'path';

describe('LoggerService', () => {
    let loggerService: LoggerService;
    let configService: ConfigService;
    let module: TestingModule;

    beforeEach(async () => {
        module = await Test.createTestingModule({
            imports: [ConfigModule.load(path.resolve(__dirname, '..', 'config', '**', '!(*.d).{ts,js}'))],
            providers: [LoggerService],
        }).compile();
    });

    it('should be defined', () => {
        loggerService = module.get<LoggerService>(LoggerService);
        expect(loggerService).toBeDefined();
    });

    it('injected ConfigService should be defined', () => {
        configService = module.get<ConfigService>(ConfigService);
        expect(configService).toBeDefined();
    });
});
