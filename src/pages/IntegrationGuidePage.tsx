import React from 'react';
import PageShell from '../components/universal/PageShell';
import {
    Box,
    Card,
    CardContent,
    Grid,
    Stack,
    Typography,
    Accordion,
    AccordionSummary,
    AccordionDetails,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    Paper,
    Alert,
} from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import CodeBlock from '../components/universal/CodeBlock';
import SectionCard from '../components/universal/DocSectionCard';

// The BlueChip contracts run on Osmosis: payments are OSMO (uosmo),
// addresses are osmo1..., and creator tokens are native TokenFactory
// denoms (factory/{pool_addr}/{subdenom}) — plain bank coins, not CW20
// contracts. Every snippet below reflects that wire format.

const widgetQuickStartCode = `<!-- 1. Load the BlueChip widget (self-contained, no other scripts needed) -->
<script src="https://cdn.jsdelivr.net/gh/Bluechip23/bluechipblockexplorer@main/widget/dist/bluechip-widget.min.js"><\/script>

<!-- 2. Subscribe button — the ONLY thing you edit is your pool address -->
<div data-bluechip-subscribe data-pool="osmo1YOUR_POOL_ADDRESS" data-amount="25"></div>

<!-- 3. Optional: gate content behind a subscription -->
<div data-bluechip-gate data-pool="osmo1YOUR_POOL_ADDRESS" data-min-usd="5">
    Subscriber-only content.
</div>`;

// Set a site-wide default pool (and optionally override endpoints) once,
// so individual buttons don't need data-pool repeated on each one.
const widgetInitCode = `<script src="https://cdn.jsdelivr.net/gh/Bluechip23/bluechipblockexplorer@main/widget/dist/bluechip-widget.min.js"><\/script>
<script>
  BluechipWidget.init({
    pool: "osmo1YOUR_POOL_ADDRESS",   // default pool for every widget on the page
    // rpc / rest / chainId default to Osmosis mainnet — override only if you self-host a node
  });
<\/script>

<!-- Now buttons can omit data-pool entirely -->
<div data-bluechip-subscribe data-amount="25"></div>`;

// Build your own UI with the same primitives the buttons use.
const widgetJsApiCode = `<script>
  // Connect Keplr (Osmosis ships with Keplr — no chain registration step)
  const { address } = await BluechipWidget.connect();

  // Subscribe: commit OSMO to a pool. Returns the tx hash.
  const { txHash } = await BluechipWidget.subscribe({
    pool: "osmo1YOUR_POOL_ADDRESS",
    amount: 25,                    // whole OSMO; converted to micro-units for you
  });

  // Check a wallet's subscription (read-only — no signing needed).
  const gate = await BluechipWidget.checkSubscription({
    pool: "osmo1YOUR_POOL_ADDRESS",
    address,                       // omit to use the connected wallet
    minUsd: 5,                     // threshold in lifetime USD committed
  });
  if (gate.subscribed) {
    console.log("Subscriber — $" + gate.totalUsd + " committed");
  }
<\/script>`;

// CosmJS ships no browser bundle (unpkg .../build/bundle.js 404s), so the
// manual path loads it as an ES module and exposes the global the
// snippets below expect.
const scriptTagsCode = `<!-- CosmJS — required for the hand-rolled snippets below.
     Bundler users: npm install @cosmjs/cosmwasm-stargate@0.32.4 instead. -->
<script type="module">
    import * as cosmwasm from "https://esm.sh/@cosmjs/cosmwasm-stargate@0.32.4";
    window.CosmWasmClient = cosmwasm;   // snippets use CosmWasmClient.SigningCosmWasmClient
    window.dispatchEvent(new Event("cosmjs-ready"));
<\/script>`;

const configCode = `<script>
// ============================================================
//  bluechip CONFIGURATION — EDIT THE POOL ADDRESS
// ============================================================
const bluechip_CONFIG = {
    // Chain settings — the BlueChip contracts are currently deployed on
    // the Osmosis TESTNET (osmo-test-5). When they ship on mainnet,
    // switch to: chainId "osmosis-1", chainName "Osmosis",
    // rpc https://rpc.osmosis.zone, rest https://lcd.osmosis.zone.
    chainId:        "osmo-test-5",
    chainName:      "Osmosis Testnet",
    rpc:            "https://rpc.osmotest5.osmosis.zone",
    rest:           "https://lcd.osmotest5.osmosis.zone",
    nativeDenom:    "uosmo",
    coinDecimals:   6,

    // Deployed testnet contracts (replace on mainnet):
    factoryAddress: "osmo1p93hcfzjnjfv0vtfxmunpqc25tq3p2vzh76hq3wxfz2zyayw4hzq4ac3vt",
    routerAddress:  "osmo1wwx4sw56hc7srmcv2cu2un58kg2k34t9zlmrqj2244glj26fsj6q2z8jy2",
    // Your creator pool — REPLACE THIS
    poolAddress:    "osmo1your_pool_address_here",
};
// Keplr ships with Osmosis MAINNET built in; for the osmo-test-5 testnet,
// suggest the chain once before enabling (harmless no-op on known chains).
</script>`;

const walletConnectionCode = `<script>
// ============================================================
//  WALLET CONNECTION
//  Stores: window.bluechipClient, window.bluechipAddress
// ============================================================

// Global wallet state
window.bluechipClient  = null;
window.bluechipAddress = "";

async function connectKeplrWallet() {
    // ---- Check if Keplr is installed ----
    if (!window.keplr || !window.getOfflineSigner) {
        var msg = document.getElementById("bluechip-wallet-status");
        if (msg) {
            msg.innerHTML =
                '<div style="padding:12px;background:#fff3cd;border:1px solid #ffc107;border-radius:6px;">' +
                '<strong>Keplr Wallet Required</strong><br>' +
                'Please install the Keplr browser extension to continue.<br><br>' +
                '<a href="https://www.keplr.app/get" target="_blank" ' +
                'style="color:#0d6efd;font-weight:bold;">Click here to install Keplr &rarr;</a>' +
                '</div>';
        }
        alert("Keplr wallet not detected!\\n\\nInstall it from: https://www.keplr.app/get");
        return false;
    }

    try {
        // Keplr knows Osmosis mainnet out of the box, but the osmo-test-5
        // TESTNET (where the contracts currently live) must be suggested
        // once. This is a harmless no-op for chains Keplr already knows.
        var osmo = {
            coinDenom: "OSMO", coinMinimalDenom: "uosmo", coinDecimals: 6,
        };
        await window.keplr.experimentalSuggestChain({
            chainId:   bluechip_CONFIG.chainId,
            chainName: bluechip_CONFIG.chainName,
            rpc:       bluechip_CONFIG.rpc,
            rest:      bluechip_CONFIG.rest,
            bip44:     { coinType: 118 },
            bech32Config: {
                bech32PrefixAccAddr:  "osmo",
                bech32PrefixAccPub:   "osmopub",
                bech32PrefixValAddr:  "osmovaloper",
                bech32PrefixValPub:   "osmovaloperpub",
                bech32PrefixConsAddr: "osmovalcons",
                bech32PrefixConsPub:  "osmovalconspub",
            },
            currencies:    [osmo],
            feeCurrencies: [Object.assign({}, osmo, {
                gasPriceStep: { low: 0.0025, average: 0.025, high: 0.04 },
            })],
            stakeCurrency: osmo,
        });
        await window.keplr.enable(bluechip_CONFIG.chainId);

        // Get signer and address
        var offlineSigner = window.getOfflineSigner(bluechip_CONFIG.chainId);
        var accounts      = await offlineSigner.getAccounts();
        var address       = accounts[0].address;

        // Connect the signing client
        var client = await CosmWasmClient.SigningCosmWasmClient.connectWithSigner(
            bluechip_CONFIG.rpc,
            offlineSigner
        );

        // Store globally
        window.bluechipClient  = client;
        window.bluechipAddress = address;

        // Update UI
        var statusEl = document.getElementById("bluechip-wallet-status");
        if (statusEl) {
            statusEl.innerHTML =
                '<div style="padding:8px 12px;background:#d4edda;border:1px solid #28a745;' +
                'border-radius:6px;font-family:monospace;word-break:break-all;">' +
                'Connected: ' + address + '</div>';
        }

        // Fetch balance
        var balance = await client.getBalance(address, bluechip_CONFIG.nativeDenom);
        var balanceEl = document.getElementById("bluechip-balance");
        if (balanceEl) {
            var human = (parseInt(balance.amount) / Math.pow(10, bluechip_CONFIG.coinDecimals)).toFixed(6);
            balanceEl.textContent = human + " OSMO";
        }

        return true;
    } catch (err) {
        console.error("Wallet connection failed:", err);
        var statusEl = document.getElementById("bluechip-wallet-status");
        if (statusEl) {
            statusEl.innerHTML =
                '<div style="padding:8px 12px;background:#f8d7da;border:1px solid #dc3545;' +
                'border-radius:6px;">Connection failed: ' + err.message + '</div>';
        }
        return false;
    }
}
</script>`;

const connectButtonCode = `<!-- CONNECT WALLET BUTTON — Copy this wherever you want it -->
<div style="margin:16px 0;">
    <button onclick="connectKeplrWallet()"
            style="padding:12px 24px;font-size:16px;font-weight:bold;
                   background:#4CAF50;color:white;border:none;border-radius:8px;
                   cursor:pointer;">
        Connect Keplr Wallet
    </button>
    <div id="bluechip-wallet-status" style="margin-top:8px;"></div>
    <div id="bluechip-balance" style="margin-top:4px;font-weight:bold;"></div>
</div>`;

