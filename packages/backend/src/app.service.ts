import { Injectable } from '@nestjs/common';

@Injectable()
export class AppService {
  getHealth() {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      message: 'Vendor Management System API is running',
    };
  }

  getInfo() {
    return {
      name: 'Vendor Management System API',
      version: '1.0.0',
      description: 'Comprehensive VMS for managing vendors, purchase orders, contracts, and evaluations',
      author: 'rezaakm',
      documentation: '/api',
    };
  }
}

