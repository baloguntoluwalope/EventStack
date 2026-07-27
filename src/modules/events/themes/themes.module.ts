import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Theme, ThemeSchema } from './schemas/theme.schema';
import { MongooseThemeRepository } from './repositories/theme.repository';
import { THEME_REPOSITORY } from './interfaces/theme-repository.interface';
import { ThemesService } from './themes.service';
import { ThemesController } from './themes.controller';
import { AuthModule } from 'src/modules/identity/auth/auth.module';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: Theme.name, schema: ThemeSchema }]),
    AuthModule,
  ],
  providers: [
    { provide: THEME_REPOSITORY, useClass: MongooseThemeRepository },
    ThemesService,
  ],
  controllers: [ThemesController],
  exports: [ThemesService],
})
export class ThemesModule {}