const subscribeCode = `<script>
async function handleSubscribe() {
    var statusEl = document.getElementById("subscribe-status");
    var txEl     = document.getElementById("subscribe-tx");
    statusEl.textContent = "";
    txEl.innerHTML       = "";

    // Ensure wallet is connected
    if (!window.bluechipClient || !window.bluechipAddress) {
        var connected = await connectKeplrWallet();
        if (!connected) return;
    }

    var amount = parseFloat(document.getElementById("subscribe-amount").value);
    if (isNaN(amount) || amount <= 0) {
        statusEl.innerHTML = '<div style="color:red;">Please enter a valid amount.</div>';
        return;
    }

    var spreadInput = document.getElementById("subscribe-spread").value;
    statusEl.innerHTML = '<div style="color:#1565c0;">Subscribing...</div>';

    try {
        // Convert to micro-units (1 OSMO = 1,000,000 uosmo)
        var microAmount = Math.floor(amount * 1000000).toString();

        // Check pool threshold status
        var thresholdStatus = await window.bluechipClient.queryContractSmart(
            bluechip_CONFIG.poolAddress,
            { is_fully_commited: {} }
        );
        var isThresholdCrossed = (thresholdStatus === "fully_committed");

        // Post-threshold, the commit swaps through the native Osmosis pool
        // and the contract REQUIRES an explicit belief_price (it rejects
        // null). Derive it from a live quote: if the price moves against
        // the user before the tx lands, the swap reverts instead of
        // filling at the worse price. Pre-threshold commits don't swap.
        var beliefPrice = null;
        if (isThresholdCrossed) {
            var sim = await window.bluechipClient.queryContractSmart(
                bluechip_CONFIG.poolAddress,
                { simulation: { offer_asset: {
                    info:   { bluechip: { denom: bluechip_CONFIG.nativeDenom } },
                    amount: microAmount
                } } }
            );
            var expectedOut = parseInt(sim.return_amount);
            if (!expectedOut || expectedOut <= 0) {
                statusEl.innerHTML = '<div style="color:red;">Could not quote this commit — try again.</div>';
                return;
            }
            // belief_price = offer / expected_out (offer-per-ask).
            beliefPrice = (parseInt(microAmount) / expectedOut).toFixed(18);
        }

        // Deadline: 20 minutes from now, in nanoseconds
        var deadlineNs = ((Date.now() + 20 * 60 * 1000) * 1000000).toString();

        // Build the commit message
        var msg = {
            commit: {
                asset: {
                    info:   { bluechip: { denom: bluechip_CONFIG.nativeDenom } },
                    amount: microAmount
                },
                transaction_deadline: deadlineNs,
                belief_price:         beliefPrice,
                max_spread:           (isThresholdCrossed && spreadInput) ? spreadInput : null
            }
        };

        // Attach the OSMO as funds
        var funds = [{ denom: bluechip_CONFIG.nativeDenom, amount: microAmount }];

        var result = await window.bluechipClient.execute(
            window.bluechipAddress,
            bluechip_CONFIG.poolAddress,
            msg,
            { amount: [], gas: "600000" },
            "Commit",
            funds
        );

        statusEl.innerHTML = '<div style="color:#2e7d32;font-weight:bold;">Success!</div>';
        txEl.innerHTML =
            '<div style="padding:10px;background:#e8f5e9;border:1px solid #4CAF50;' +
            'border-radius:6px;font-family:monospace;word-break:break-all;">' +
            '<strong>Tx Hash:</strong><br>' + result.transactionHash + '</div>';

    } catch (err) {
        console.error("Subscribe error:", err);
        statusEl.innerHTML = '<div style="color:red;">Error: ' + err.message + '</div>';
    }
}
</script>`;

const buyCode = `<script>
async function handleBuy() {
    var statusEl = document.getElementById("buy-status");
    var txEl     = document.getElementById("buy-tx");
    statusEl.textContent = "";
    txEl.innerHTML       = "";

    if (!window.bluechipClient || !window.bluechipAddress) {
        var connected = await connectKeplrWallet();
        if (!connected) return;
    }

    var amount = parseFloat(document.getElementById("buy-amount").value);
    if (isNaN(amount) || amount <= 0) {
        statusEl.innerHTML = '<div style="color:red;">Please enter a valid amount.</div>';
        return;
    }

    var spreadInput = document.getElementById("buy-spread").value;
    statusEl.innerHTML = '<div style="color:#1565c0;">Processing swap...</div>';

    try {
        var microAmount = Math.floor(amount * 1000000).toString();
        var deadlineNs  = ((Date.now() + 20 * 60 * 1000) * 1000000).toString();

        var offerAsset = {
            info:   { bluechip: { denom: bluechip_CONFIG.nativeDenom } },
            amount: microAmount
        };

        // Take a live quote and fix belief_price from it. simple_swap
        // accepts null, but setting it is what actually bounds
        // sandwiching — a front-run that moves the pool reverts the
        // swap instead of filling at the worse price.
        var beliefPrice = null;
        var sim = await window.bluechipClient.queryContractSmart(
            bluechip_CONFIG.poolAddress,
            { simulation: { offer_asset: offerAsset } }
        );
        var expectedOut = parseInt(sim.return_amount);
        if (expectedOut > 0) {
            beliefPrice = (parseInt(microAmount) / expectedOut).toFixed(18);
        }

        var msg = {
            simple_swap: {
                offer_asset:           offerAsset,
                belief_price:          beliefPrice,
                max_spread:            spreadInput || null,
                // Set to true to bypass the pool's spread safety cap. Leave
                // null in the standard buy flow; only flip on if the user
                // has explicitly opted into a higher max_spread than the cap.
                allow_high_max_spread: null,
                to:                    null,
                transaction_deadline:  deadlineNs
            }
        };

        var funds = [{ denom: bluechip_CONFIG.nativeDenom, amount: microAmount }];

        var result = await window.bluechipClient.execute(
            window.bluechipAddress,
            bluechip_CONFIG.poolAddress,
            msg,
            { amount: [], gas: "500000" },
            "Buy Token",
            funds
        );

        statusEl.innerHTML = '<div style="color:#2e7d32;font-weight:bold;">Success! Tokens purchased.</div>';
        txEl.innerHTML =
            '<div style="padding:10px;background:#e3f2fd;border:1px solid #1976d2;' +
            'border-radius:6px;font-family:monospace;word-break:break-all;">' +
            '<strong>Tx Hash:</strong><br>' + result.transactionHash + '</div>';

    } catch (err) {
        console.error("Buy error:", err);
        statusEl.innerHTML = '<div style="color:red;">Error: ' + err.message + '</div>';
    }
}
</script>`;

const sellCode = `<script>
async function handleSell() {
    var statusEl = document.getElementById("sell-status");
    var txEl     = document.getElementById("sell-tx");
    statusEl.textContent = "";
    txEl.innerHTML       = "";

    if (!window.bluechipClient || !window.bluechipAddress) {
        var connected = await connectKeplrWallet();
        if (!connected) return;
    }

    var tokenDenom  = document.getElementById("sell-token-denom").value.trim();
    var amount      = parseFloat(document.getElementById("sell-amount").value);
    var spreadInput = document.getElementById("sell-spread").value;

    if (!tokenDenom) {
        statusEl.innerHTML = '<div style="color:red;">Please enter the creator token denom (factory/...).</div>';
        return;
    }
    if (isNaN(amount) || amount <= 0) {
        statusEl.innerHTML = '<div style="color:red;">Please enter a valid amount.</div>';
        return;
    }

    statusEl.innerHTML = '<div style="color:#1565c0;">Processing swap...</div>';

    try {
        var microAmount = Math.floor(amount * 1000000).toString();
        var deadlineNs  = ((Date.now() + 20 * 60 * 1000) * 1000000).toString();

        var offerAsset = {
            info:   { creator_token: { denom: tokenDenom } },
            amount: microAmount
        };

        // Live quote → belief_price, same anti-sandwich guard as the buy.
        var beliefPrice = null;
        var sim = await window.bluechipClient.queryContractSmart(
            bluechip_CONFIG.poolAddress,
            { simulation: { offer_asset: offerAsset } }
        );
        var expectedOut = parseInt(sim.return_amount);
        if (expectedOut > 0) {
            beliefPrice = (parseInt(microAmount) / expectedOut).toFixed(18);
        }

        // The creator token is a NATIVE TokenFactory coin, so a sell is
        // the exact same simple_swap as a buy — executed on the POOL with
        // the creator denom attached as funds. (The old CW20 send-hook
        // path no longer exists.)
        var msg = {
            simple_swap: {
                offer_asset:           offerAsset,
                belief_price:          beliefPrice,
                max_spread:            spreadInput || null,
                // Same semantics as the buy path; leave null unless you've
                // surfaced an explicit override to the user.
                allow_high_max_spread: null,
                to:                    null,
                transaction_deadline:  deadlineNs
            }
        };

        var funds = [{ denom: tokenDenom, amount: microAmount }];

        var result = await window.bluechipClient.execute(
            window.bluechipAddress,
            bluechip_CONFIG.poolAddress,   // the pool contract, NOT a token contract
            msg,
            { amount: [], gas: "500000" },
            "Sell Token",
            funds
        );

        statusEl.innerHTML = '<div style="color:#2e7d32;font-weight:bold;">Success! Tokens sold.</div>';
        txEl.innerHTML =
            '<div style="padding:10px;background:#ffebee;border:1px solid #d32f2f;' +
            'border-radius:6px;font-family:monospace;word-break:break-all;">' +
            '<strong>Tx Hash:</strong><br>' + result.transactionHash + '</div>';

    } catch (err) {
        console.error("Sell error:", err);
        statusEl.innerHTML = '<div style="color:red;">Error: ' + err.message + '</div>';
    }
}
</script>`;

