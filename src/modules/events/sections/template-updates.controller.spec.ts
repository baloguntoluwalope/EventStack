import { TemplateUpdatesController } from './template-updates.controller';

describe('TemplateUpdatesController', () => {
  it('forwards force=true after organizer confirmation', () => {
    const sectionsService = {
      applyTemplateUpdate: jest.fn(),
    };
    const templatesService = {};
    const controller = new TemplateUpdatesController(
      sectionsService as any,
      templatesService as any,
    );

    controller.applyUpdate('org-id', 'section-id', { force: true });

    expect(sectionsService.applyTemplateUpdate).toHaveBeenCalledWith(
      'section-id',
      'org-id',
      templatesService,
      { force: true },
    );
  });

  it('does not force the update when confirmation was not provided', () => {
    const sectionsService = {
      applyTemplateUpdate: jest.fn(),
    };
    const controller = new TemplateUpdatesController(
      sectionsService as any,
      {} as any,
    );

    controller.applyUpdate('org-id', 'section-id');

    expect(sectionsService.applyTemplateUpdate).toHaveBeenCalledWith(
      'section-id',
      'org-id',
      {},
      { force: false },
    );
  });
});