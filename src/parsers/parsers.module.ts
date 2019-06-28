import { Module } from '@nestjs/common';
import { SocketModule } from '../socket/socket.module';
import { ApiModule } from '../api/api.module';
import { ApiService } from '../api/api.service';
import { NormalizerModule } from '../normalizer/normalizer.module';
import { ConfigService } from 'nestjs-config';
import { LoggerService } from '../logger/logger.service';
import { NormalizerService } from '../normalizer/normalizer.service';
import { SocketService } from '../socket/socket.service';
import { HolyChordsService } from './holychords/holychords.service';

export const parserFactory = {
    provide: 'parser',
    useFactory: (
        configService: ConfigService,
        logger: LoggerService,
        normalizer: NormalizerService,
        socketService: SocketService,
        apiService: ApiService,
    ) => {
        const parserName = configService.get('parser.name');
        let parserService;

        switch (parserName) {
            case 'holychords':
                parserService = HolyChordsService;
                break;
        }

        return new parserService(
            logger,
            normalizer,
            socketService,
            configService,
            apiService,
        );
    },
    inject: [
        ConfigService,
        LoggerService,
        NormalizerService,
        SocketService,
        ApiService,
    ],
};

@Module({
    imports: [SocketModule, ApiModule, NormalizerModule],
    providers: [parserFactory],
    exports: ['parser'],
})
export class ParsersModule { }