const crossTokenSwapCode = `<script>
// ============================================================
//  CROSS-TOKEN SWAP via the router contract.
//  Creator tokens never share a pool with each other — every
//  cross-token pair routes through OSMO. The router runs the
//  whole route atomically (max 3 hops) and enforces slippage on
//  the FINAL amount received via minimum_receive. It takes no
//  per-hop spread parameters; size minimum_receive from the
//  simulation below. Every hop's pool is validated against the
//  factory registry on-chain.
//
//  Creator tokens are native TokenFactory denoms, so whatever
//  the first hop offers (uosmo or a factory/... denom) is
//  attached to execute_multi_hop as plain bank funds — there is
//  no CW20 send path.
// ============================================================

// Add to bluechip_CONFIG:  routerAddress: "osmo1router_address_here",

async function crossTokenSwap(fromDenom, fromPool, toDenom, toPool, amountMicro, slippagePct) {
    // 1. Build the route: TOKEN_A -> OSMO -> TOKEN_B.
    //    (For OSMO -> TOKEN_B, keep only the second hop;
    //     for TOKEN_A -> OSMO, keep only the first.)
    var route = [
        {
            pool_addr:        fromPool,
            offer_asset_info: { creator_token: { denom: fromDenom } },
            ask_asset_info:   { bluechip: { denom: bluechip_CONFIG.nativeDenom } }
        },
        {
            pool_addr:        toPool,
            offer_asset_info: { bluechip: { denom: bluechip_CONFIG.nativeDenom } },
            ask_asset_info:   { creator_token: { denom: toDenom } }
        }
    ];

    // 2. Simulate to learn the expected output and size minimum_receive.
    var sim = await window.bluechipClient.queryContractSmart(
        bluechip_CONFIG.routerAddress,
        { simulate_multi_hop: { operations: route, offer_amount: amountMicro } }
    );
    console.log("Expected out:", sim.final_amount,
                "per-hop:", sim.intermediate_amounts,
                "impact:", sim.price_impact);

    var slipBps     = Math.round(slippagePct * 100);
    var minReceive  = (BigInt(sim.final_amount) * BigInt(10000 - slipBps) / BigInt(10000)).toString();
    var deadlineNs  = ((Date.now() + 20 * 60 * 1000) * 1000000).toString();

    // 3. Execute — attach whatever the FIRST hop offers as funds.
    var result = await window.bluechipClient.execute(
        window.bluechipAddress,
        bluechip_CONFIG.routerAddress,
        {
            execute_multi_hop: {
                operations:      route,
                minimum_receive: minReceive,
                deadline:        deadlineNs,
                recipient:       null
            }
        },
        { amount: [], gas: "900000" },
        "Cross-Token Swap",
        [{ denom: fromDenom, amount: amountMicro }]
    );

    return result.transactionHash;
}
</script>`;

const createPoolCode = `<script>
// =====================================================================
// Pool creation — the factory's single entry point: the commit
// (creator) pool.
//
// The new pool mints its own native TokenFactory denom
// (factory/{pool_address}/{subdenom}) and starts in a funding (commit)
// phase; once the USD threshold is crossed it seeds a NATIVE Osmosis
// GAMM pool and flips to active trading. The factory's own stored
// config is the source of truth for the commit threshold, fee splits,
// threshold-payout amounts, and lock caps — pool_msg only carries the
// token pair.
//
// A flat OSMO creation fee (factory config pool_creation_fee) is
// charged; attach it via the 7th argument to execute. Surplus is
// refunded to the caller in the same tx; if the fee is zero, attach
// nothing. The snippet reads the live fee from factory config.
// =====================================================================

async function handleCreatePool() {
    var statusEl = document.getElementById("create-pool-status");
    var txEl     = document.getElementById("create-pool-tx");
    statusEl.textContent = "";
    txEl.innerHTML       = "";

    if (!window.bluechipClient || !window.bluechipAddress) {
        var connected = await connectKeplrWallet();
        if (!connected) return;
    }

    statusEl.innerHTML = '<div style="color:#1565c0;">Creating your pool...</div>';

    try {
        var tokenName   = document.getElementById("pool-token-name").value.trim();
        var tokenSymbol = document.getElementById("pool-token-symbol").value.trim().toUpperCase();
        if (!tokenName || !tokenSymbol) {
            statusEl.innerHTML = '<div style="color:red;">Enter token name and symbol.</div>';
            return;
        }
        // Mirror the factory's validate_creator_token_info bounds.
        if (tokenName.length < 3 || tokenName.length > 50) {
            statusEl.innerHTML = '<div style="color:red;">Token name must be 3-50 printable ASCII characters.</div>';
            return;
        }
        if (!/^[A-Z0-9]{3,12}$/.test(tokenSymbol) || !/[A-Z]/.test(tokenSymbol)) {
            statusEl.innerHTML = '<div style="color:red;">Token symbol must be 3-12 chars (A-Z, 0-9) with at least one letter.</div>';
            return;
        }

        // Read the flat OSMO creation fee from live factory config and
        // attach exactly that. Zero fee = attach nothing (the handler
        // rejects funds in that case).
        var factoryConfig = await window.bluechipClient.queryContractSmart(
            bluechip_CONFIG.factoryAddress, { factory: {} }
        );
        var creationFee = (factoryConfig.factory && factoryConfig.factory.pool_creation_fee) || "0";
        var funds = (creationFee !== "0")
            ? [{ denom: bluechip_CONFIG.nativeDenom, amount: creationFee }]
            : [];

        var msg = {
            create: {
                pool_msg: {
                    // pool_token_info is the only field the factory
                    // consumes here — OSMO at index 0, the creator-token
                    // placeholder at index 1 (the pool overwrites it with
                    // its real factory/... denom). Order matters.
                    pool_token_info: [
                        { bluechip: { denom: bluechip_CONFIG.nativeDenom } },
                        { creator_token: { denom: "WILL_BE_CREATED_BY_FACTORY" } }
                    ]
                },
                token_info: {
                    name:    tokenName,
                    symbol:  tokenSymbol,
                    // Decimals are pinned to 6 by validate_creator_token_info;
                    // threshold-payout amounts and the mint cap are
                    // calibrated for this exact value.
                    decimal: 6
                }
            }
        };

        var result = await window.bluechipClient.execute(
            window.bluechipAddress,
            bluechip_CONFIG.factoryAddress,
            msg,
            { amount: [], gas: "2000000" },
            "Create Commit Pool",
            funds
        );

        statusEl.innerHTML =
            '<div style="color:#2e7d32;font-weight:bold;">Pool created!</div>';
        txEl.innerHTML =
            '<div style="padding:10px;background:#fff3e0;border:1px solid #ff6f00;' +
            'border-radius:6px;font-family:monospace;word-break:break-all;">' +
            '<strong>Tx Hash:</strong><br>' + result.transactionHash + '</div>';

    } catch (err) {
        console.error("Create pool error:", err);
        statusEl.innerHTML = '<div style="color:red;">Error: ' + err.message + '</div>';
    }
}
</script>`;

const queryPoolStatusCode = `async function checkPoolStatus(poolAddress) {
    var client = await CosmWasmClient.CosmWasmClient.connect(bluechip_CONFIG.rpc);

    var status = await client.queryContractSmart(poolAddress, {
        is_fully_commited: {}
    });

    if (status === "fully_committed") {
        console.log("Pool is active! Trading is enabled.");
        return true;
    } else {
        var raised = parseInt(status.in_progress.raised) / 1000000;
        var target = parseInt(status.in_progress.target) / 1000000;
        console.log("Pool funding: $" + raised.toFixed(2) + " / $" + target.toFixed(2));
        return false;
    }
}`;

const queryPoolStateCode = `async function getPoolState(poolAddress) {
    var client = await CosmWasmClient.CosmWasmClient.connect(bluechip_CONFIG.rpc);

    // Post-migration the reserves are read LIVE from the native Osmosis
    // GAMM pool (zero until the threshold crossing seeds it).
    // total_liquidity / nft_ownership_accepted are wire-compat legacy
    // fields — check the GAMM pool itself for LP-share data.
    var state = await client.queryContractSmart(poolAddress, { pool_state: {} });

    console.log("Reserve 0 (OSMO):",    parseInt(state.reserve0) / 1000000);
    console.log("Reserve 1 (Creator):", parseInt(state.reserve1) / 1000000);

    return state;
}`;

const querySubscriptionCode = `async function getSubscriptionInfo(poolAddress, walletAddress) {
    var client = await CosmWasmClient.CosmWasmClient.connect(bluechip_CONFIG.rpc);

    // NOTE: the query key is committing_info (double "t", double "m") —
    // it mirrors the contract's CommittingInfo variant exactly.
    var info = await client.queryContractSmart(poolAddress, {
        committing_info: { wallet: walletAddress }
    });

    if (info) {
        console.log("Total paid (USD):",  parseInt(info.total_paid_usd) / 1000000);
        console.log("Total paid (OSMO):", parseInt(info.total_paid_bluechip) / 1000000);
    } else {
        console.log("User has not subscribed yet.");
    }

    return info;
}`;

const queryTokenDenomCode = `async function getCreatorTokenDenom(poolAddress) {
    var client = await CosmWasmClient.CosmWasmClient.connect(bluechip_CONFIG.rpc);

    var pairInfo = await client.queryContractSmart(poolAddress, { pair: {} });

    // asset_infos is the field on the PoolDetails response. The creator
    // side carries a native TokenFactory DENOM (factory/{pool}/{sub}) —
    // there is no token contract address anymore.
    var assets = pairInfo.asset_infos || [];
    for (var i = 0; i < assets.length; i++) {
        if (assets[i].creator_token) {
            return assets[i].creator_token.denom;
        }
    }
    return null;
}

// A holder's balance is then a plain bank query — no CW20 involved:
async function getCreatorTokenBalance(walletAddress, tokenDenom) {
    var client = await CosmWasmClient.CosmWasmClient.connect(bluechip_CONFIG.rpc);
    var coin = await client.getBalance(walletAddress, tokenDenom);
    return parseInt(coin.amount) / 1000000;
}`;

