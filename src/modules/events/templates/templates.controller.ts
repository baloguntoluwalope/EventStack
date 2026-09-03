import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { PlatformAdminGuard } from '../../../common/guards/platform-admin.guard';
import { TemplatesService } from './templates.service';
import { CreateTemplateDto } from './dto/create-template.dto';
import { UpdateTemplateDto } from './dto/update-template.dto';

@ApiTags('templates')
@Controller('templates')
export class TemplatesController {
  constructor(private readonly templatesService: TemplatesService) {}

  // 1. PUBLIC LISTING
  @Get()
  @ApiOperation({ summary: 'List available templates (public catalog — active only)' })
  list(@Query('category') category?: string) {
    return this.templatesService.list(category);
  }

  // 2. ADMIN LISTING (Must be placed BEFORE wildcard ':id')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, PlatformAdminGuard)
  @Get('admin/all')
  @ApiOperation({ summary: 'List every template including inactive/premium (platform admin)' })
  listAllForAdmin(@Query('category') category?: string) {
    return this.templatesService.listAllForAdmin(category);
  }

  // 3. WILDCARD GET (Placed after static sub-paths)
  @Get(':id')
  @ApiOperation({ summary: 'Get template detail' })
  findOne(@Param('id') id: string) {
    return this.templatesService.findByIdOrThrow(id);
  }

  // 4. ADMIN MUTATIONS
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, PlatformAdminGuard)
  @Post()
  @ApiOperation({ summary: 'Create a template (platform admin only)' })
  create(@Body() dto: CreateTemplateDto) {
    return this.templatesService.create(dto);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, PlatformAdminGuard)
  @Patch(':id')
  @ApiOperation({ summary: 'Update or deactivate a template (platform admin only)' })
  update(@Param('id') id: string, @Body() dto: UpdateTemplateDto) {
    return this.templatesService.update(id, dto);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, PlatformAdminGuard)
  @Delete(':id')
  @ApiOperation({ summary: 'Soft-delete a template (platform admin only)' })
  remove(@Param('id') id: string) {
    return this.templatesService.remove(id);
  }

  @Get(':id/preview')
  @ApiOperation({ summary: 'Render a template\'s own default pages/sections (no event required)' })
  async preview(@Param('id') id: string) {
    const template = await this.templatesService.findByIdOrThrow(id);

    if (template.defaultPages && template.defaultPages.length > 0) {
      return {
        event: { title: 'Your Event Name' },
        theme: null,
        pages: template.defaultPages.map((p, i) => ({
          id: `preview-page-${i}`, title: p.title, slug: p.slug, isHome: p.isHome, showInNav: true,
        })),
        sectionsByPage: Object.fromEntries(
          template.defaultPages.map((p, i) => [
            `preview-page-${i}`,
            p.sections.map((s, j) => ({ id: `preview-${i}-${j}`, type: s.type, order: s.order, content: s.content ?? {} })),
          ]),
        ),
      };
    }

    // Single-page template — unchanged shape, wrapped in the same
    // pages/sectionsByPage envelope so the frontend has one consistent
    // response format regardless of template type.
    const homePageId = 'preview-page-0';
    return {
      event: { title: 'Your Event Name' },
      theme: null,
      pages: [{ id: homePageId, title: 'Home', slug: '', isHome: true, showInNav: true }],
      sectionsByPage: {
        [homePageId]: template.defaultSections.map((s, i) => ({ id: `preview-${i}`, type: s.type, order: s.order, content: s.content ?? {} })),
      },
    };
  }
}