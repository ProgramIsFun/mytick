import swaggerJsdoc from 'swagger-jsdoc';

const spec = swaggerJsdoc({
  definition: {
    openapi: '3.0.0',
    info: { title: 'MyTick API', version: '1.1.0', description: 'Task management API' },
    servers: [{ url: '/api' }],
    components: {
      securitySchemes: {
        bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
        adminKey: { type: 'apiKey', in: 'header', name: 'x-admin-key' },
      },
      schemas: {
        Task: {
          type: 'object',
          properties: {
            _id: { type: 'string' },
            title: { type: 'string' },
            description: { type: 'string' },
            status: { type: 'string', enum: ['pending', 'in_progress', 'on_hold', 'done', 'abandoned'] },
            visibility: { type: 'string', enum: ['private', 'group', 'public'] },
            deadline: { type: 'string', format: 'date-time', nullable: true },
            blockedBy: { type: 'array', items: { type: 'string' } },
            userId: { type: 'string' },
            createdAt: { type: 'string', format: 'date-time' },
          },
        },
        User: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            email: { type: 'string' },
            username: { type: 'string' },
            name: { type: 'string' },
          },
        },
      },
    },
  },
  apis: ['./src/routes/*.ts'],
});

export default spec;
