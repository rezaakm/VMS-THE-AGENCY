import { Module } from '@nestjs/common';
import { RfqsController } from './rfqs.controller';
import { RfqsService } from './rfqs.service';
import { RfqEmailService } from './rfqs.email.service';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [RfqsController],
  providers: [RfqsService, RfqEmailService],
  exports: [RfqsService],
})
export class RfqsModule {}
