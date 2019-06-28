import { Module } from '@nestjs/common';
import { NormalizerService } from './normalizer.service';
import { FileUploaderModule } from '../file-uploader/file-uploader.module';

@Module({
  imports: [FileUploaderModule],
  providers: [NormalizerService],
  exports: [NormalizerService],
})
export class NormalizerModule {}
