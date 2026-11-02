# Deploying the backend services

The website is static and deploys to GitHub Pages on every push to `main`
(`.github/workflows/deploy.yml`). Two small services back its dynamic
features and need a host of their own:

| Service | Port | Backs | Data |
|---|---|---|---|
| `indexer/` | 4316 | price/volume charts, trade feed, wallet history, creator statements, fast subscription discovery | `bluechip-indexer.db` (rebuildable from the chain) |
| `server/` (profiles) | 4317 | creator names, link-in-bio pages, gated links, the subscriber feed | `profiles.db` (**not** rebuildable — back it up) |

Both are Node processes with a SQLite file each. This folder runs them
together with Docker Compose behind Caddy, which handles HTTPS. The site
is served over HTTPS, so browsers refuse plain-HTTP calls to the
services; TLS is not optional.

## First deployment (can be done now, on testnet)

1. **A machine.** Any small VM with Docker and ports 80/443 open. One
   vCPU and 1 GB of RAM is plenty; give the disk a few GB for the two
   databases and Caddy's certificates.
2. **Two DNS names** pointing at it, e.g. `indexer.yourdomain.com` and
   `profiles.yourdomain.com`. Caddy requests certificates on first start,
   so the records must resolve before `up`.
3. **An RPC endpoint.** See [RPC endpoints](#rpc-endpoints) below.
4. Configure and start:

   ```bash
   git clone https://github.com/Bluechip23/bluechipblockexplorer
   cd bluechipblockexplorer/deploy
   cp .env.example .env
   # edit .env: RPC_URL, FACTORY_ADDRESS, START_HEIGHT, the two hostnames, ACME_EMAIL
   docker compose up -d --build
   ```

5. Check:

   ```bash
   curl https://indexer.yourdomain.com/health
   curl https://profiles.yourdomain.com/health
   docker compose logs -f indexer     # "indexed through height ..." lines
   ```

6. **Point the website at them.** In the GitHub repository, Settings →
   Secrets and variables → Actions → Variables, set
   `REACT_APP_INDEXER_URL=https://indexer.yourdomain.com` and
   `REACT_APP_PROFILES_URL=https://profiles.yourdomain.com`, then push to
   `main` (or re-run the Pages workflow). Until these are set the
   published site falls back to `http://localhost:…` and every
   indexer/profiles feature degrades.

## Approval day: switching to mainnet

Once the governance proposal passes and the factory and router are
instantiated on `osmosis-1`:

1. Note the factory's instantiate transaction and its **block height**.
2. Indexer: the database holds testnet history and must be reset.

   ```bash
   docker compose stop indexer
   docker compose rm -f indexer
   docker volume rm deploy_indexer-data
   # edit .env: RPC_URL -> mainnet, FACTORY_ADDRESS -> mainnet factory,
   #            START_HEIGHT -> the factory's instantiate height
   docker compose up -d --build indexer
   ```

   Do this the same day the factory goes live: the backfill is only the
   blocks since instantiation, and the RPC node must still have them
   (check the endpoint's `earliest_block_height`, see below).
3. Profiles service: nothing to reset. `RPC_URL` changing in `.env` is
   enough — `docker compose up -d profiles` restarts it. Creators who set
   up a profile before mainnet registered a testnet pool address and
   need to edit it to their mainnet pool.
4. Website: set the repository variables `REACT_APP_NETWORK=mainnet`,
   `REACT_APP_FACTORY_ADDRESS`, `REACT_APP_ROUTER_ADDRESS`, and the
   site's own `REACT_APP_RPC_ENDPOINT` / `REACT_APP_API_ENDPOINT`
   (public or domain-restricted endpoints — this bundle is public), then
   push.
5. Widget: creators embedding the subscribe button call
   `BluechipWidget.init({ chainId: "osmosis-1", ... })` as described in
   `widget/README.md`.

## RPC endpoints

Every RPC setting is the address of an **Osmosis node**: the Tendermint
JSON-RPC interface (`status`, `block`, `block_results`, contract
queries) and, for the website only, the REST/LCD interface (bank
balances, token holders). Options:

- **Public endpoints** — `https://rpc.osmosis.zone`,
  `https://osmosis-rpc.publicnode.com`, `https://osmosis.drpc.org`. Free,
  shared rate limits, limited history.
- **Keyed provider endpoint** — e.g. dRPC `https://lb.drpc.live/osmosis/<key>`.
  Your own quota. The key is a secret: it belongs in `deploy/.env` for
  the two services, never in the website's repository variables (the
  site bundle is public) unless the provider lets you restrict the key
  to your site's domain.
- **Your own node** — full control, no limits, more work.

The services only need the JSON-RPC interface. The website also needs a
REST endpoint (`REACT_APP_API_ENDPOINT`); if your RPC provider has no
REST interface for Osmosis, use `https://osmosis-rest.publicnode.com` or
`https://lcd.osmosis.zone` there — it serves a handful of light calls.

Before trusting an endpoint for the indexer, check its history depth and
that it is mainnet:

```bash
curl -s "$RPC_URL" -X POST -H 'Content-Type: application/json' \
  --data '{"jsonrpc":"2.0","method":"status","params":[],"id":1}' \
  | jq '.result.node_info.network, .result.sync_info.earliest_block_height, .result.sync_info.latest_block_height'
```

`earliest_block_height` must be at or below your `START_HEIGHT`. The
indexer makes two calls per block while tailing (one block every ~1.5 s
on Osmosis) and up to `BATCH_SIZE` heights in flight during backfill.

## Backups

`profiles.db` is the only data that cannot be rebuilt. Copy it off the
machine on a schedule, e.g. nightly:

```bash
docker run --rm -v deploy_profiles-data:/data -v "$PWD/backups:/backup" alpine \
  sh -c 'cp /data/profiles.db /backup/profiles-$(date +%F).db'
```

The indexer database can always be rebuilt from the chain by deleting
the volume and restarting with the right `START_HEIGHT`.

## Updating

```bash
git pull
docker compose up -d --build
```

Both services migrate their own database schema on startup, and the
indexer's cursor is committed with each block, so restarts are safe at
any moment.
