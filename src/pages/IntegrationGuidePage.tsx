import React from 'react';
import { Layout } from '../ui';
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
    Chip,
} from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import BlockExpTopBar from '../navigation/BlockExpTopBar';
import BlockExpSideBar from '../navigation/BlockExpSideBar';
import BlockExplorerNavBar from '../navigation/BlockExplorerNavBar';
import GeneralStats from '../navigation/GeneralStats';
import CodeBlock from '../components/universal/CodeBlock';
import SectionCard from '../components/universal/DocSectionCard';


const scriptTagsCode = `<!-- CosmJS — Required for all BlueChip interactions -->
<script src="https://unpkg.com/@cosmjs/cosmwasm-stargate@0.32.4/build/bundle.js"></script>
<script src="https://unpkg.com/@cosmjs/stargate@0.32.4/build/bundle.js"></script>`;

const configCode = `<script>
// ============================================================
//  BLUECHIP CONFIGURATION — EDIT THESE VALUES
// ============================================================
const BLUECHIP_CONFIG = {
    // Chain settings
    chainId:        "bluechip-1",
    chainName:      "Bluechip Mainnet",
    rpc:            "https://bluechip.rpc.bluechip.link",
    rest:           "https://bluechip.api.bluechip.link",
    nativeDenom:    "ubluechip",
    coinDecimals:   6,

    // Your contract addresses — REPLACE THESE
    factoryAddress: "bluechip1factory_address_here",
    poolAddress:    "bluechip1your_pool_address_here",

    // Keplr chain registration
    bip44:          { coinType: 118 },
    bech32Config: {
        bech32PrefixAccAddr:  "bluechip",
        bech32PrefixAccPub:   "bluechippub",
        bech32PrefixValAddr:  "bluechipvaloper",
        bech32PrefixValPub:   "bluechipvaloperpub",
        bech32PrefixConsAddr: "bluechipvalcons",
        bech32PrefixConsPub:  "bluechipvalconspub",
    },
    currencies: [{
        coinDenom:        "BLUECHIP",
        coinMinimalDenom: "ubluechip",
        coinDecimals:     6,
        coinGeckoId:      "bluechip",
    }],
    feeCurrencies: [{
        coinDenom:        "BLUECHIP",
        coinMinimalDenom: "ubluechip",
        coinDecimals:     6,
        coinGeckoId:      "bluechip",
        gasPriceStep:     { low: 0.01, average: 0.025, high: 0.04 },
    }],
    stakeCurrency: {
        coinDenom:        "BLUECHIP",
        coinMinimalDenom: "ubluechip",
        coinDecimals:     6,
        coinGeckoId:      "bluechip",
    },
};
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
        // Register the BlueChip chain with Keplr
        await window.keplr.experimentalSuggestChain({
            chainId:        BLUECHIP_CONFIG.chainId,
            chainName:      BLUECHIP_CONFIG.chainName,
            rpc:            BLUECHIP_CONFIG.rpc,
            rest:           BLUECHIP_CONFIG.rest,
            bip44:          BLUECHIP_CONFIG.bip44,
            bech32Config:   BLUECHIP_CONFIG.bech32Config,
            currencies:     BLUECHIP_CONFIG.currencies,
            feeCurrencies:  BLUECHIP_CONFIG.feeCurrencies,
            stakeCurrency:  BLUECHIP_CONFIG.stakeCurrency,
        });

        // Enable the chain
        await window.keplr.enable(BLUECHIP_CONFIG.chainId);

        // Get signer and address
        var offlineSigner = window.getOfflineSigner(BLUECHIP_CONFIG.chainId);
        var accounts      = await offlineSigner.getAccounts();
        var address       = accounts[0].address;

        // Connect the signing client
        var client = await CosmWasmClient.SigningCosmWasmClient.connectWithSigner(
            BLUECHIP_CONFIG.rpc,
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
        var balance = await client.getBalance(address, BLUECHIP_CONFIG.nativeDenom);
        var balanceEl = document.getElementById("bluechip-balance");
        if (balanceEl) {
            var human = (parseInt(balance.amount) / Math.pow(10, BLUECHIP_CONFIG.coinDecimals)).toFixed(6);
            balanceEl.textContent = human + " BLUECHIP";
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
        // Convert to micro-units (1 BLUECHIP = 1,000,000 ubluechip)
        var microAmount = Math.floor(amount * 1000000).toString();

        // Check pool threshold status
        var thresholdStatus = await window.bluechipClient.queryContractSmart(
            BLUECHIP_CONFIG.poolAddress,
            { is_fully_commited: {} }
        );
        var isThresholdCrossed = (thresholdStatus === "fully_committed");

        // Deadline: 20 minutes from now, in nanoseconds
        var deadlineNs = ((Date.now() + 20 * 60 * 1000) * 1000000).toString();

        // Build the commit message
        var msg = {
            commit: {
                asset: {
                    info:   { bluechip: { denom: BLUECHIP_CONFIG.nativeDenom } },
                    amount: microAmount
                },
                amount:               microAmount,
                transaction_deadline: deadlineNs,
                belief_price:         null,
                max_spread:           (isThresholdCrossed && spreadInput) ? spreadInput : null
            }
        };

        // Attach native tokens as funds
        var funds = [{ denom: BLUECHIP_CONFIG.nativeDenom, amount: microAmount }];

        var result = await window.bluechipClient.execute(
            window.bluechipAddress,
            BLUECHIP_CONFIG.poolAddress,
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

        var msg = {
            simple_swap: {
                offer_asset: {
                    info:   { bluechip: { denom: BLUECHIP_CONFIG.nativeDenom } },
                    amount: microAmount
                },
                belief_price:         null,
                max_spread:           spreadInput || null,
                to:                   null,
                transaction_deadline: deadlineNs
            }
        };

        var funds = [{ denom: BLUECHIP_CONFIG.nativeDenom, amount: microAmount }];

        var result = await window.bluechipClient.execute(
            window.bluechipAddress,
            BLUECHIP_CONFIG.poolAddress,
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

    var tokenAddress = document.getElementById("sell-token-address").value.trim();
    var amount       = parseFloat(document.getElementById("sell-amount").value);
    var spreadInput  = document.getElementById("sell-spread").value;

    if (!tokenAddress) {
        statusEl.innerHTML = '<div style="color:red;">Please enter the creator token address.</div>';
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

        // Build the inner swap hook message
        var hookMsg = {
            swap: {
                belief_price:         null,
                max_spread:           spreadInput || null,
                to:                   null,
                transaction_deadline: deadlineNs
            }
        };

        // Base64-encode the hook message
        var encodedMsg = btoa(JSON.stringify(hookMsg));

        // CW20 Send: send creator tokens to the pool with the swap instruction
        var msg = {
            send: {
                contract: BLUECHIP_CONFIG.poolAddress,
                amount:   microAmount,
                msg:      encodedMsg
            }
        };

        // Execute on the CW20 token contract (NOT the pool contract)
        var result = await window.bluechipClient.execute(
            window.bluechipAddress,
            tokenAddress,
            msg,
            { amount: [], gas: "500000" },
            "Sell Token",
            []
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

const addLiquidityCode = `<script>
async function handleAddLiquidity() {
    var statusEl = document.getElementById("liq-add-status");
    var txEl     = document.getElementById("liq-add-tx");
    statusEl.textContent = "";
    txEl.innerHTML       = "";

    if (!window.bluechipClient || !window.bluechipAddress) {
        var connected = await connectKeplrWallet();
        if (!connected) return;
    }

    var amount0 = parseFloat(document.getElementById("liq-amount0").value);
    var amount1 = parseFloat(document.getElementById("liq-amount1").value);
    var slip    = parseFloat(document.getElementById("liq-slippage").value) || 1;

    if (isNaN(amount0) || amount0 <= 0 || isNaN(amount1) || amount1 <= 0) {
        statusEl.innerHTML = '<div style="color:red;">Please enter valid amounts for both tokens.</div>';
        return;
    }

    statusEl.innerHTML = '<div style="color:#1565c0;">Step 1: Fetching pool info...</div>';

    try {
        var amount0Micro = Math.ceil(amount0 * 1000000).toString();
        var amount1Micro = Math.ceil(amount1 * 1000000).toString();

        // Step 1: Get the creator token address from the pool
        var pairInfo = await window.bluechipClient.queryContractSmart(
            BLUECHIP_CONFIG.poolAddress, { pair: {} }
        );

        var tokenAddress   = null;
        var bluechipDenom  = BLUECHIP_CONFIG.nativeDenom;
        for (var i = 0; i < pairInfo.asset_infos.length; i++) {
            if (pairInfo.asset_infos[i].creator_token) {
                tokenAddress = pairInfo.asset_infos[i].creator_token.contract_addr;
            }
            if (pairInfo.asset_infos[i].bluechip) {
                bluechipDenom = pairInfo.asset_infos[i].bluechip.denom;
            }
        }

        if (!tokenAddress) {
            statusEl.innerHTML = '<div style="color:red;">Error: Could not find creator token.</div>';
            return;
        }

        // Step 2: Check & set CW20 allowance
        statusEl.innerHTML = '<div style="color:#1565c0;">Step 2: Checking token allowance...</div>';

        var allowanceInfo = await window.bluechipClient.queryContractSmart(tokenAddress, {
            allowance: { owner: window.bluechipAddress, spender: BLUECHIP_CONFIG.poolAddress }
        });

        if (parseInt(allowanceInfo.allowance) < parseInt(amount1Micro)) {
            statusEl.innerHTML = '<div style="color:#1565c0;">Step 2: Approving tokens...</div>';
            await window.bluechipClient.execute(
                window.bluechipAddress,
                tokenAddress,
                { increase_allowance: { spender: BLUECHIP_CONFIG.poolAddress, amount: amount1Micro } },
                { amount: [], gas: "200000" },
                "Approve Pool",
                []
            );
        }

        // Step 3: Deposit liquidity
        statusEl.innerHTML = '<div style="color:#1565c0;">Step 3: Depositing liquidity...</div>';

        var slipFactor = 1 - (slip / 100);
        var minAmount0 = Math.floor(parseFloat(amount0Micro) * slipFactor).toString();
        var minAmount1 = Math.floor(parseFloat(amount1Micro) * slipFactor).toString();
        var deadlineNs = ((Date.now() + 20 * 60 * 1000) * 1000000).toString();

        var msg = {
            deposit_liquidity: {
                amount0:              amount0Micro,
                amount1:              amount1Micro,
                min_amount0:          minAmount0,
                min_amount1:          minAmount1,
                transaction_deadline: deadlineNs
            }
        };

        var result = await window.bluechipClient.execute(
            window.bluechipAddress,
            BLUECHIP_CONFIG.poolAddress,
            msg,
            { amount: [], gas: "500000" },
            "Deposit Liquidity",
            [{ denom: bluechipDenom, amount: amount0Micro }]
        );

        statusEl.innerHTML = '<div style="color:#2e7d32;font-weight:bold;">Liquidity added!</div>';
        txEl.innerHTML =
            '<div style="padding:10px;background:#f3e5f5;border:1px solid #7b1fa2;' +
            'border-radius:6px;font-family:monospace;word-break:break-all;">' +
            '<strong>Tx Hash:</strong><br>' + result.transactionHash + '</div>';

    } catch (err) {
        console.error("Add liquidity error:", err);
        statusEl.innerHTML = '<div style="color:red;">Error: ' + err.message + '</div>';
    }
}
</script>`;

const removeLiquidityCode = `<script>
var currentRemoveMode = "amount";

