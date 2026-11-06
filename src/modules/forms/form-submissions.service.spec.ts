import { ConfigService } from '@nestjs/config';
import { FormSubmissionsService } from './form-submissions.service';
import { FormStatus } from './schemas/form.schema';

describe('FormSubmissionsService', () => {
  const makeService = () => {
    const repo = {
      create: jest.fn(),
      findByIdempotencyKey: jest.fn(),
      countActiveByForm: jest.fn().mockResolvedValue(0),
      countActiveByFormAndShift: jest.fn().mockResolvedValue(0),
      updateById: jest.fn().mockImplementation(async (_id, data) => ({ id: _id, ...data })),
      findByPaymentReference: jest.fn(),
      findByProviderRef: jest.fn(),
      markPaid: jest.fn(),
    };

    const paymentProvider = {
      name: 'stub',
      charge: jest.fn(),
    };

    const emailProvider = {
      send: jest.fn().mockResolvedValue(undefined),
    };

    const qrCodeService = {
      generate: jest.fn().mockResolvedValue('https://example.test/qr.png'),
    };

    const formsService = {
      findByIdPublicOrThrow: jest.fn().mockResolvedValue({
        status: FormStatus.PUBLISHED,
        closesAt: null,
        maxSubmissions: null,
        requiresPayment: false,
        price: null,
        title: 'Demo form',
        fields: [{ key: 'emailAddress', label: 'Email', type: 'email', required: true }],
      }),
    };

    const membersService = {};

    const config = {
      get: jest.fn((key: string) => {
        if (key === 'appUrl') return 'https://example.test';
        return undefined;
      }),
    } as unknown as ConfigService;

    return {
      service: new FormSubmissionsService(
        repo as any,
        paymentProvider as any,
        emailProvider as any,
        qrCodeService as any,
        formsService as any,
        membersService as any,
        config,
      ),
      repo,
      emailProvider,
    };
  };

  it('uses the form email field as the submitter email when no explicit submitterEmail is provided', async () => {
    const { service, repo, emailProvider } = makeService();

    repo.create.mockResolvedValue({
      id: 'sub_123',
      submitterEmail: 'user@example.com',
      emailCopyRequested: true,
      paymentStatus: 'not_required',
      answers: { emailAddress: 'USER@example.com' },
      ticketCode: undefined,
      paymentReference: null,
    });

    await service.submit(
      'org_123',
      'form_123',
      {
        answers: { emailAddress: 'USER@example.com' },
        sendCopy: true,
      } as any,
    );

    expect(repo.create).toHaveBeenCalledWith(
      expect.objectContaining({
        submitterEmail: 'user@example.com',
        emailCopyRequested: true,
      }),
    );

    expect(emailProvider.send).toHaveBeenCalledWith(
      'user@example.com',
      expect.any(String),
      expect.any(String),
    );
  });
});
