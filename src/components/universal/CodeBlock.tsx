import React, { useState } from 'react';
import {
    Alert,
    Box,
    Chip,
    IconButton,
    Snackbar,
} from '@mui/material';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';

interface CodeBlockProps {
    code: string;
    language?: string;
}

const CodeBlock: React.FC<CodeBlockProps> = ({ code, language }) => {
    const [copied, setCopied] = useState(false);

    const handleCopy = () => {
        navigator.clipboard.writeText(code);
        setCopied(true);
    };

    return (
        <Box sx={{ position: 'relative', my: 2 }}>
            {language && (
                <Chip
                    label={language}
                    size="small"
                    sx={{
                        position: 'absolute',
                        top: 8,
                        left: 12,
                        zIndex: 1,
                        fontSize: '0.7rem',
                        height: 22,
                        bgcolor: 'rgba(255,255,255,0.15)',
                        color: '#e0e0e0',
                    }}
                />
            )}
            <IconButton
                onClick={handleCopy}
                size="small"
                sx={{
                    position: 'absolute',
                    top: 6,
                    right: 6,
                    zIndex: 1,
                    color: '#aaa',
                    '&:hover': { color: '#fff', bgcolor: 'rgba(255,255,255,0.1)' },
                }}
            >
                <ContentCopyIcon fontSize="small" />
            </IconButton>
            <Box
                component="pre"
                sx={{
                    bgcolor: '#1e1e1e',
                    color: '#d4d4d4',
                    p: 2,
                    pt: language ? 4 : 2,
                    borderRadius: 2,
                    overflow: 'auto',
                    fontSize: '0.82rem',
                    lineHeight: 1.6,
                    fontFamily: '"Fira Code", "Consolas", "Monaco", monospace',
                    maxHeight: 500,
                    '&::-webkit-scrollbar': { height: 6, width: 6 },
                    '&::-webkit-scrollbar-thumb': { bgcolor: '#555', borderRadius: 3 },
                }}
            >
                <code>{code}</code>
            </Box>
            <Snackbar
                open={copied}
                autoHideDuration={2000}
                onClose={() => setCopied(false)}
                anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
            >
                <Alert severity="success" variant="filled" sx={{ width: '100%' }}>
                    Copied to clipboard!
                </Alert>
            </Snackbar>
        </Box>
    );
};

export default CodeBlock;
