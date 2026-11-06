import { Types } from 'mongoose';
import { EventsService } from './events.service';
import { MongooseTemplateRepository } from './templates/repositories/template.repository';

describe('EventsService template seeding', () => {
  it('filters unsupported template section types before creating seeded sections', async () => {
    const orgId = new Types.ObjectId().toHexString();
    const creatorId = new Types.ObjectId().toHexString();
    const templateId = new Types.ObjectId().toHexString();
    const eventId = new Types.ObjectId().toHexString();

    const eventRepo = {
      findBySlug: jest.fn().mockResolvedValue(null),
      create: jest.fn().mockResolvedValue({ _id: eventId, id: eventId }),
    };

    const slugService = {
      resolveUnique: jest.fn().mockResolvedValue('sample-event'),
    };

    const templatesService = {
      findByIdOrThrow: jest.fn().mockResolvedValue({
        version: 27,
        defaultSections: [
          { type: 'hero', content: { heading: 'Welcome' }, order: 0, visible: true },
          { type: 'eventDetails', defaultContent: { title: 'Event details' }, order: 1, visible: true },
          { type: 'quotes', defaultContent: { text: 'Some quote' }, order: 2, visible: true },
          { type: 'footer', content: { text: 'Thanks' }, order: 3, visible: true },
        ],
      }),
    };

    const sectionsService = {
      create: jest.fn().mockResolvedValue({}),
      listForEvent: jest.fn().mockResolvedValue([]),
    };

    const pagesService = {
      ensureHomePage: jest
        .fn()
        .mockResolvedValue({ _id: new Types.ObjectId() }),
      listForEvent: jest.fn().mockResolvedValue([]),
      stampTemplateSource: jest.fn().mockResolvedValue(undefined),
    };

    const service = new EventsService(
      eventRepo as any,
      slugService as any,
      { emit: jest.fn() } as any,
      templatesService as any,
      sectionsService as any,
      pagesService as any,
      { create: jest.fn() } as any,
    );

    await service.create(orgId, creatorId, {
      title: 'Sample Event',
      templateId,
    } as any);

    expect(sectionsService.create).toHaveBeenCalledTimes(2);
    expect(
      sectionsService.create.mock.calls.map((call: any[]) => call[2].type),
    ).toEqual(['hero', 'footer']);
  });
});

describe('MongooseTemplateRepository template versions', () => {
  it('preserves a supplied positive template version on create', async () => {
    const save = jest.fn().mockResolvedValue({});
    const model = jest.fn().mockImplementation((data) => ({
      ...data,
      save,
    }));
    const repository = new MongooseTemplateRepository(model as any);

    await repository.create({ version: 27 } as any);

    expect(model).toHaveBeenCalledWith(
      expect.objectContaining({
        version: 27,
        deletedAt: null,
      }),
    );
    expect(save).toHaveBeenCalled();
  });

  it('defaults newly created templates to version 1', async () => {
    const save = jest.fn().mockResolvedValue({});
    const model = jest.fn().mockImplementation((data) => ({
      ...data,
      save,
    }));
    const repository = new MongooseTemplateRepository(model as any);

    await repository.create({} as any);

    expect(model).toHaveBeenCalledWith(
      expect.objectContaining({ version: 1 }),
    );
  });
});
