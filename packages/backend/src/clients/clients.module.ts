import { Module } from '@nestjs/common';
import { ClientsController } from './clients.controller';
import { ClientsService } from './clients.service';
@Module({ providers: [ClientsService], controllers: [ClientsController], exports: [ClientsService] })
export class ClientsModule {}
