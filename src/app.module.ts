import { Module } from '@nestjs/common';
import * as path from 'path';

import { ConfigModule } from 'nestjs-config';
import { ScheduleModule } from 'nest-schedule';
import { LoggerModule } from './logger/logger.module';
import { ParsersModule } from './parsers/parsers.module';
import { DynamicScheduleService } from './schedule/schedule.service';

@Module({
    imports: [
        ConfigModule.load(path.resolve(__dirname, 'config', '**/!(*.d).{ts,js}')),
        ScheduleModule.register({}),
        LoggerModule,
        ParsersModule,
    ],
    providers: [
        DynamicScheduleService,
    ],
})
export class AppModule {}
