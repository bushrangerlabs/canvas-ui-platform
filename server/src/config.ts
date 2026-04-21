import 'dotenv/config';

export const config = {
  port: parseInt(process.env.PORT ?? '3100'),
  host: process.env.HOST ?? '0.0.0.0',
  dbPath: process.env.DB_PATH ?? './data/canvas-ui.db',
  dataDir: process.env.DATA_DIR ?? './data',
  imagesDir: process.env.IMAGES_DIR ?? './data/images',
  jwtSecret: process.env.JWT_SECRET ?? 'canvas-ui-change-this-in-production',
  adminUser: process.env.ADMIN_USER ?? 'admin',
  adminPassword: process.env.ADMIN_PASSWORD ?? 'canvas-ui',
  corsOrigins: process.env.CORS_ORIGINS ?? '*',
};
