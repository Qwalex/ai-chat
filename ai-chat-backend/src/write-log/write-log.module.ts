import { Global, Module } from '@nestjs/common';
import { WriteLogService } from './write-log.service';

@Global()
@Module({
  providers: [WriteLogService],
  exports: [WriteLogService],
})
export class WriteLogModule {}
