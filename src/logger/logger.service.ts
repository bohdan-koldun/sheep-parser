import { Injectable } from '@nestjs/common';
import * as winston from 'winston';
import * as chalk from 'chalk';
import * as PrettyError from 'pretty-error';
import { LoggerOptions } from 'winston';
import { ConfigService } from 'nestjs-config';
import moment = require('moment');

@Injectable()
export class LoggerService {
  private readonly logger;
  private readonly prettyError = new PrettyError();
  private readonly logFile = this.configService.get('app.logFile');
  private context = 'Main';
  public loggerOptions: LoggerOptions = {
    transports: this.logFile
      ? [
          new winston.transports.File({
            filename: `error.${this.logFile}`,
            level: 'error',
          }),
          new winston.transports.File({
            filename: `info.${this.logFile}`,
            level: 'info',
          }),
        ]
      : [],
  };

  constructor(private readonly configService: ConfigService) {
    this.logger = (winston as any).createLogger(this.loggerOptions);
    this.prettyError.skipNodeFiles();
    this.prettyError.skipPackage('express', '@nestjs/common', '@nestjs/core');
  }

  configGlobal(options?: LoggerOptions) {
    this.loggerOptions = options;
  }

  log(message: string): void {
    this.getStackTrace();
    const currentDate = new Date();
    this.logger.info(message, {
      timestamp: currentDate.toISOString(),
      context: this.context,
    });
    this.formatedLog('info', message);
  }

  debug(message: string): void {
    this.getStackTrace();
    const currentDate = new Date();
    this.logger.debug(message, {
      timestamp: currentDate.toISOString(),
      context: this.context,
    });
    this.formatedLog('debug', message);
  }

  error(message: string, error: Error): void {
    this.getStackTrace();
    const currentDate = new Date();
    this.logger.error(`${message} -> (${error || 'trace not provided !'})`, {
      timestamp: currentDate.toISOString(),
      context: this.context,
    });
    this.formatedLog('error', message, error);
  }

  warn(message: string): void {
    this.getStackTrace();
    const currentDate = new Date();
    this.logger.warn(message, {
      timestamp: currentDate.toISOString(),
      context: this.context,
    });
    this.formatedLog('warn', message);
  }

  overrideOptions(options: LoggerOptions) {
    this.logger.configure(options);
  }

  private getStackTrace() {
    this.context = undefined;
    const stackArr = Error().stack.match(/\w+/g);
    let count = 0;
    for (const word of stackArr) {
      if (count === 3) {
        this.context = word;
        break;
      }
      if (word === 'at') {
        count++;
      }
    }
  }

  private formatedLog(level: string, message: string, error?): void {
    let result = '';
    const color = chalk.default;
    const time = moment().format('l LT');

    switch (level) {
      case 'info':
        result = `[${color.blue('INFO')}] ${color.dim.yellow.bold.underline(
          time,
        )} [${color.green(this.context)}] ${message}`;
        break;
      case 'debug':
        result = `[${color.rgb(196, 16, 227)(
          'DEBUG',
        )}] ${color.dim.yellow.bold.underline(time)} [${color.green(
          this.context,
        )}] ${message}`;
        break;
      case 'error':
        result = `[${color.red('ERR')}] ${color.dim.yellow.bold.underline(
          time,
        )} [${color.green(this.context)}] ${message}`;
        break;
      case 'warn':
        result = `[${color.yellow('WARN')}] ${color.dim.yellow.bold.underline(
          time,
        )} [${color.green(this.context)}] ${message}`;
        break;
      default:
        break;
    }
    console.log(result);
    if (
      level === 'error' &&
      error &&
      this.configService._isDev()
    ) {
      console.log('\n');
      this.prettyError.render(error, true);
    }
  }
}
