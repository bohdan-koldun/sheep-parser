import { Injectable, OnModuleInit, Inject } from '@nestjs/common';
import { Schedule, InjectSchedule } from 'nest-schedule';
import { Parser } from '../parsers/abstract/parser.abstract';
import { ConfigService } from 'nestjs-config';
import { LoggerService } from '../logger/logger.service';

@Injectable()
export class DynamicScheduleService implements OnModuleInit {
  readonly startHour: number;

  constructor(
    @InjectSchedule() private readonly schedule: Schedule,
    @Inject('parser') private readonly parser: Parser,
    readonly configService: ConfigService,
    readonly logger: LoggerService,
  ) {
    this.startHour = Number(this.configService.get('parser.startHour'));
  }

  onModuleInit(): void {
    this.schedule.scheduleCronJob('start parser every day', `0 0 ${this.startHour} * * ?`, () => {
      this.logger.log(`Start scheduleCronJob(): '0 0 ${this.startHour} * * ?'`);
      this.parser.start();
      return false;
    }, {});

    this.schedule.scheduleTimeoutJob('start parser with server', 1000, () => {
      if (this.configService._isStartWithServer()) {
        this.logger.log('Start scheduleTimeoutJob()');
        this.parser.start();
      }
      return false;
    });
  }
}
