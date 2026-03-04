import React, { useState } from 'react';
import { IconButton, Tooltip } from '@mui/material';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import CheckIcon from '@mui/icons-material/Check';

interface CopyToClipboardProps {
    text: string;
    size?: 'small' | 'medium';
}

const CopyToClipboard: React.FC<CopyToClipboardProps> = ({ text, size = 'small' }) => {
    const [copied, setCopied] = useState(false);

    const handleCopy = async () => {
        try {
            await navigator.clipboard.writeText(text);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        } catch {
            // Fallback for older browsers
            const textarea = document.createElement('textarea');
            textarea.value = text;
            document.body.appendChild(textarea);
            textarea.select();
            document.execCommand('copy');
            document.body.removeChild(textarea);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        }
    };

    return (
        <Tooltip title={copied ? 'Copied!' : 'Copy to clipboard'}>
            <IconButton onClick={handleCopy} size={size} sx={{ ml: 0.5 }}>
                {copied ? (
                    <CheckIcon fontSize="small" color="success" />
                ) : (
                    <ContentCopyIcon fontSize="small" />
                )}
            </IconButton>
        </Tooltip>
    );
};

export default CopyToClipboard;
