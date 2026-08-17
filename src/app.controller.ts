import { Controller, Get } from '@nestjs/common';

@Controller()
export class AppController {
  @Get()
  getHealth() {
    return {
      status: 'ok',
      service: 'EventStack API',
      timestamp: new Date().toISOString(),
    };
  }

  @Get('health-check')
  getHealthCheck() {
    return {
      status: 'ok',
      service: 'EventStack API',
      timestamp: new Date().toISOString(),
    };
  }
}