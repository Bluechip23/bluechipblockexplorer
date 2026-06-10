import { buildApi } from './api';
import { loadConfig } from './config';
import { migrate, openDb } from './db';
import { runIngestLoop } from './ingest';

function main(): void {
    const cfg = loadConfig();
    const db = openDb(cfg.dbPath);
    migrate(db);

    const app = buildApi(db);
    app.listen(cfg.apiPort, () => {
        console.log(`[api] listening on :${cfg.apiPort} (db: ${cfg.dbPath})`);
    });

    runIngestLoop(db, cfg).catch((err) => {
        console.error('[ingest] fatal:', err);
        process.exit(1);
    });
}

main();
