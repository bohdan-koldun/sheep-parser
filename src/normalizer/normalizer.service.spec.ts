import { Test, TestingModule } from '@nestjs/testing';
import { NormalizerService } from './normalizer.service';
import { LoggerModule } from '../logger/logger.module';
import { FileUploaderModule } from '../file-uploader/file-uploader.module';
import { ConfigModule } from 'nestjs-config';
import * as path from 'path';

describe('NormalizerService', () => {
    let service: NormalizerService;

    beforeEach(async () => {
        const module: TestingModule = await Test.createTestingModule({
            imports: [
                LoggerModule,
                FileUploaderModule,
                ConfigModule.load(path.resolve(__dirname, '..', 'config', '**', '!(*.d).{ts,js}')),
            ],
            providers: [NormalizerService],
        }).compile();

        service = module.get<NormalizerService>(NormalizerService);
    });

    it('should be defined', () => {
        expect(service).toBeDefined();
    });
});
