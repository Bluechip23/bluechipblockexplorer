import React, { useState } from 'react';
import { Box, Card, CardContent, IconButton, Tooltip, Typography } from '@mui/material';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import CheckIcon from '@mui/icons-material/Check';
import { CHAIN_CONFIG } from '../../defi/types';
import { rpcEndpoint, apiEndpoint } from '../universal/IndividualPage.const';

// Published widget bundle (see widget/README.md). Creators paste this
// snippet into any site to get a subscribe button for their pool.
const WIDGET_SRC = 'https://cdn.jsdelivr.net/gh/Bluechip23/bluechipblockexplorer@main/widget/dist/bluechip-widget.min.js';

export interface EmbedSnippetCardProps {
    poolAddress: string;
}

/**
 * Copyable snippet that embeds the BlueChip subscribe widget for the
 * creator's pool on any external website.
 *
 * The widget mounts into elements carrying `data-bluechip-subscribe`
 * (scan() replaces the element's children), so the marker must live on a
 * regular element — NOT on the <script> tag itself, where the injected
 * button would be invisible. The init() line pins the widget to the same
 * network this explorer build runs on; without it the bundle falls back
 * to its compiled-in default chain.
 */
const EmbedSnippetCard: React.FC<EmbedSnippetCardProps> = ({ poolAddress }) => {
    const [copied, setCopied] = useState(false);
    const snippet = [
        `<div data-bluechip-subscribe data-pool="${poolAddress}" data-amount="5"></div>`,
        `<script src="${WIDGET_SRC}"></script>`,
        `<script>BluechipWidget.init({ chainId: "${CHAIN_CONFIG.chainId}", chainName: "${CHAIN_CONFIG.chainName}", rpc: "${rpcEndpoint}", rest: "${apiEndpoint}" });</script>`,
    ].join('\n');

    const copy = async () => {
        try {
            await navigator.clipboard.writeText(snippet);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        } catch {
            // Clipboard can be unavailable (permissions / insecure context).
        }
    };

    return (
        <Card>
            <CardContent>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Typography variant="subtitle1" fontWeight="bold">
                        Embed a subscribe button on your site
                    </Typography>
                    <Tooltip title={copied ? 'Copied!' : 'Copy snippet'}>
                        <IconButton onClick={copy} size="small">
                            {copied ? <CheckIcon fontSize="small" color="success" /> : <ContentCopyIcon fontSize="small" />}
                        </IconButton>
                    </Tooltip>
                </Box>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                    Paste this anywhere in your page's HTML — it renders a subscribe
                    button wired to your pool.
                </Typography>
                <Box
                    component="pre"
                    sx={{
                        m: 0, p: 1.5, borderRadius: 1, bgcolor: 'action.hover',
                        fontFamily: 'monospace', fontSize: '0.75rem',
                        whiteSpace: 'pre-wrap', wordBreak: 'break-all',
                    }}
                >
                    {snippet}
                </Box>
            </CardContent>
        </Card>
    );
};

export default EmbedSnippetCard;