const queryEarningsCode = `// Creator-facing rollup: threshold status and the time-locked "excess
// liquidity" claim (created when the pool raised more OSMO than the
// per-pool lock cap). Claim it once unlocked with
// { claim_creator_excess_liquidity: { transaction_deadline: null } }.
async function getCreatorEarnings(poolAddress) {
    var client = await CosmWasmClient.CosmWasmClient.connect(bluechip_CONFIG.rpc);
    var e = await client.queryContractSmart(poolAddress, { creator_earnings: {} });
    // { creator_wallet_address, excess: { bluechip_amount, token_amount,
    //   unlock_time, claimable_now } | null, is_threshold_hit,
    //   threshold_crossed_at }
    return e;
}

// Live state of the 500k-token committer airdrop after crossing.
// Returns null when no distribution is active.
async function getDistributionState(poolAddress) {
    var client = await CosmWasmClient.CosmWasmClient.connect(bluechip_CONFIG.rpc);
    var d = await client.queryContractSmart(poolAddress, { distribution_state: {} });
    if (d) {
        console.log("Remaining recipients:", d.distributions_remaining,
                    "stalled:", d.is_stalled);
    }
    return d;
}`;

const queryListPoolsCode = `// THE way to answer "what pools exist?" without an indexer. Page with
// start_after = last pool_id; a page shorter than limit is the end.
async function listPools() {
    var client = await CosmWasmClient.CosmWasmClient.connect(bluechip_CONFIG.rpc);
    var all = [], startAfter = null, LIMIT = 100;
    for (;;) {
        var page = await client.queryContractSmart(bluechip_CONFIG.factoryAddress, {
            pools: { start_after: startAfter, limit: LIMIT }
        });
        all = all.concat(page.pools);
        if (page.pools.length < LIMIT) break;
        startAfter = page.pools[page.pools.length - 1].pool_id;
    }
    // each entry: { pool_id, pool_addr, pool_token_info: [bluechip, creator_token] }
    return all;
}

// Convert an OSMO amount to USD with the exact same x/twap conversion the
// pools use (micro-units in, micro-USD out):
async function osmoToUsd(microOsmo) {
    var client = await CosmWasmClient.CosmWasmClient.connect(bluechip_CONFIG.rpc);
    var res = await client.queryContractSmart(bluechip_CONFIG.factoryAddress, {
        pool_factory_query: { convert_native_to_usd: { amount: microOsmo } }
    });
    return res;   // { amount, rate_used, timestamp }
}`;

const privClientGateCode = `<script>
// ============================================================
//  CLIENT-SIDE GATING (UX layer only — see the warning above)
//  Reads the wallet's on-chain commit record and unlocks parts
//  of the page based on how much they have committed.
// ============================================================

// Tier thresholds in micro-USD (6 decimals): $5,000 / $500.
var TIER_GOLD_MICRO_USD   = 5000000000;
var TIER_SILVER_MICRO_USD = 500000000;

// How recent the last commit must be to count as an "active"
// subscriber. The chain never expires commit records — recency
// is purely your site's policy.
var ACTIVE_WINDOW_DAYS = 30;

async function getSupporterStatus(walletAddress) {
    var client = await CosmWasmClient.CosmWasmClient.connect(bluechip_CONFIG.rpc);

    // committing_info returns null if this wallet has never committed,
    // otherwise the wallet's cumulative commit record for this pool.
    var info = await client.queryContractSmart(bluechip_CONFIG.poolAddress, {
        committing_info: { wallet: walletAddress }
    });

    if (!info) {
        return { isSupporter: false, tier: "none", isActive: false };
    }

    // total_paid_usd is micro-USD (1000000 = $1.00), as a string.
    var totalUsd = parseInt(info.total_paid_usd);
    var tier = "bronze";
    if (totalUsd >= TIER_GOLD_MICRO_USD)        tier = "gold";
    else if (totalUsd >= TIER_SILVER_MICRO_USD) tier = "silver";

    // last_committed is a timestamp in NANOSECONDS (as a string).
    var lastCommitMs = parseInt(info.last_committed) / 1000000;
    var ageDays      = (Date.now() - lastCommitMs) / 86400000;
    var isActive     = ageDays <= ACTIVE_WINDOW_DAYS;

    return {
        isSupporter: true,
        tier: tier,
        isActive: isActive,
        totalPaidUsd: totalUsd / 1000000,
        lastCommitted: new Date(lastCommitMs)
    };
}

// Example: unlock page sections after the wallet connects.
async function unlockSupporterContent() {
    if (!window.bluechipAddress) {
        var ok = await connectKeplrWallet();
        if (!ok) return;
    }

    var status = await getSupporterStatus(window.bluechipAddress);

    // Reveal/hide blocks by tier. Give gated blocks these IDs in
    // your HTML: supporter-content, gold-content, etc.
    var supporterEl = document.getElementById("supporter-content");
    if (supporterEl) {
        supporterEl.style.display =
            (status.isSupporter && status.isActive) ? "block" : "none";
    }
    var goldEl = document.getElementById("gold-content");
    if (goldEl) {
        goldEl.style.display = (status.tier === "gold") ? "block" : "none";
    }

    var label = document.getElementById("supporter-status");
    if (label) {
        label.textContent = status.isSupporter
            ? ("Supporter tier: " + status.tier +
               (status.isActive ? " (active)" : " (lapsed)"))
            : "Not a supporter yet — hit Subscribe above!";
    }
}
</script>

<!-- Example gated markup -->
<div id="supporter-status"></div>
<div id="supporter-content" style="display:none;">
    Subscriber-only content here (early videos, downloads, chat invite...)
</div>
<div id="gold-content" style="display:none;">
    Gold-tier extras here.
</div>`;

const privServerVerifyCode = `// ============================================================
//  STEP 1 (browser): prove wallet ownership with an ADR-36
//  signature. Anyone can READ the commit ledger, so for real
//  privileges (downloads, Discord roles, accounts) your server
//  must check the user actually controls the wallet.
// ============================================================
async function loginWithWallet() {
    await window.keplr.enable(bluechip_CONFIG.chainId);

    // 1. Ask your server for a one-time nonce (prevents replay).
    var nonceRes = await fetch("/api/auth/nonce", { method: "POST" });
    var nonce    = (await nonceRes.json()).nonce;

    var signer   = window.getOfflineSigner(bluechip_CONFIG.chainId);
    var accounts = await signer.getAccounts();
    var address  = accounts[0].address;

    // 2. Sign the nonce. signArbitrary = ADR-36: costs no gas and
    //    cannot be replayed as a real transaction.
    var message   = "bluechip-login:" + nonce;
    var signature = await window.keplr.signArbitrary(
        bluechip_CONFIG.chainId, address, message
    );

    // 3. Send to your server for verification.
    var verifyRes = await fetch("/api/auth/verify", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ address: address, message: message, signature: signature })
    });
    var session = await verifyRes.json();
    console.log("Privileges granted:", session);
}

// ============================================================
//  STEP 2 (your server — Node.js example, adapt to your stack):
//  verify the signature, then read the commit ledger over the
//  chain's REST (LCD) endpoint and grant privileges by tier.
//
//  npm install @keplr-wallet/cosmos
// ============================================================
const { verifyADR36Amino } = require("@keplr-wallet/cosmos");

const REST_ENDPOINT = "https://lcd.osmosis.zone";
const POOL_ADDRESS  = "osmo1your_pool_address_here";
const BECH32_PREFIX = "osmo";

// Smart-query a contract over REST: the query JSON is base64-encoded
// into the URL. Works from any backend language — only the base64
// and HTTP parts are Node-specific here.
async function queryCommitRecord(walletAddress) {
    const query   = { committing_info: { wallet: walletAddress } };
    const encoded = Buffer.from(JSON.stringify(query)).toString("base64");
    const url     = REST_ENDPOINT +
        "/cosmwasm/wasm/v1/contract/" + POOL_ADDRESS + "/smart/" + encodeURIComponent(encoded);
    const res     = await fetch(url);
    if (!res.ok) throw new Error("LCD query failed: " + res.status);
    return (await res.json()).data;   // null if the wallet never committed
}

// POST /api/auth/verify
async function handleVerify(req, res) {
    const { address, message, signature } = req.body;

    // 1. Check the nonce inside \`message\` is one you issued and unused,
    //    then mark it spent (not shown — use your session/DB layer).

    // 2. Verify the ADR-36 signature actually binds this address.
    const pubKeyBytes = Buffer.from(signature.pub_key.value, "base64");
    const sigBytes    = Buffer.from(signature.signature, "base64");
    const ok = verifyADR36Amino(
        BECH32_PREFIX, address, message, pubKeyBytes, sigBytes
    );
    if (!ok) return res.status(401).json({ error: "Bad signature" });

    // 3. Wallet ownership proven — now read the on-chain commit record.
    const record = await queryCommitRecord(address);
    if (!record) return res.json({ role: "visitor" });

    // 4. Map the record to YOUR privileges. total_paid_usd is micro-USD.
    const totalUsd = Number(record.total_paid_usd) / 1e6;
    const role = totalUsd >= 5000 ? "gold"
               : totalUsd >= 500  ? "silver"
               : "bronze";

    // 5. Issue your normal session (cookie / JWT / Discord role grant...).
    res.json({ role: role, totalUsd: totalUsd, lastCommitted: record.last_committed });
}`;

