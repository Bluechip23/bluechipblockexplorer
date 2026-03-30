import React, { useState } from 'react';
import { Box, IconButton, Tooltip } from '@mui/material';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import CheckIcon from '@mui/icons-material/Check';

interface CopyableIdProps {
    value: string;
    children: React.ReactNode;
}

const CopyableId: React.FC<CopyableIdProps> = ({ value, children }) => {
    const [copied, setCopied] = useState(false);

    const handleCopy = async (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        try {
            await navigator.clipboard.writeText(value);
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
        } catch {
            // Fallback for older browsers
            const textarea = document.createElement('textarea');
            textarea.value = value;
            document.body.appendChild(textarea);
            textarea.select();
            document.execCommand('copy');
            document.body.removeChild(textarea);
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
        }
    };

    return (
        <Box component="span" sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.5 }}>
            {children}
            <Tooltip title={copied ? 'Copied!' : 'Copy'} arrow>
                <IconButton
                    size="small"
                    onClick={handleCopy}
                    sx={{ p: 0.25, opacity: 0.6, '&:hover': { opacity: 1 } }}
                >
                    {copied ? (
                        <CheckIcon sx={{ fontSize: 14, color: 'success.main' }} />
                    ) : (
                        <ContentCopyIcon sx={{ fontSize: 14 }} />
                    )}
                </IconButton>
            </Tooltip>
        </Box>
    );
};

export default CopyableId;
