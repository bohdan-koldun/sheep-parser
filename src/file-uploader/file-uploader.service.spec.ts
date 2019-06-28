import { Test, TestingModule } from '@nestjs/testing';
import { FileUploaderService } from './file-uploader.service';
import { ConfigModule } from 'nestjs-config';
import { LoggerModule } from '../logger/logger.module';
import * as path from 'path';

describe('FileUploaderService', () => {
    let service: FileUploaderService;

    beforeEach(async () => {
        const module: TestingModule = await Test.createTestingModule({
            imports: [
                ConfigModule.load(path.resolve(__dirname, '..', 'config', '**', '!(*.d).{ts,js}')),
                LoggerModule,
            ],
            providers: [FileUploaderService],
        }).compile();
        service = module.get<FileUploaderService>(FileUploaderService);
    });

    it('should be defined', () => {
        expect(service).toBeDefined();
    });

    it('downloadFileFromUrl() should be return underfined', async () => {
        expect.assertions(3);
        const resultNull = await service.downloadFileFromUrl(null);
        const resultEmpty = await service.downloadFileFromUrl('');
        const resultFirstSlash = await service.downloadFileFromUrl('/test');
        expect(resultNull).toBeUndefined();
        expect(resultEmpty).toBeUndefined();
        expect(resultFirstSlash).toBeUndefined();
    });
});