const privEventWatchCode = `// ============================================================
//  REAL-TIME: react the moment a commit lands on-chain.
//  Every commit emits a wasm event with these attributes:
//    action:    "commit"
//    phase:     "funding" (pre-threshold) | "active" (post-threshold) |
//               "threshold_crossing" | "threshold_hit_exact"
//    committer: wallet address that committed
//    commit_amount_bluechip: OSMO committed (micro-units)
//    total_commit_count, pool_contract, block_height, block_time
//    total_raised_after / total_bluechip_raised_after:
//               pool totals after a funding-phase commit
//               (micro-USD and net micro-OSMO)
//  NOTE: commit_amount_usd is NO LONGER emitted — for a USD value,
//  query committing_info (last_payment_usd) or convert via the
//  factory's convert_native_to_usd.
//  Subscribe over the RPC websocket and grant perks instantly
//  (unlock a chat, ping Discord, send a thank-you email...).
// ============================================================
var RPC_WS = bluechip_CONFIG.rpc.replace(/^http/, "ws") + "/websocket";

function watchCommits(onCommit) {
    var ws = new WebSocket(RPC_WS);

    ws.onopen = function () {
        ws.send(JSON.stringify({
            jsonrpc: "2.0",
            method:  "subscribe",
            id:      1,
            params:  {
                query: "tm.event='Tx' AND wasm.action='commit'" +
                       " AND wasm._contract_address='" + bluechip_CONFIG.poolAddress + "'"
            }
        }));
    };

    ws.onmessage = function (msgEvent) {
        var msg = JSON.parse(msgEvent.data);
        // Tendermint flattens attributes into result.events:
        // { "wasm.committer": ["osmo1..."], "wasm.commit_amount_bluechip": ["1000000"], ... }
        var events = msg.result && msg.result.events;
        if (!events || !events["wasm.committer"]) return;

        onCommit({
            committer:  events["wasm.committer"][0],
            phase:      (events["wasm.phase"] || [])[0],
            amountOsmo: parseInt((events["wasm.commit_amount_bluechip"] || ["0"])[0]) / 1000000,
            txHash:     (events["tx.hash"] || [])[0]
        });
    };

    // Reconnect on drop — RPC nodes recycle websocket connections.
    ws.onclose = function () { setTimeout(function () { watchCommits(onCommit); }, 5000); };
    return ws;
}

// Example: grant a perk the moment someone commits.
watchCommits(function (commit) {
    console.log(commit.committer + " committed " + commit.amountOsmo + " OSMO (" + commit.phase + ")");
    // -> POST to your backend, flip a UI flag, fire a Discord webhook, etc.
});

// No websocket? Poll the LCD for recent commit txs instead:
//   GET /cosmos/tx/v1beta1/txs?query=wasm.action='commit'
//        AND wasm._contract_address='<POOL>'&order_by=ORDER_BY_DESC&limit=20`;

