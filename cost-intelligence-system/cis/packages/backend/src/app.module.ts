import { Module } from '@nestjs/common';
import { PrismaModule } from './prisma/prisma.module';
import { SearchModule } from './search/search.module';
import { ProjectsModule } from './projects/projects.module';
import { VendorsModule } from './vendors/vendors.module';
import { ClientsModule } from './clients/clients.module';
import { CategoriesModule } from './categories/categories.module';
import { ImportModule } from './import/import.module';
import { AlertsModule } from './alerts/alerts.module';

@Module({
  imports: [
    PrismaModule,
    SearchModule,
    ProjectsModule,
    VendorsModule,
    ClientsModule,
    CategoriesModule,
    ImportModule,
    AlertsModule,
  ],
})
export class AppModule {}
