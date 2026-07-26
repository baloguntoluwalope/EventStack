import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { PlatformAdminGuard } from '../../../common/guards/platform-admin.guard';
import { ThemesService } from './themes.service';
import { CreateThemeDto } from './dto/create-theme.dto';
import { UpdateThemeDto } from './dto/update-theme.dto';

@ApiTags('themes')
@Controller('themes')
export class ThemesController {
  constructor(private readonly themesService: ThemesService) {}

  // 1. PUBLIC LISTING
  @Get()
  @ApiOperation({ summary: 'List available themes (public catalog — active only)' })
  list() {
    return this.themesService.list();
  }

  // 2. ADMIN LISTING (Must sit BEFORE wildcard ':id')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, PlatformAdminGuard)
  @Get('admin/all')
  @ApiOperation({ summary: 'List every theme including inactive/premium (platform admin)' })
  listAllForAdmin() {
    return this.themesService.listAllForAdmin();
  }

  // 3. WILDCARD GET
  @Get(':id')
  @ApiOperation({ summary: 'Get theme detail' })
  findOne(@Param('id') id: string) {
    return this.themesService.findByIdOrThrow(id);
  }

  // 4. ADMIN MUTATIONS
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, PlatformAdminGuard)
  @Post()
  @ApiOperation({ summary: 'Create a theme (platform admin only)' })
  create(@Body() dto: CreateThemeDto) {
    return this.themesService.create(dto);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, PlatformAdminGuard)
  @Patch(':id')
  @ApiOperation({ summary: 'Update or deactivate a theme (platform admin only)' })
  update(@Param('id') id: string, @Body() dto: UpdateThemeDto) {
    return this.themesService.update(id, dto);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, PlatformAdminGuard)
  @Delete(':id')
  @ApiOperation({ summary: 'Soft-delete a theme (platform admin only)' })
  remove(@Param('id') id: string) {
    return this.themesService.remove(id);
  }
}