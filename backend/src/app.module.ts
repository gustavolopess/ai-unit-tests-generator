import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { CoverageModule } from './coverage/coverage.module';

@Module({
  imports: [CoverageModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
