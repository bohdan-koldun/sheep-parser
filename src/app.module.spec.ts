import { Test, TestingModule } from '@nestjs/testing';
import { AppModule } from './app.module';
import { HolyChordsService } from './parsers/holychords/holychords.service';
import { ConfigService } from 'nestjs-config';

describe('AppModule', () => {
    const generateConfigService = (parser: string) => ({
        get: key => {
            switch (key) {
                case 'parser.name':
                    return parser;
                default:
                    return 'test';
            }
        },
    });

    it('should be provided HolyChordsService', async () => {
        expect.assertions(1);
        const moduleApp: TestingModule = await Test.createTestingModule({
            imports: [AppModule],
        })
            .overrideProvider(ConfigService)
            .useValue(generateConfigService('holychords'))
            .compile();

        const parser = moduleApp.get('parser');

        expect(parser).toBeInstanceOf(HolyChordsService);
    });
});
