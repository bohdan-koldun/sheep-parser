import { Inject, Injectable } from '@nestjs/common';
import * as socket from 'socket.io-client';
import { ConfigService } from 'nestjs-config';
import { NormalizedSong} from '../parsers/abstract/interfaces/normalized.song.interface';
import { LoggerService } from '../logger/logger.service';

@Injectable()
export class SocketService {
    private socket;
    @Inject()
    private readonly logger: LoggerService;

    constructor(private readonly configService: ConfigService) {
        this.socketConnect();
    }

    addListener(event: string, cb): void {
        this.socket.on(event, cb);
    }

    async emitEvent(event: string, data: any): Promise<any> {
        return new Promise(resolve => {
            this.socket.emit(event, data, response => {
                resolve(response);
            });
        });
    }

    sendData(data: NormalizedSong) {
       this.emitEvent('new parsed song', data);
    }

    async finishSending() {
        await this.emitEvent('last parsed song', {});
        this.socket.disconnect();
    }

    async reconect() {
        this.socketConnect();
    }

    private socketConnect() {
        this.socket = socket.connect(this.configService.get('socket.appUrl'));
        this.socket.on('connect', () => {
            this.logger.log(
                'socket connected to ' + this.configService.get('socket.appUrl'),
            );
        });
    }
}
