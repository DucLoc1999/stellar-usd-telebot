import type { HelloWorldResponse } from '../models/types';

export class HelloService {
  getHelloMessage(): HelloWorldResponse {
    // Business logic layer - could include database queries, external API calls, etc.
    return {
      message: 'Hello World',
    };
  }
}

export default new HelloService();
