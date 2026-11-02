"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.loadConfig = loadConfig;
function envInt(name, fallback) {
    const raw = process.env[name];
    if (!raw)
        return fallback;
    const n = parseInt(raw, 10);
    if (!Number.isFinite(n))
        throw new Error(`${name} must be an integer, got "${raw}"`);
    return n;
}
function loadConfig() {
    return {
        port: envInt('PROFILES_PORT', 4317),
        dbPath: process.env.PROFILES_DB || './profiles.db',
        rpcUrl: (process.env.PROFILES_RPC || 'https://rpc.osmotest5.osmosis.zone').replace(/\/+$/, ''),
        rateLimitPerMin: envInt('RATE_LIMIT_PER_MIN', 300),
        subscriptionDays: envInt('PROFILES_SUBSCRIPTION_DAYS', 30),
    };
}
//# sourceMappingURL=config.js.map