const fullExampleCode = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>BlueChip - My Creator Page</title>
    <!-- CosmJS has no prebuilt browser bundle; load it as an ES module
         and expose the global the handlers below use. -->
    <script type="module">
        import * as cosmwasm from "https://esm.sh/@cosmjs/cosmwasm-stargate@0.32.4";
        window.CosmWasmClient = cosmwasm;
        window.dispatchEvent(new Event("cosmjs-ready"));
    <\/script>
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
            max-width: 600px;
            margin: 0 auto;
            padding: 20px;
            background: #fafafa;
        }
        h1 { text-align: center; color: #333; }
        .card {
            background: white;
            border-radius: 12px;
            padding: 20px;
            margin-bottom: 20px;
            box-shadow: 0 2px 8px rgba(0,0,0,0.1);
        }
        .card h3 { margin-top: 0; }
        input, select {
            width: 100%;
            padding: 10px;
            margin-bottom: 10px;
            border: 1px solid #ddd;
            border-radius: 6px;
            box-sizing: border-box;
            font-size: 14px;
        }
        .btn {
            width: 100%;
            padding: 12px;
            border: none;
            border-radius: 8px;
            font-size: 16px;
            font-weight: bold;
            color: white;
            cursor: pointer;
        }
        .btn-green  { background: #4CAF50; }
        .btn-blue   { background: #1976d2; }
        .btn-red    { background: #d32f2f; }
        .btn:hover  { opacity: 0.9; }
    </style>
</head>
<body>
    <h1>My Creator Page</h1>

    <!-- Wallet Connection -->
    <div class="card">
        <h3>Wallet</h3>
        <button class="btn btn-green" onclick="connectKeplrWallet()">
            Connect Keplr Wallet
        </button>
        <div id="bluechip-wallet-status" style="margin-top:8px;"></div>
        <div id="bluechip-balance" style="margin-top:4px;font-weight:bold;"></div>
    </div>

    <!-- Subscribe -->
    <div class="card">
        <h3>Subscribe</h3>
        <input id="subscribe-amount" type="number" placeholder="Amount (OSMO)" />
        <input id="subscribe-spread" type="text" value="0.005" placeholder="Max spread" />
        <button class="btn btn-green" onclick="handleSubscribe()">Subscribe</button>
        <div id="subscribe-status"></div>
        <div id="subscribe-tx"></div>
    </div>

    <!-- Buy -->
    <div class="card">
        <h3>Buy Creator Tokens</h3>
        <input id="buy-amount" type="number" placeholder="Amount (OSMO)" />
        <input id="buy-spread" type="text" value="0.005" placeholder="Max spread" />
        <button class="btn btn-blue" onclick="handleBuy()">Buy</button>
        <div id="buy-status"></div>
        <div id="buy-tx"></div>
    </div>

    <!-- Sell -->
    <div class="card">
        <h3>Sell Creator Tokens</h3>
        <input id="sell-token-denom" type="text" placeholder="Creator token denom (factory/...)" />
        <input id="sell-amount" type="number" placeholder="Amount" />
        <input id="sell-spread" type="text" value="0.005" placeholder="Max spread" />
        <button class="btn btn-red" onclick="handleSell()">Sell</button>
        <div id="sell-status"></div>
        <div id="sell-tx"></div>
    </div>

    <!--
        IMPORTANT: Paste the bluechip_CONFIG block, wallet connection script,
        and all handler functions from this guide here.
    -->
</body>
</html>`;


const tocItems = [
    { num: '1', title: 'Prerequisites — What You Need First', id: 'prerequisites' },
    { num: '2', title: 'Quick Start — The Embeddable Widget', id: 'quick-start' },
    { num: '3', title: 'Connecting to Keplr Wallet', id: 'keplr-wallet' },
    { num: '4', title: 'Subscribe Button (Commit)', id: 'subscribe' },
    { num: '5', title: 'Buy Button (Swap OSMO for Creator Tokens)', id: 'buy' },
    { num: '6', title: 'Sell Button (Swap Creator Tokens for OSMO)', id: 'sell' },
    { num: '7', title: 'Cross-Token Swaps (Router)', id: 'cross-token' },
    { num: '8', title: "Liquidity — It's a Native Osmosis Pool", id: 'liquidity' },
    { num: '9', title: 'Create a Pool', id: 'create-pool' },
    { num: '10', title: 'Querying Pool Info (Read-Only)', id: 'query-pool' },
    { num: '11', title: 'Granting Special Privileges to Committed Users', id: 'special-privileges' },
    { num: '12', title: 'Full Working Example Page', id: 'full-example' },
    { num: '13', title: 'Troubleshooting', id: 'troubleshooting' },
    { num: '14', title: 'Contract Address Reference', id: 'contract-reference' },
];


const IntegrationGuidePage: React.FC = () => {
    return (
        <PageShell>
                <Grid item xs={12} md={10} lg={8}>
                    <Stack spacing={2}>
                        {/* Header */}
                        <Card>
                            <CardContent>
                                <Typography variant="h4" gutterBottom sx={{ fontWeight: 'bold' }}>
                                    BlueChip Frontend Integration Guide
                                </Typography>
                                <Typography variant="body1" color="text.secondary" sx={{ mb: 2 }}>
                                    This guide is for website owners, content creators, and community builders
                                    who want to add BlueChip buttons and features to their own website.
                                    You do <strong>not</strong> need to be a programmer — just copy and paste
                                    the code blocks below.
                                </Typography>
                                <Alert severity="info">
                                    BlueChip runs on <strong>Osmosis</strong>: payments are made in{' '}
                                    <strong>OSMO</strong> (<code>uosmo</code>), addresses look like{' '}
                                    <code>osmo1...</code>, and creator tokens are native Osmosis{' '}
                                    <strong>TokenFactory</strong> denoms (<code>factory/osmo1pool.../utoken</code>) —
                                    ordinary bank coins, not token contracts. Once a pool crosses its funding
                                    threshold, its liquidity lives in a native Osmosis pool, so creator tokens
                                    can also be traded directly on app.osmosis.zone.
                                </Alert>
                            </CardContent>
                        </Card>

                        {/* Table of Contents */}
                        <Card>
                            <CardContent>
                                <Typography variant="h6" gutterBottom sx={{ fontWeight: 'bold' }}>
                                    Table of Contents
                                </Typography>
                                <Box component="ol" sx={{ pl: 3 }}>
                                    {tocItems.map((item) => (
                                        <li key={item.id}>
                                            <Typography
                                                component="a"
                                                href={`#${item.id}`}
                                                sx={{
                                                    color: 'primary.main',
                                                    textDecoration: 'none',
                                                    '&:hover': { textDecoration: 'underline' },
                                                }}
                                            >
                                                {item.title}
                                            </Typography>
                                        </li>
                                    ))}
                                </Box>
                            </CardContent>
                        </Card>

                        {/* Section 1: Prerequisites */}
                        <SectionCard id="prerequisites" number="1" title="Prerequisites — What You Need First">
                            <Typography variant="h6" gutterBottom>
                                For Your Visitors (People Using Your Website)
                            </Typography>
                            <Typography paragraph>
                                Your visitors will need the <strong>Keplr Wallet</strong> browser extension
                                to interact with BlueChip buttons on your site. Keplr supports Osmosis
                                mainnet out of the box; the current osmo-test-5 testnet deployment is
                                registered automatically by the connect snippet below.
                            </Typography>
                            <Typography variant="subtitle2" gutterBottom sx={{ fontWeight: 'bold' }}>
                                Install Keplr:
                            </Typography>
                            <Box component="ul" sx={{ mb: 2 }}>
                                <li><Typography><strong>Chrome / Brave / Edge:</strong> Install from Chrome Web Store</Typography></li>
                                <li><Typography><strong>Firefox:</strong> Install from Firefox Add-ons</Typography></li>
                                <li><Typography><strong>Mobile:</strong> Keplr Mobile App (iOS / Android)</Typography></li>
                            </Box>
                            <Alert severity="info" sx={{ mb: 2 }}>
                                If a visitor does not have Keplr installed, the code below will show them
                                a friendly message with a link to install it.
                            </Alert>

                            <Typography variant="h6" gutterBottom>
                                For You (The Website Owner)
                            </Typography>
                            <Box component="ol">
                                <li><Typography>A website where you can add HTML and JavaScript (WordPress, Squarespace with code injection, a custom site, etc.)</Typography></li>
                                <li><Typography>Your <strong>Pool Contract Address</strong> — the address of the creator pool on Osmosis (looks like <code>osmo1abc...xyz</code>)</Typography></li>
                                <li><Typography>Your <strong>Factory Contract Address</strong> — only needed if you want to create new pools</Typography></li>
                            </Box>
                        </SectionCard>

                        {/* Section 2: Quick Start */}
                        <SectionCard id="quick-start" number="2" title="Quick Start — The Embeddable Widget">
                            <Alert severity="success" sx={{ mb: 2 }}>
                                <strong>This is the recommended path for most creators.</strong> If all you want is a
                                Subscribe button and/or subscriber-gated content, you do not need any of the hand-written
                                code in the rest of this guide — drop in the widget below and you are done.
                            </Alert>
                            <Typography paragraph>
                                The widget is a single self-contained script (the wallet library is compiled in — nothing
                                else to load). Paste the script tag once, then drop a tagged <code>&lt;div&gt;</code>
                                wherever you want a button. The <strong>only value you must supply is your pool address</strong>;
                                the chain, endpoints, denom, and gas settings all default to Osmosis mainnet.
                            </Typography>
                            <CodeBlock code={widgetQuickStartCode} language="HTML" />

                            <Alert severity="info" sx={{ my: 2 }}>
                                <strong>Fully portable.</strong> The same two lines work on any website that lets you add
                                HTML — a custom site, WordPress, Webflow, a static page on Netlify or GitHub Pages. Nothing
                                is tied to a domain or an API key, so you can move the button between pages, run it on
                                several sites at once, or hand it to someone else to embed. Prefer not to depend on the CDN?
                                Download <code>widget/dist/bluechip-widget.min.js</code> and host it next to your own site.
                            </Alert>

                            <Typography variant="h6" gutterBottom sx={{ mt: 3 }}>Configuration attributes</Typography>
                            <Typography paragraph>
                                Configure each widget right on the element with <code>data-</code> attributes — no
                                JavaScript required:
                            </Typography>
                            <TableContainer component={Paper} variant="outlined" sx={{ mb: 2 }}>
                                <Table size="small">
                                    <TableHead>
                                        <TableRow>
                                            <TableCell><strong>Attribute</strong></TableCell>
                                            <TableCell><strong>Applies to</strong></TableCell>
                                            <TableCell><strong>What it does</strong></TableCell>
                                        </TableRow>
                                    </TableHead>
                                    <TableBody>
                                        <TableRow>
                                            <TableCell><code>data-bluechip-subscribe</code></TableCell>
                                            <TableCell>marker</TableCell>
                                            <TableCell>Renders a Subscribe (commit) button on this element.</TableCell>
                                        </TableRow>
                                        <TableRow>
                                            <TableCell><code>data-bluechip-gate</code></TableCell>
                                            <TableCell>marker</TableCell>
                                            <TableCell>Hides this element's content until the viewer's wallet qualifies.</TableCell>
                                        </TableRow>
                                        <TableRow>
                                            <TableCell><code>data-pool</code></TableCell>
                                            <TableCell>both</TableCell>
                                            <TableCell>Creator pool address. Falls back to the pool set in <code>init()</code>.</TableCell>
                                        </TableRow>
                                        <TableRow>
                                            <TableCell><code>data-amount</code></TableCell>
                                            <TableCell>subscribe</TableCell>
                                            <TableCell>Pre-filled amount, in whole OSMO.</TableCell>
                                        </TableRow>
                                        <TableRow>
                                            <TableCell><code>data-fixed-amount</code></TableCell>
                                            <TableCell>subscribe</TableCell>
                                            <TableCell>Hide the amount input and always commit <code>data-amount</code>.</TableCell>
                                        </TableRow>
                                        <TableRow>
                                            <TableCell><code>data-min-usd</code></TableCell>
                                            <TableCell>gate</TableCell>
                                            <TableCell>Minimum lifetime USD committed required to unlock.</TableCell>
                                        </TableRow>
                                        <TableRow>
                                            <TableCell><code>data-label</code></TableCell>
                                            <TableCell>both</TableCell>
                                            <TableCell>Custom button text.</TableCell>
                                        </TableRow>
                                        <TableRow>
                                            <TableCell><code>data-denied-text</code></TableCell>
                                            <TableCell>gate</TableCell>
                                            <TableCell>Message shown when the viewer doesn't qualify.</TableCell>
                                        </TableRow>
                                    </TableBody>
                                </Table>
                            </TableContainer>
                            <Typography paragraph>
                                The widget injects its own scoped styles (every class is prefixed <code>bcw-</code>, so
                                nothing leaks into or out of your page) and you can restyle it freely with your own CSS.
                            </Typography>

                            <Typography variant="h6" gutterBottom sx={{ mt: 3 }}>Set a default pool once</Typography>
                            <Typography paragraph>
                                If every button on a page points at the same pool, set it once with <code>init()</code> and
                                omit <code>data-pool</code> from the individual elements:
                            </Typography>
                            <CodeBlock code={widgetInitCode} language="HTML" />

                            <Typography variant="h6" gutterBottom sx={{ mt: 3 }}>JavaScript API (for custom UIs)</Typography>
                            <Typography paragraph>
                                The same primitives the buttons use are exposed on <code>window.BluechipWidget</code>, so
                                you can wire your own elements instead of the built-in buttons:
                            </Typography>
                            <CodeBlock code={widgetJsApiCode} language="JavaScript" />

                            <Alert severity="warning" sx={{ mt: 2 }}>
                                The <code>data-bluechip-gate</code> / <code>checkSubscription</code> gate is a
                                <strong> client-side convenience</strong> — it hides DOM until the check passes, which is
                                perfect for perks and soft-gating, but anyone can bypass it with browser dev tools. To
                                protect content that truly matters, verify wallet ownership server-side (Section 11) and run
                                the subscription lookup from your backend.
                            </Alert>

                            <Accordion sx={{ mt: 3 }}>
                                <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                                    <Typography variant="subtitle1" fontWeight="bold">
                                        Advanced: load CosmJS yourself (only for the hand-written buttons below)
                                    </Typography>
                                </AccordionSummary>
                                <AccordionDetails>
                                    <Typography paragraph>
                                        Sections 4–11 show fully hand-written buttons that talk to the chain directly through
                                        CosmJS, for developers who want complete control. Those snippets need CosmJS loaded
                                        and a config block — the widget above needs neither.
                                    </Typography>
                                    <Alert severity="warning" sx={{ mb: 2 }}>
                                        CosmJS publishes no ready-made browser bundle — a plain{' '}
                                        <code>&lt;script src=&quot;unpkg.com/.../build/bundle.js&quot;&gt;</code> tag 404s. Sites
                                        with a bundler should <code>npm install @cosmjs/cosmwasm-stargate</code>; plain HTML
                                        sites can load it as an ES module from a CJS-to-ESM CDN:
                                    </Alert>
                                    <CodeBlock code={scriptTagsCode} language="HTML" />
                                    <Typography paragraph sx={{ mt: 2 }}>
                                        Then add this configuration block. <strong>Replace the placeholder addresses</strong> with
                                        your actual addresses:
                                    </Typography>
                                    <CodeBlock code={configCode} language="HTML" />
                                </AccordionDetails>
                            </Accordion>
                        </SectionCard>

                        {/* Section 3: Keplr Wallet */}
                        <SectionCard id="keplr-wallet" number="3" title="Connecting to Keplr Wallet">
                            <Typography paragraph>
                                Every BlueChip interaction starts by connecting the user's Keplr wallet.
                                The snippet suggests the configured chain first (needed for the
                                osmo-test-5 testnet; a no-op for mainnet) and then enables it. Add this
                                script <strong>once</strong> on any page where you have BlueChip buttons:
                            </Typography>
                            <CodeBlock code={walletConnectionCode} language="JavaScript" />

                            <Typography paragraph sx={{ mt: 2 }}>
                                Add a Connect Wallet button to your page:
                            </Typography>
                            <CodeBlock code={connectButtonCode} language="HTML" />
                        </SectionCard>

                        {/* Section 4: Subscribe */}
                        <SectionCard id="subscribe" number="4" title="Subscribe Button (Commit)">
                            <Typography paragraph>
                                The <strong>Subscribe</strong> button lets your fans commit OSMO to your creator pool.
                                This is how people support you. Before the pool reaches its USD threshold ($25,000
                                by default), commits are recorded in a ledger. After the threshold is crossed,
                                commits are swapped through the native Osmosis pool and your supporter receives your
                                creator tokens.
                            </Typography>
                            <Alert severity="info" sx={{ mb: 2 }}>
                                A 6% fee is deducted: 1% goes to the BlueChip protocol, 5% goes to you the creator.
                            </Alert>
                            <Alert severity="warning" sx={{ mb: 2 }}>
                                <strong>Post-threshold commits require a <code>belief_price</code>.</strong> Once the
                                pool is active, a commit is a market buy — and the contract rejects{' '}
                                <code>belief_price: null</code> on that path (it is the anti-sandwich floor). The
                                handler below takes a live <code>simulation</code> quote at submit time and derives{' '}
                                <code>belief_price = offer / expected_out</code>. Pre-threshold commits don't swap,
                                so they leave it null.
                            </Alert>
                            <CodeBlock code={subscribeCode} language="JavaScript" />
                        </SectionCard>

                        {/* Section 5: Buy */}
                        <SectionCard id="buy" number="5" title="Buy Button (Swap OSMO for Creator Tokens)">
                            <Typography paragraph>
                                The <strong>Buy</strong> button lets people swap their OSMO for your
                                creator tokens. This only works <strong>after</strong> the pool has crossed the
                                USD threshold and its native Osmosis pool exists. (Since it's a normal Osmosis
                                pool, buyers can also just trade it on app.osmosis.zone — the contract's{' '}
                                <code>simple_swap</code> is a convenience venue with the same result.)
                            </Typography>
                            <CodeBlock code={buyCode} language="JavaScript" />
                        </SectionCard>

                        {/* Section 6: Sell */}
                        <SectionCard id="sell" number="6" title="Sell Button (Swap Creator Tokens for OSMO)">
                            <Typography paragraph>
                                The <strong>Sell</strong> button lets people swap their creator tokens back into
                                OSMO. Creator tokens are <strong>native TokenFactory coins</strong>, so a sell is
                                the exact same <code>simple_swap</code> message as a buy — just with the creator
                                token's denom attached as funds instead of OSMO. There is no CW20{' '}
                                <code>send</code> step and no token contract address anymore.
                            </Typography>
                            <Alert severity="info" sx={{ mb: 2 }}>
                                You need the creator token's <strong>denom</strong> (looks like{' '}
                                <code>factory/osmo1pool.../utoken</code>), which you can read from the pool's{' '}
                                <code>pair</code> query (see Section 10).
                            </Alert>
                            <CodeBlock code={sellCode} language="JavaScript" />
                        </SectionCard>

                        {/* Section 7: Cross-Token Swaps */}
                        <SectionCard id="cross-token" number="7" title="Cross-Token Swaps (Router)">
                            <Typography paragraph>
                                Creator tokens never share a pool with each other — every pair trades
                                through OSMO. To let a fan swap <em>another creator's token</em>{' '}
                                directly into yours, use the <strong>router contract</strong>: it executes
                                the whole route (up to 3 hops) in a single atomic transaction and validates
                                every hop's pool against the factory registry before moving funds.
                            </Typography>
                            <Alert severity="info" sx={{ mb: 2 }}>
                                The router has <strong>no per-hop slippage parameters</strong>. Protection
                                comes from <code>minimum_receive</code> on the final token: simulate first
                                with <code>simulate_multi_hop</code>, then set{' '}
                                <code>minimum_receive</code> a tolerance below the simulated output (zero is
                                rejected). If any hop moves the price so the final amount lands short, the
                                entire route reverts — partial swaps cannot strand funds mid-route.
                            </Alert>
                            <CodeBlock code={crossTokenSwapCode} language="JavaScript" />
                            <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                                Get the router address from the BlueChip team alongside the factory
                                address. Both pools in the route must be past their threshold (active pools).
                            </Typography>
                        </SectionCard>

                        {/* Section 8: Liquidity */}
                        <SectionCard id="liquidity" number="8" title="Liquidity — It's a Native Osmosis Pool">
                            <Typography paragraph>
                                Earlier versions of the protocol had their own liquidity-position system
                                (deposit, withdraw, position NFTs, fee collection). <strong>That system is
                                gone.</strong> When a creator pool crosses its threshold, the contract creates
                                and seeds a <strong>native Osmosis GAMM pool</strong>, and:
                            </Typography>
                            <Box component="ul" sx={{ mb: 2 }}>
                                <li>
                                    <Typography>
                                        The <strong>seed liquidity belongs to no one</strong> — the pool contract
                                        holds the <code>gamm/pool/{'{id}'}</code> LP shares itself, permanently. It
                                        cannot be pulled, rugged, or transferred, and there are no{' '}
                                        <code>deposit_liquidity</code>, <code>remove_liquidity</code>, or{' '}
                                        <code>collect_fees</code> entry points on the contract.
                                    </Typography>
                                </li>
                                <li>
                                    <Typography>
                                        <strong>Anyone can LP the normal Osmosis way.</strong> Visit
                                        app.osmosis.zone, find the pool (OSMO / your creator token), and add or
                                        remove liquidity there like any other Osmosis pool. Positions and LP
                                        rewards are managed entirely by Osmosis.
                                    </Typography>
                                </li>
                                <li>
                                    <Typography>
                                        <strong>Trading fees accrue to LPs</strong> per Osmosis GAMM rules (the
                                        pool is created with the protocol's configured swap fee, 0.3% by default).
                                    </Typography>
                                </li>
                            </Box>
                            <Alert severity="warning">
                                If your old integration called <code>deposit_liquidity</code>,{' '}
                                <code>add_to_position</code>, <code>remove_all_liquidity</code>,{' '}
                                <code>remove_partial_liquidity</code>, <code>collect_fees</code>, or the{' '}
                                <code>position</code> / <code>positions_by_owner</code> queries — delete that
                                code and point your users at Osmosis instead.
                            </Alert>
                        </SectionCard>

                        {/* Section 9: Create a Pool */}
                        <SectionCard id="create-pool" number="9" title="Create a Pool">
                            <Typography paragraph>
                                Anyone can create a new pool through the factory. There is a single creation
                                path — the <strong>commit (creator) pool</strong>: the new pool mints its own
                                native TokenFactory denom and starts in a funding (commit) phase. Once the
                                configured USD threshold is crossed, 1,200,000 creator tokens are minted
                                and distributed (500k to subscribers, 325k to the creator, 25k to BlueChip,
                                350k seeded into the native Osmosis pool as initial liquidity).
                            </Typography>
                            <Alert severity="info" sx={{ mb: 2 }}>
                                Pool creation charges a <strong>flat OSMO fee</strong>{' '}
                                (<code>pool_creation_fee</code> in factory config). Attach the funds to the
                                call; the factory verifies with <code>must_pay</code> (exactly one{' '}
                                <code>uosmo</code> coin entry), forwards the fee to the protocol wallet, and
                                refunds any surplus on-chain. If the fee is zero, attach nothing — funds are
                                rejected in that case.
                            </Alert>
                            <Alert severity="warning" sx={{ mb: 2 }}>
                                The wallet that creates the pool becomes the creator wallet.
                                <strong> Do not lose your seed phrase</strong> — BlueChip cannot recover it.
                                Token name must be 3-50 printable ASCII characters; symbol must be 3-12 chars
                                (A-Z, 0-9) with at least one letter; decimals are pinned to 6.
                            </Alert>
                            <CodeBlock code={createPoolCode} language="JavaScript" />
                        </SectionCard>

                        {/* Section 10: Querying Pool Info */}
                        <SectionCard id="query-pool" number="10" title="Querying Pool Info (Read-Only)">
                            <Typography paragraph>
                                These queries don't require a wallet connection — they're read-only.
                                You can use them to show pool status on your site.
                            </Typography>

                            <Accordion>
                                <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                                    <Typography sx={{ fontWeight: 'bold' }}>Check if Pool Threshold is Reached</Typography>
                                </AccordionSummary>
                                <AccordionDetails>
                                    <CodeBlock code={queryPoolStatusCode} language="JavaScript" />
                                </AccordionDetails>
                            </Accordion>

                            <Accordion>
                                <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                                    <Typography sx={{ fontWeight: 'bold' }}>Get Pool Reserves</Typography>
                                </AccordionSummary>
                                <AccordionDetails>
                                    <CodeBlock code={queryPoolStateCode} language="JavaScript" />
                                </AccordionDetails>
                            </Accordion>

                            <Accordion>
                                <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                                    <Typography sx={{ fontWeight: 'bold' }}>Get User's Subscription Info</Typography>
                                </AccordionSummary>
                                <AccordionDetails>
                                    <CodeBlock code={querySubscriptionCode} language="JavaScript" />
                                </AccordionDetails>
                            </Accordion>

                            <Accordion>
                                <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                                    <Typography sx={{ fontWeight: 'bold' }}>Get the Creator Token Denom (and Balances)</Typography>
                                </AccordionSummary>
                                <AccordionDetails>
                                    <CodeBlock code={queryTokenDenomCode} language="JavaScript" />
                                </AccordionDetails>
                            </Accordion>

                            <Accordion>
                                <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                                    <Typography sx={{ fontWeight: 'bold' }}>Creator Earnings & Airdrop Progress</Typography>
                                </AccordionSummary>
                                <AccordionDetails>
                                    <CodeBlock code={queryEarningsCode} language="JavaScript" />
                                </AccordionDetails>
                            </Accordion>

                            <Accordion>
                                <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                                    <Typography sx={{ fontWeight: 'bold' }}>List Every Pool + USD Conversion</Typography>
                                </AccordionSummary>
                                <AccordionDetails>
                                    <CodeBlock code={queryListPoolsCode} language="JavaScript" />
                                </AccordionDetails>
                            </Accordion>
                        </SectionCard>

                        {/* Section 11: Special Privileges */}
                        <SectionCard id="special-privileges" number="11" title="Granting Special Privileges to Committed Users">
                            <Typography paragraph>
                                Every commit writes a permanent, public record to your pool's ledger:
                                who committed, how much (in USD and OSMO), and when. After the
                                threshold, supporters also receive your creator tokens. Your website
                                can read either of these to give supporters <strong>special privileges</strong> —
                                subscriber-only pages, download links, badges, Discord roles, early access,
                                anything you can gate.
                            </Typography>
                            <Typography paragraph>
                                Because every stack is different (static site, WordPress, Node, Discord
                                bot...), this section shows three building blocks, from simplest to most
                                robust. They are plain JavaScript and standard HTTP/WebSocket calls, so
                                they port to any environment.
                            </Typography>

                            <Typography variant="h6" gutterBottom sx={{ mt: 2 }}>
                                Pattern A — Client-Side Gating (good for cosmetic perks)
                            </Typography>
                            <Typography paragraph>
                                Read the connected wallet's commit record with the <code>committing_info</code> query
                                and show/hide page sections by tier. No server needed — this runs entirely
                                in the visitor's browser.
                            </Typography>
                            <Alert severity="warning" sx={{ mb: 2 }}>
                                Client-side checks can be bypassed by anyone comfortable with browser dev
                                tools — and they prove only that a wallet is <em>connected</em>, not owned.
                                Use Pattern A for cosmetic perks (badges, styling, shout-outs). For anything
                                valuable (downloads, accounts, paid content), use Pattern B.
                            </Alert>
                            <CodeBlock code={privClientGateCode} language="HTML + JavaScript" />

                            <Typography variant="h6" gutterBottom sx={{ mt: 3 }}>
                                Pattern B — Server-Verified Privileges (secure)
                            </Typography>
                            <Typography paragraph>
                                The commit ledger is public, so the question your server must answer is
                                not "has this wallet committed?" but "does this visitor <em>own</em> that
                                wallet?". The standard solution is an <strong>ADR-36 signature</strong>:
                                Keplr's <code>signArbitrary</code> signs a one-time nonce at zero gas cost,
                                your server verifies the signature, then queries the pool over the chain's
                                REST endpoint and grants a role based on the on-chain record.
                            </Typography>
                            <CodeBlock code={privServerVerifyCode} language="JavaScript / Node.js" />

                            <Typography variant="h6" gutterBottom sx={{ mt: 3 }}>
                                Pattern C — React to Commits in Real Time
                            </Typography>
                            <Typography paragraph>
                                Commits emit on-chain events the moment they land. Subscribe to them over
                                the RPC WebSocket to trigger perks instantly — flip on a chat invite, fire
                                a Discord webhook, or thank the supporter by name.
                            </Typography>
                            <CodeBlock code={privEventWatchCode} language="JavaScript" />

                            <Alert severity="info" sx={{ mt: 2, mb: 2 }}>
                                <strong>Design notes:</strong> amounts are micro-units
                                (<code>total_paid_usd</code> of 5000000000 = $5,000);&nbsp;
                                <code>last_committed</code> is in nanoseconds; commit records never expire
                                on-chain, so "active subscriber" windows (e.g. committed within 30 days) are
                                your site's policy, enforced from <code>last_committed</code>. For
                                token-balance-based perks instead, read the wallet's <strong>bank
                                balance</strong> of the creator token's <code>factory/...</code> denom
                                (Section 10) — creator tokens are native coins, so there is no CW20{' '}
                                <code>balance</code> query.
                            </Alert>
                        </SectionCard>

                        {/* Section 12: Full Working Example */}
                        <SectionCard id="full-example" number="12" title="Full Working Example Page">
                            <Typography paragraph>
                                Here's a complete, self-contained HTML page you can save and use. It includes
                                wallet connection, subscribe, buy, and sell all on one page.
                            </Typography>
                            <CodeBlock code={fullExampleCode} language="HTML" />
                        </SectionCard>

                        {/* Section 13: Troubleshooting */}
                        <SectionCard id="troubleshooting" number="13" title="Troubleshooting">
                            <TableContainer component={Paper} variant="outlined">
                                <Table size="small">
                                    <TableHead>
                                        <TableRow>
                                            <TableCell sx={{ fontWeight: 'bold' }}>Problem</TableCell>
                                            <TableCell sx={{ fontWeight: 'bold' }}>Solution</TableCell>
                                        </TableRow>
                                    </TableHead>
                                    <TableBody>
                                        {[
                                            ['"Please install Keplr extension"', 'Install Keplr from keplr.app/get and refresh the page'],
                                            ['"Failed to connect"', 'Make sure you approved Osmosis in Keplr. Try disconnecting and reconnecting'],
                                            ['"out of gas"', 'Increase the gas limit in the execute() call (e.g., change "500000" to "800000")'],
                                            ['"insufficient funds"', 'You need more OSMO. Check your balance in Keplr'],
                                            ['"Belief price required" (post-threshold commit)', 'Once the pool is active, commits must carry a belief_price. Take a live simulation quote and set belief_price = offer / expected_out (Section 4)'],
                                            ['"Invalid creation funds: ... Send exactly one denom"', 'Create-pool requires exactly one coin entry of uosmo. Remove any IBC / tokenfactory / stray denoms from the funds array'],
                                            ['"Insufficient commit-pool creation fee"', "The attached OSMO is below the factory's flat pool_creation_fee. Query { factory: {} } for the live value and re-attach"],
                                            ['"creation fee is disabled; do not attach any funds"', 'The factory currently has the creation fee set to zero. Pass an empty funds array on these calls'],
                                            ['"rate limited"', 'Commits have a 13-second cooldown per wallet. Wait and try again'],
                                            ['"Route exceeds the maximum of 3 hops"', 'The router caps routes at 3 hops. Any creator-token pair needs at most 2 (token → OSMO → token)'],
                                            ['"not registered with the factory" (router)', "A hop's pool address is not in the factory registry. Use pool addresses from the factory's pools query or this explorer"],
                                            ['Router swap reverts with a minimum_receive error', 'Price moved past your tolerance between simulation and execution. Re-quote and retry, or widen slippage slightly'],
                                            ['"Commit too small"', 'Each pool enforces a minimum commit value in USD (separate pre- and post-threshold floors). Increase the amount'],
                                            ['"Pool is not fully committed"', 'Buy/Sell only work after the pool crosses the USD threshold. Use Subscribe instead'],
                                            ['Swap refunded, pool paused (circuit breaker)', "The pool's liquidity breaker latched (a reserve fell below 25% of its seed). Your offer was refunded in the same tx; trading resumes when the admin unpauses"],
                                            ['Calls to deposit_liquidity / collect_fees / position fail', 'Those entry points no longer exist — liquidity lives in the native Osmosis pool. LP directly on app.osmosis.zone (Section 8)'],
                                            ['Transaction stuck / pending', 'The transaction may still be processing. Check the tx hash on an Osmosis explorer (e.g. Mintscan)'],
                                            ['Keplr not detecting on mobile', 'Use the Keplr mobile app\'s built-in browser to visit your site'],
                                        ].map(([problem, solution], idx) => (
                                            <TableRow key={idx}>
                                                <TableCell><code>{problem}</code></TableCell>
                                                <TableCell>{solution}</TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </TableContainer>
                        </SectionCard>

                        {/* Section 14: Contract Address Reference */}
                        <SectionCard id="contract-reference" number="14" title="Contract Address Reference">
                            <Typography paragraph>
                                These are the identifiers you need. Get them from the BlueChip team or this explorer:
                            </Typography>
                            <TableContainer component={Paper} variant="outlined" sx={{ mb: 2 }}>
                                <Table size="small">
                                    <TableHead>
                                        <TableRow>
                                            <TableCell sx={{ fontWeight: 'bold' }}>Identifier</TableCell>
                                            <TableCell sx={{ fontWeight: 'bold' }}>What It Is</TableCell>
                                            <TableCell sx={{ fontWeight: 'bold' }}>Where to Find</TableCell>
                                        </TableRow>
                                    </TableHead>
                                    <TableBody>
                                        {[
                                            ['Factory Address', 'Creates new pools; registry of all pools', 'Deployment records / this explorer'],
                                            ['Pool Address', 'Your specific creator pool', "Returned when pool is created (tx hash), or the factory's pools query"],
                                            ['Router Address', 'Multi-hop cross-token swaps', 'Deployment records (deployed alongside the factory)'],
                                            ['Creator Token Denom', 'Native TokenFactory denom factory/{pool}/{sub}', "Query the pool's pair endpoint"],
                                            ['GAMM Pool ID', 'The native Osmosis pool seeded at crossing', 'Threshold-crossing tx events / Osmosis app'],
                                        ].map(([addr, desc, where], idx) => (
                                            <TableRow key={idx}>
                                                <TableCell><strong>{addr}</strong></TableCell>
                                                <TableCell>{desc}</TableCell>
                                                <TableCell>{where}</TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </TableContainer>

                            <Typography variant="h6" gutterBottom>
                                How to Find Your Creator Token Denom
                            </Typography>
                            <Typography paragraph>
                                After your pool is created, you can find the creator token denom by querying:
                            </Typography>
                            <CodeBlock
                                code={`var pairInfo = await client.queryContractSmart("YOUR_POOL_ADDRESS", { pair: {} });
// Look for the creator_token entry in pairInfo.asset_infos —
// its denom field is the factory/{pool}/{subdenom} coin.`}
                                language="JavaScript"
                            />
                            <Typography variant="body2" color="text.secondary">
                                Or check the pool creation transaction on a block explorer — the denom appears
                                in the instantiation events (<code>create_denom</code>).
                            </Typography>
                        </SectionCard>
                    </Stack>
                </Grid>
        </PageShell>
    );
};

export default IntegrationGuidePage;
