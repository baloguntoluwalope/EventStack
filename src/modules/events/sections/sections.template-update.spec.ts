import { Types } from 'mongoose';
import { hashContent } from '../../../common/utils/content-hash.util';
import { SectionsService } from './sections.service';

describe('SectionsService.applyTemplateUpdate', () => {
  function createService() {
    const organizationId = new Types.ObjectId().toHexString();
    const sectionId = new Types.ObjectId().toHexString();
    const eventId = new Types.ObjectId();
    const templateId = new Types.ObjectId();
    const content = { heading: 'Updated by admin' };

    const sectionRepo = {
      findByIdForTenant: jest.fn().mockResolvedValue({
        eventId,
        customizedByOrganizer: true,
      }),
      updateById: jest.fn().mockImplementation(async (_id, changes) => changes),
    };
    const eventsService = {
      findByIdForTenantOrThrow: jest.fn().mockResolvedValue({ templateId }),
    };
    const templatesService = {
      findByIdOrThrow: jest.fn().mockResolvedValue({ version: 9 }),
    };

    const service = new SectionsService(
      sectionRepo as any,
      eventsService as any,
      {} as any,
    );
    (service as any).buildTemplateSectionMap = jest.fn().mockReturnValue(new Map());
    (service as any).resolveTemplateSection = jest.fn().mockResolvedValue({
      __templateSectionKey: 'home.hero',
      type: 'hero',
      order: 2,
      content,
    });

    return {
      service,
      sectionRepo,
      templatesService,
      organizationId,
      sectionId,
      content,
    };
  }

  it('replaces customized content and refreshes its template baseline when forced', async () => {
    const context = createService();

    await context.service.applyTemplateUpdate(
      context.sectionId,
      context.organizationId,
      context.templatesService,
      { force: true },
    );

    expect(context.sectionRepo.updateById).toHaveBeenCalledWith(
      context.sectionId,
      expect.objectContaining({
        content: context.content,
        customizedByOrganizer: false,
        sourceTemplateVersion: 9,
        sourceTemplateContentHash: hashContent(context.content),
      }),
    );
  });

  it('protects customized content unless the update is forced', async () => {
    const context = createService();

    await expect(
      context.service.applyTemplateUpdate(
        context.sectionId,
        context.organizationId,
        context.templatesService,
      ),
    ).rejects.toThrow('Explicitly force the template update');

    expect(context.sectionRepo.updateById).not.toHaveBeenCalled();
  });
});