import { FastifyInstance } from 'fastify';
import { getDb } from '../db/index';
import { getConnectedDeviceIds } from '../ws/index';

const START_TIME = Date.now();

export async function serverRoutes(app: FastifyInstance) {
  // GET /api/status
  app.get('/status', async () => {
    const db = getDb();
    const viewCount = (db.prepare('SELECT COUNT(*) as n FROM views').get() as any).n;
    const deviceCount = (db.prepare('SELECT COUNT(*) as n FROM devices').get() as any).n;
    return {
      status: 'ok',
      version: '0.1.0',
      uptime_seconds: Math.floor((Date.now() - START_TIME) / 1000),
      view_count: viewCount,
      device_count: deviceCount,
      connected_devices: getConnectedDeviceIds(),
    };
  });

  // GET /api/export  (full dump of all views, devices, datasources)
  app.get('/export', async () => {
    const db = getDb();
    const views = db.prepare('SELECT * FROM views').all().map((v: any) => ({
      ...v,
      widgets: JSON.parse(v.widgets ?? '[]'),
      tags: JSON.parse(v.tags ?? '[]'),
    }));
    const devices = db.prepare('SELECT * FROM devices').all();
    const deviceViews = db.prepare('SELECT * FROM device_views').all();
    const dataSources = db.prepare('SELECT id, name, type, url, enabled, created_at FROM data_sources').all();
    return {
      exported_at: new Date().toISOString(),
      version: 1,
      views,
      devices,
      device_views: deviceViews,
      data_sources: dataSources,
    };
  });

  // POST /api/import
  app.post<{ Body: any }>('/import', async (req, reply) => {
    const db = getDb();
    const { views = [], devices = [], device_views = [], data_sources = [] } = req.body as any;

    db.transaction(() => {
      const upsertView = db.prepare(`
        INSERT INTO views (id, name, description, width, height, background, widgets, tags, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
          name=excluded.name, description=excluded.description,
          width=excluded.width, height=excluded.height,
          background=excluded.background, widgets=excluded.widgets,
          tags=excluded.tags, updated_at=excluded.updated_at
      `);
      for (const v of views) {
        upsertView.run(v.id, v.name, v.description ?? null, v.width ?? 1920, v.height ?? 1080,
          v.background ?? null, JSON.stringify(v.widgets ?? []), JSON.stringify(v.tags ?? []),
          v.created_at ?? new Date().toISOString(), v.updated_at ?? new Date().toISOString());
      }

      const upsertDevice = db.prepare(`
        INSERT INTO devices (id, name, platform, description, default_view_id, created_at)
        VALUES (?, ?, ?, ?, ?, ?)
        ON CONFLICT(id) DO NOTHING
      `);
      for (const d of devices) {
        upsertDevice.run(d.id, d.name, d.platform ?? 'unknown', d.description ?? null,
          d.default_view_id ?? null, d.created_at ?? new Date().toISOString());
      }

      const upsertDv = db.prepare(`
        INSERT OR IGNORE INTO device_views (device_id, view_id, sort_order) VALUES (?, ?, ?)
      `);
      for (const dv of device_views) {
        upsertDv.run(dv.device_id, dv.view_id, dv.sort_order ?? 0);
      }

      const upsertDs = db.prepare(`
        INSERT INTO data_sources (id, name, type, url, enabled, created_at)
        VALUES (?, ?, ?, ?, ?, ?)
        ON CONFLICT(id) DO NOTHING
      `);
      for (const ds of data_sources) {
        upsertDs.run(ds.id, ds.name, ds.type ?? 'homeassistant', ds.url, ds.enabled ?? 1,
          ds.created_at ?? new Date().toISOString());
      }
    })();

    return {
      imported: {
        views: views.length,
        devices: devices.length,
        device_views: device_views.length,
        data_sources: data_sources.length,
      },
    };
  });
}