function setRemoveMode(mode) {
    currentRemoveMode = mode;
    document.getElementById("remove-amount-section").style.display  = (mode === "amount")  ? "block" : "none";
    document.getElementById("remove-percent-section").style.display = (mode === "percent") ? "block" : "none";
}

async function handleRemoveLiquidity() {
    var statusEl = document.getElementById("remove-status");
    var txEl     = document.getElementById("remove-tx");
    statusEl.textContent = "";
    txEl.innerHTML       = "";

    if (!window.bluechipClient || !window.bluechipAddress) {
        var connected = await connectKeplrWallet();
        if (!connected) return;
    }

    var positionId = document.getElementById("remove-position-id").value.trim();
    if (!positionId) {
        statusEl.innerHTML = '<div style="color:red;">Please enter your position ID.</div>';
        return;
    }

    try {
        // Verify ownership
        var positionInfo = await window.bluechipClient.queryContractSmart(
            BLUECHIP_CONFIG.poolAddress,
            { position: { position_id: positionId } }
        );
        if (positionInfo.owner !== window.bluechipAddress) {
            statusEl.innerHTML = '<div style="color:red;">You do not own this position.</div>';
            return;
        }

        var deviation = parseFloat(document.getElementById("remove-deviation").value) || 1;
        var deviationBps = Math.floor(deviation * 100);
        var deadlineNs   = ((Date.now() + 20 * 60 * 1000) * 1000000).toString();

        var msg;
        if (currentRemoveMode === "all") {
            msg = { remove_all_liquidity: {
                position_id: positionId, min_amount0: null, min_amount1: null,
                max_ratio_deviation_bps: deviationBps, transaction_deadline: deadlineNs
            }};
        } else if (currentRemoveMode === "percent") {
            var pct = parseInt(document.getElementById("remove-percent").value);
            msg = { remove_partial_liquidity_by_percent: {
                position_id: positionId, percentage: pct, min_amount0: null, min_amount1: null,
                max_ratio_deviation_bps: deviationBps, transaction_deadline: deadlineNs
            }};
        } else {
            var removeAmt = parseFloat(document.getElementById("remove-amount").value);
            msg = { remove_partial_liquidity: {
                position_id: positionId, liquidity_to_remove: Math.floor(removeAmt).toString(),
                min_amount0: null, min_amount1: null,
                max_ratio_deviation_bps: deviationBps, transaction_deadline: deadlineNs
            }};
        }

        var result = await window.bluechipClient.execute(
            window.bluechipAddress, BLUECHIP_CONFIG.poolAddress, msg,
            { amount: [], gas: "500000" }, "Remove Liquidity"
        );

        statusEl.innerHTML = '<div style="color:#2e7d32;font-weight:bold;">Liquidity removed!</div>';
        txEl.innerHTML =
            '<div style="padding:10px;background:#fff3e0;border:1px solid #e65100;' +
            'border-radius:6px;font-family:monospace;word-break:break-all;">' +
            '<strong>Tx Hash:</strong><br>' + result.transactionHash + '</div>';

    } catch (err) {
        console.error("Remove liquidity error:", err);
        statusEl.innerHTML = '<div style="color:red;">Error: ' + err.message + '</div>';
    }
}
</script>`;

const collectFeesCode = `<script>
async function handleCollectFees() {
    var statusEl = document.getElementById("fees-status");
    var txEl     = document.getElementById("fees-tx");
    statusEl.textContent = "";
    txEl.innerHTML       = "";

    if (!window.bluechipClient || !window.bluechipAddress) {
        var connected = await connectKeplrWallet();
        if (!connected) return;
    }

    var positionId = document.getElementById("fees-position-id").value.trim();
    if (!positionId) {
        statusEl.innerHTML = '<div style="color:red;">Please enter your position ID.</div>';
        return;
    }

    try {
        var positionInfo = await window.bluechipClient.queryContractSmart(
            BLUECHIP_CONFIG.poolAddress,
            { position: { position_id: positionId } }
        );
        if (positionInfo.owner !== window.bluechipAddress) {
            statusEl.innerHTML = '<div style="color:red;">You do not own this position.</div>';
            return;
        }

        var unclaimed0 = (parseInt(positionInfo.unclaimed_fees_0) / 1000000).toFixed(6);
        var unclaimed1 = (parseInt(positionInfo.unclaimed_fees_1) / 1000000).toFixed(6);
        statusEl.innerHTML =
            '<div style="color:#1565c0;">Collecting fees...<br>' +
            'Unclaimed: ' + unclaimed0 + ' BLUECHIP + ' + unclaimed1 + ' Creator Tokens</div>';

        var msg = { collect_fees: { position_id: positionId } };

        var result = await window.bluechipClient.execute(
            window.bluechipAddress, BLUECHIP_CONFIG.poolAddress, msg,
            { amount: [], gas: "400000" }, "Collect Fees"
        );

        statusEl.innerHTML = '<div style="color:#2e7d32;font-weight:bold;">Fees collected!</div>';
        txEl.innerHTML =
            '<div style="padding:10px;background:#e0f2f1;border:1px solid #00897b;' +
            'border-radius:6px;font-family:monospace;word-break:break-all;">' +
            '<strong>Tx Hash:</strong><br>' + result.transactionHash + '</div>';

    } catch (err) {
        console.error("Collect fees error:", err);
        statusEl.innerHTML = '<div style="color:red;">Error: ' + err.message + '</div>';
    }
}
</script>`;

const createPoolCode = `<script>
async function handleCreatePool() {
    var statusEl = document.getElementById("create-pool-status");
    var txEl     = document.getElementById("create-pool-tx");
    statusEl.textContent = "";
    txEl.innerHTML       = "";

    if (!window.bluechipClient || !window.bluechipAddress) {
        var connected = await connectKeplrWallet();
        if (!connected) return;
    }

    var tokenName   = document.getElementById("pool-token-name").value.trim();
    var tokenSymbol = document.getElementById("pool-token-symbol").value.trim().toUpperCase();
    var isStandard  = document.getElementById("pool-standard").checked;

    if (!tokenName || !tokenSymbol) {
        statusEl.innerHTML = '<div style="color:red;">Please enter both a token name and symbol.</div>';
        return;
    }

    statusEl.innerHTML = '<div style="color:#1565c0;">Creating your pool...</div>';

    try {
        var thresholdPayout = {
            creator_reward_amount: "325000000000",
            bluechip_reward_amount: "25000000000",
            pool_seed_amount: "350000000000",
            commit_return_amount: "500000000000"
        };
        var thresholdPayoutB64 = btoa(JSON.stringify(thresholdPayout));

        var createMsg = {
            create: {
                pool_msg: {
                    pool_token_info: [
                        { bluechip: { denom: BLUECHIP_CONFIG.nativeDenom } },
                        { creator_token: { contract_addr: "WILL_BE_CREATED_BY_FACTORY" } }
                    ],
                    cw20_token_contract_id:                1,
                    factory_to_create_pool_addr:           BLUECHIP_CONFIG.factoryAddress,
                    threshold_payout:                      thresholdPayoutB64,
                    commit_fee_info: {
                        bluechip_wallet_address: window.bluechipAddress,
                        creator_wallet_address:  window.bluechipAddress,
                        commit_fee_bluechip:     "0.01",
                        commit_fee_creator:      "0.05"
                    },
                    creator_token_address:                 window.bluechipAddress,
                    commit_amount_for_threshold:           "25000000000",
                    commit_limit_usd:                      "25000000000",
                    pyth_contract_addr_for_conversions:    "oracle_address_placeholder",
                    pyth_atom_usd_price_feed_id:           "ATOM_USD",
                    max_bluechip_lock_per_pool:            "10000000000",
                    creator_excess_liquidity_lock_days:    7,
                    is_standard_pool:                      isStandard
                },
                token_info: {
                    name:    tokenName,
                    symbol:  tokenSymbol,
                    decimal: 6
                }
            }
        };

        var result = await window.bluechipClient.execute(
            window.bluechipAddress, BLUECHIP_CONFIG.factoryAddress, createMsg,
            { amount: [], gas: "2000000" }, "Create Pool"
        );

        statusEl.innerHTML =
            '<div style="color:#2e7d32;font-weight:bold;">' +
            'Pool created! Your token "' + tokenSymbol + '" is now live.</div>';
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
    var client = await CosmWasmClient.CosmWasmClient.connect(BLUECHIP_CONFIG.rpc);

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
    var client = await CosmWasmClient.CosmWasmClient.connect(BLUECHIP_CONFIG.rpc);

    var state = await client.queryContractSmart(poolAddress, { pool_state: {} });

    console.log("Reserve 0 (Bluechip):", parseInt(state.reserve0) / 1000000);
    console.log("Reserve 1 (Creator):",  parseInt(state.reserve1) / 1000000);
    console.log("Total Liquidity:",      parseInt(state.total_liquidity) / 1000000);

    return state;
}`;

const querySubscriptionCode = `async function getSubscriptionInfo(poolAddress, walletAddress) {
    var client = await CosmWasmClient.CosmWasmClient.connect(BLUECHIP_CONFIG.rpc);

    var info = await client.queryContractSmart(poolAddress, {
        commiting_info: { wallet: walletAddress }
    });

    if (info) {
        console.log("Total paid (USD):", parseInt(info.total_paid_usd) / 1000000);
        console.log("Total paid (BLUECHIP):", parseInt(info.total_paid_bluechip) / 1000000);
    } else {
        console.log("User has not subscribed yet.");
    }

    return info;
}`;

const queryPositionsCode = `async function getMyPositions(poolAddress, walletAddress) {
    var client = await CosmWasmClient.CosmWasmClient.connect(BLUECHIP_CONFIG.rpc);

    var result = await client.queryContractSmart(poolAddress, {
        positions_by_owner: { owner: walletAddress }
    });

    result.positions.forEach(function(pos) {
        console.log("Position ID:", pos.position_id);
        console.log("  Liquidity:", parseInt(pos.liquidity) / 1000000);
        console.log("  Unclaimed Fees 0:", parseInt(pos.unclaimed_fees_0) / 1000000);
        console.log("  Unclaimed Fees 1:", parseInt(pos.unclaimed_fees_1) / 1000000);
    });

    return result.positions;
}`;

const queryTokenAddressCode = `async function getCreatorTokenAddress(poolAddress) {
    var client = await CosmWasmClient.CosmWasmClient.connect(BLUECHIP_CONFIG.rpc);

    var pairInfo = await client.queryContractSmart(poolAddress, { pair: {} });

    for (var i = 0; i < pairInfo.asset_infos.length; i++) {
        if (pairInfo.asset_infos[i].creator_token) {
            return pairInfo.asset_infos[i].creator_token.contract_addr;
        }
    }
    return null;
}`;

const fullExampleCode = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>BlueChip - My Creator Page</title>
    <script src="https://unpkg.com/@cosmjs/cosmwasm-stargate@0.32.4/build/bundle.js"><\/script>
    <script src="https://unpkg.com/@cosmjs/stargate@0.32.4/build/bundle.js"><\/script>
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
        .btn-teal   { background: #00897b; }
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
        <input id="subscribe-amount" type="number" placeholder="Amount (BLUECHIP)" />
        <input id="subscribe-spread" type="text" value="0.005" placeholder="Max spread" />
        <button class="btn btn-green" onclick="handleSubscribe()">Subscribe</button>
        <div id="subscribe-status"></div>
        <div id="subscribe-tx"></div>
    </div>

    <!-- Buy -->
    <div class="card">
        <h3>Buy Creator Tokens</h3>
        <input id="buy-amount" type="number" placeholder="Amount (BLUECHIP)" />
        <input id="buy-spread" type="text" value="0.005" placeholder="Max spread" />
        <button class="btn btn-blue" onclick="handleBuy()">Buy</button>
        <div id="buy-status"></div>
        <div id="buy-tx"></div>
    </div>

    <!-- Sell -->
    <div class="card">
        <h3>Sell Creator Tokens</h3>
        <input id="sell-token-address" type="text" placeholder="Creator token address" />
        <input id="sell-amount" type="number" placeholder="Amount" />
        <input id="sell-spread" type="text" value="0.005" placeholder="Max spread" />
        <button class="btn btn-red" onclick="handleSell()">Sell</button>
        <div id="sell-status"></div>
        <div id="sell-tx"></div>
    </div>

    <!-- Collect Fees -->
    <div class="card">
        <h3>Collect Fees</h3>
        <input id="fees-position-id" type="text" placeholder="Position ID" />
        <button class="btn btn-teal" onclick="handleCollectFees()">Collect Fees</button>
        <div id="fees-status"></div>
        <div id="fees-tx"></div>
    </div>

    <!--
        IMPORTANT: Paste the BLUECHIP_CONFIG block, wallet connection script,
        and all handler functions from this guide here.
    -->
</body>
</html>`;


const tocItems = [
    { num: '1', title: 'Prerequisites — What You Need First', id: 'prerequisites' },
    { num: '2', title: 'Quick Start — Add the Script Tags', id: 'quick-start' },
    { num: '3', title: 'Connecting to Keplr Wallet', id: 'keplr-wallet' },
    { num: '4', title: 'Subscribe Button (Commit)', id: 'subscribe' },
    { num: '5', title: 'Buy Button (Swap Bluechips for Creator Tokens)', id: 'buy' },
    { num: '6', title: 'Sell Button (Swap Creator Tokens for Bluechips)', id: 'sell' },
    { num: '7', title: 'Add Liquidity', id: 'add-liquidity' },
    { num: '8', title: 'Remove Liquidity', id: 'remove-liquidity' },
    { num: '9', title: 'Collect Fees', id: 'collect-fees' },
    { num: '10', title: 'Create a Pool', id: 'create-pool' },
    { num: '11', title: 'Querying Pool Info (Read-Only)', id: 'query-pool' },
    { num: '12', title: 'Full Working Example Page', id: 'full-example' },
    { num: '13', title: 'Troubleshooting', id: 'troubleshooting' },
    { num: '14', title: 'Contract Address Reference', id: 'contract-reference' },
];


const IntegrationGuidePage: React.FC = () => {
    return (
        <Layout NavBar={<BlockExpTopBar />} SideBar={<BlockExpSideBar />}>
            <Grid container spacing={2} sx={{ mt: 2, mb: 4 }}>
                <Grid item xs={12} md={10} lg={8}>
                    <Stack spacing={2}>
                        <BlockExplorerNavBar />
                        <GeneralStats />

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
                                to interact with BlueChip buttons on your site.
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
                                <li><Typography>Your <strong>Pool Contract Address</strong> — the address of the creator pool on the BlueChip chain (looks like <code>bluechip1abc...xyz</code>)</Typography></li>
                                <li><Typography>Your <strong>Factory Contract Address</strong> — only needed if you want to create new pools</Typography></li>
                            </Box>
                        </SectionCard>

                        {/* Section 2: Quick Start */}
                        <SectionCard id="quick-start" number="2" title="Quick Start — Add the Script Tags">
                            <Typography paragraph>
                                Add these two script tags to your HTML page, either in the <code>&lt;head&gt;</code> or
                                right before <code>&lt;/body&gt;</code>. These load the CosmJS library that talks to the blockchain.
                            </Typography>
                            <CodeBlock code={scriptTagsCode} language="HTML" />

                            <Typography paragraph sx={{ mt: 2 }}>
                                Then add this configuration block. <strong>Replace the placeholder values</strong> with
                                your actual addresses:
                            </Typography>
                            <CodeBlock code={configCode} language="HTML" />
                        </SectionCard>

                        {/* Section 3: Keplr Wallet */}
                        <SectionCard id="keplr-wallet" number="3" title="Connecting to Keplr Wallet">
                            <Typography paragraph>
                                Every BlueChip interaction starts by connecting the user's Keplr wallet.
                                Add this script <strong>once</strong> on any page where you have BlueChip buttons:
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
                                The <strong>Subscribe</strong> button lets your fans commit Bluechip tokens to your creator pool.
                                This is how people support you. Before the pool reaches $25,000 USD, commits are recorded
                                in a ledger. After the threshold is crossed, commits are swapped through the AMM and
                                your supporter receives your creator tokens.
                            </Typography>
                            <Alert severity="info" sx={{ mb: 2 }}>
                                A 6% fee is deducted: 1% goes to the BlueChip protocol, 5% goes to you the creator.
                            </Alert>
                            <CodeBlock code={subscribeCode} language="JavaScript" />
                        </SectionCard>

                        {/* Section 5: Buy */}
                        <SectionCard id="buy" number="5" title="Buy Button (Swap Bluechips for Creator Tokens)">
                            <Typography paragraph>
                                The <strong>Buy</strong> button lets people swap their Bluechip tokens for your
                                creator tokens. This only works <strong>after</strong> the pool has crossed the
                                $25,000 threshold and has active liquidity.
                            </Typography>
                            <CodeBlock code={buyCode} language="JavaScript" />
                        </SectionCard>

                        {/* Section 6: Sell */}
                        <SectionCard id="sell" number="6" title="Sell Button (Swap Creator Tokens for Bluechips)">
                            <Typography paragraph>
                                The <strong>Sell</strong> button lets people swap their creator tokens back into
                                Bluechip tokens. This uses the CW20 <code>send</code> mechanism — the tokens are
                                sent to the pool contract with an embedded swap instruction.
                            </Typography>
                            <Alert severity="warning" sx={{ mb: 2 }}>
                                Selling creator tokens requires the CW20 token contract address, which is different
                                from the pool address. You can find this by querying the pool's <code>pair</code> endpoint
                                (see Section 11).
                            </Alert>
                            <CodeBlock code={sellCode} language="JavaScript" />
                        </SectionCard>

                        {/* Section 7: Add Liquidity */}
                        <SectionCard id="add-liquidity" number="7" title="Add Liquidity">
                            <Typography paragraph>
                                Liquidity providers earn trading fees. When you add liquidity, you receive an NFT that
                                represents your position. You must provide <strong>both</strong> Bluechip tokens and
                                creator tokens in the correct ratio.
                            </Typography>
                            <Alert severity="info" sx={{ mb: 2 }}>
                                Adding liquidity only works <strong>after</strong> the pool threshold has been
                                crossed ($25,000 USD in commits). There are two steps: approve the pool to spend
                                your creator tokens (CW20 allowance), then deposit both tokens into the pool.
                            </Alert>
                            <CodeBlock code={addLiquidityCode} language="JavaScript" />
                        </SectionCard>

                        {/* Section 8: Remove Liquidity */}
                        <SectionCard id="remove-liquidity" number="8" title="Remove Liquidity">
                            <Typography paragraph>
                                You can remove liquidity three ways:
                            </Typography>
                            <Box component="ul" sx={{ mb: 2 }}>
                                <li><Typography><strong>By Amount</strong> — Remove a specific amount of liquidity units</Typography></li>
                                <li><Typography><strong>By Percentage</strong> — Remove a percentage (e.g., 50%) of your position</Typography></li>
                                <li><Typography><strong>Remove All</strong> — Withdraw everything</Typography></li>
                            </Box>
                            <Typography paragraph>
                                You will need your <strong>Position ID</strong> (the NFT token ID you received when adding liquidity).
                            </Typography>
                            <CodeBlock code={removeLiquidityCode} language="JavaScript" />
                        </SectionCard>

                        {/* Section 9: Collect Fees */}
                        <SectionCard id="collect-fees" number="9" title="Collect Fees">
                            <Typography paragraph>
                                If you have a liquidity position (NFT), you can collect your accumulated trading
                                fees <strong>without</strong> removing your liquidity. Fees are paid out in both
                                Bluechip and creator tokens.
                            </Typography>
                            <CodeBlock code={collectFeesCode} language="JavaScript" />
                        </SectionCard>

                        {/* Section 10: Create a Pool */}
                        <SectionCard id="create-pool" number="10" title="Create a Pool">
                            <Typography paragraph>
                                This lets anyone create a brand new creator pool with their own custom token.
                                The pool goes through two phases:
                            </Typography>
                            <Box component="ol" sx={{ mb: 2 }}>
                                <li>
                                    <Typography>
                                        <strong>Pre-Threshold (Funding Phase):</strong> People commit Bluechip tokens.
                                        Only commits are accepted. No swaps yet.
                                    </Typography>
                                </li>
                                <li>
                                    <Typography>
                                        <strong>Post-Threshold (Active Trading):</strong> Once $25,000 USD in commits
                                        is reached, 1,200,000 creator tokens are minted and distributed:
                                    </Typography>
                                    <Box component="ul">
                                        <li><Typography>500,000 to early subscribers</Typography></li>
                                        <li><Typography>325,000 to you, the creator</Typography></li>
                                        <li><Typography>25,000 to the BlueChip protocol</Typography></li>
                                        <li><Typography>350,000 seeded into the pool as initial liquidity</Typography></li>
                                    </Box>
                                </li>
                            </Box>
                            <Alert severity="warning" sx={{ mb: 2 }}>
                                The wallet you use to create the pool becomes your creator wallet.
                                <strong> Do not lose your seed phrase</strong> — BlueChip cannot recover it.
                            </Alert>
                            <CodeBlock code={createPoolCode} language="JavaScript" />
                        </SectionCard>

                        {/* Section 11: Querying Pool Info */}
                        <SectionCard id="query-pool" number="11" title="Querying Pool Info (Read-Only)">
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
                                    <Typography sx={{ fontWeight: 'bold' }}>Get Pool Reserves and Liquidity</Typography>
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
                                    <Typography sx={{ fontWeight: 'bold' }}>Get User's Liquidity Positions</Typography>
                                </AccordionSummary>
                                <AccordionDetails>
                                    <CodeBlock code={queryPositionsCode} language="JavaScript" />
                                </AccordionDetails>
                            </Accordion>

                            <Accordion>
                                <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                                    <Typography sx={{ fontWeight: 'bold' }}>Get Creator Token Address from Pool</Typography>
                                </AccordionSummary>
                                <AccordionDetails>
                                    <CodeBlock code={queryTokenAddressCode} language="JavaScript" />
                                </AccordionDetails>
                            </Accordion>
                        </SectionCard>

                        {/* Section 12: Full Working Example */}
                        <SectionCard id="full-example" number="12" title="Full Working Example Page">
                            <Typography paragraph>
                                Here's a complete, self-contained HTML page you can save and use. It includes
                                wallet connection, subscribe, buy, sell, and fee collection all on one page.
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
                                            ['"Failed to connect"', 'Make sure you\'ve approved the BlueChip chain in Keplr. Try disconnecting and reconnecting'],
                                            ['"out of gas"', 'Increase the gas limit in the execute() call (e.g., change "500000" to "800000")'],
                                            ['"insufficient funds"', 'You need more BLUECHIP tokens. Check your balance in Keplr'],
                                            ['"rate limited"', 'Commits have a 13-second cooldown per wallet. Wait and try again'],
                                            ['"Pool is not fully committed"', 'Buy/Sell only work after the pool crosses the $25,000 threshold. Use Subscribe instead'],
                                            ['"You do not own this position"', 'Double-check your Position ID. Query positions_by_owner to find your positions'],
                                            ['Transaction stuck / pending', 'The transaction may still be processing. Check the tx hash on your block explorer'],
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
                                These are the addresses you need. Get them from the BlueChip team or your block explorer:
                            </Typography>
                            <TableContainer component={Paper} variant="outlined" sx={{ mb: 2 }}>
                                <Table size="small">
                                    <TableHead>
                                        <TableRow>
                                            <TableCell sx={{ fontWeight: 'bold' }}>Address</TableCell>
                                            <TableCell sx={{ fontWeight: 'bold' }}>What It Is</TableCell>
                                            <TableCell sx={{ fontWeight: 'bold' }}>Where to Find</TableCell>
                                        </TableRow>
                                    </TableHead>
                                    <TableBody>
                                        {[
                                            ['Factory Address', 'Creates new pools', 'Deployment records / block explorer'],
                                            ['Pool Address', 'Your specific creator pool', 'Returned when pool is created (tx hash)'],
                                            ['Creator Token Address', 'The CW20 token for your pool', "Query pool's pair endpoint"],
                                            ['Position NFT Address', 'NFT contract for LP positions', 'Part of pool creation response'],
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
                                How to Find Your Creator Token Address
                            </Typography>
                            <Typography paragraph>
                                After your pool is created, you can find the creator token address by querying:
                            </Typography>
                            <CodeBlock
                                code={`var pairInfo = await client.queryContractSmart("YOUR_POOL_ADDRESS", { pair: {} });
// Look for the creator_token entry in pairInfo.asset_infos`}
                                language="JavaScript"
                            />
                            <Typography variant="body2" color="text.secondary">
                                Or check the pool creation transaction on your block explorer — the token contract
                                address appears in the instantiation events.
                            </Typography>
                        </SectionCard>
                    </Stack>
                </Grid>
            </Grid>
        </Layout>
    );
};

export default IntegrationGuidePage;
