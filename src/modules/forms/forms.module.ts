import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Form, FormSchema } from './schemas/form.schema';
import { FormSubmission, FormSubmissionSchema } from '../forms/schemas/form-submission.schema';
import { MongooseFormRepository } from './repositories/form.repository';
import { MongooseFormSubmissionRepository } from './repositories/form-submission.repository';
import { FORM_REPOSITORY } from './interfaces/form-repository.interface';
import { FORM_SUBMISSION_REPOSITORY } from './interfaces/form-submission-repository.interface';
import { FormsService } from './forms.service';
import { FormsController } from '../forms/forms.controller' ;
import { FormSubmissionsService } from './form-submissions.service';
import { FormSubmissionsController } from './form-submission.controller'; 
import { MembersModule } from '../tenancy/members/members.module';
import { SlugService } from '../../common/utils/slug.util';
import { EventsModule } from '../events/events.module';
import { TournamentsModule } from '../sports/tournaments/tournaments.module';
import { PaymentsModule } from '../payments/payments.module';
import { EmailModule } from '../identity/email/email.module';
import { QrcodeModule } from '../qrcode/qrcode.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Form.name, schema: FormSchema },
      { name: FormSubmission.name, schema: FormSubmissionSchema },
    ]),
    MembersModule,
    EventsModule,
    TournamentsModule,
    PaymentsModule,
    EmailModule,
    QrcodeModule,
  ],
  providers: [
    { provide: FORM_REPOSITORY, useClass: MongooseFormRepository },
    { provide: FORM_SUBMISSION_REPOSITORY, useClass: MongooseFormSubmissionRepository },
    FormsService, FormSubmissionsService, SlugService,
  ],
  controllers: [FormsController, FormSubmissionsController],
  exports: [FormsService],
})
export class FormsModule {}