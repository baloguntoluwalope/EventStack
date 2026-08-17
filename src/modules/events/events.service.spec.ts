import { Types } from 'mongoose';
import { EventsService } from './events.service';

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
        defaultSections: [
          { type: 'hero', content: { heading: 'Welcome' }, order: 0, visible: true },
          { type: 'eventDetails', defaultContent: { title: 'Event details' }, order: 1, visible: true },
          { type: 'quotes', defaultContent: { text: 'Some quote' }, order: 2, visible: true },
          { type: 'footer', content: { text: 'Thanks' }, order: 3, visible: true },
        ],
      }),
    };

    const sectionsService = {
      createMany: jest.fn().mockResolvedValue([]),
    };

    const service = new EventsService(
      eventRepo as any,
      slugService as any,
      { emit: jest.fn() } as any,
      templatesService as any,
      sectionsService as any,
    );

    await service.create(orgId, creatorId, {
      title: 'Sample Event',
      templateId,
    } as any);

    expect(sectionsService.createMany).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({ type: 'hero' }),
        expect.objectContaining({ type: 'footer' }),
      ]),
    );

    const createdSections = sectionsService.createMany.mock.calls[0][0];
    expect(createdSections.map((section: any) => section.type)).toEqual(['hero', 'footer']);
  });
});
