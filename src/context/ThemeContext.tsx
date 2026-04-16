import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';
import { createTheme, ThemeProvider as MuiThemeProvider } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';

type ThemeMode = 'light' | 'dark';

interface ThemeContextType {
    mode: ThemeMode;
    toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextType>({
    mode: 'light',
    toggleTheme: () => {},
});

export const useThemeMode = () => useContext(ThemeContext);

// Safari private mode and sandboxed iframes throw on localStorage access.
function readStoredMode(): ThemeMode {
    try {
        const saved = localStorage.getItem('themeMode');
        return saved === 'dark' || saved === 'light' ? saved : 'light';
    } catch {
        return 'light';
    }
}

function writeStoredMode(mode: ThemeMode): void {
    try {
        localStorage.setItem('themeMode', mode);
    } catch {
        // Storage unavailable — preference stays in-memory for this session.
    }
}

export const ThemeContextProvider: React.FC<React.PropsWithChildren> = ({ children }) => {
    const [mode, setMode] = useState<ThemeMode>(readStoredMode);

    const toggleTheme = useCallback(() => {
        setMode((prev) => {
            const next = prev === 'light' ? 'dark' : 'light';
            writeStoredMode(next);
            return next;
        });
    }, []);

    const theme = useMemo(
        () =>
            createTheme({
                palette: {
                    mode,
                    ...(mode === 'dark'
                        ? {
                              background: {
                                  default: '#121212',
                                  paper: '#1e1e1e',
                              },
                          }
                        : {}),
                },
            }),
        [mode]
    );

    const value = useMemo(() => ({ mode, toggleTheme }), [mode, toggleTheme]);

    return (
        <ThemeContext.Provider value={value}>
            <MuiThemeProvider theme={theme}>
                <CssBaseline />
                {children}
            </MuiThemeProvider>
        </ThemeContext.Provider>
    );
};
