import React, { createContext, useContext, useState, useMemo } from 'react';
import { createTheme, ThemeProvider as MuiThemeProvider, PaletteMode } from '@mui/material';

interface ThemeContextType {
    mode: PaletteMode;
    toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextType>({
    mode: 'light',
    toggleTheme: () => {},
});

export const useThemeMode = () => useContext(ThemeContext);

export const ThemeContextProvider: React.FC<React.PropsWithChildren> = ({ children }) => {
    const [mode, setMode] = useState<PaletteMode>(
        () => (localStorage.getItem('themeMode') as PaletteMode) || 'light'
    );

    const toggleTheme = () => {
        setMode((prev) => {
            const next = prev === 'light' ? 'dark' : 'light';
            localStorage.setItem('themeMode', next);
            return next;
        });
    };

    const theme = useMemo(
        () =>
            createTheme({
                palette: {
                    mode,
                    ...(mode === 'dark'
                        ? {
                              background: {
                                  default: '#1a1a2e',
                                  paper: '#16213e',
                              },
                              primary: { main: '#4fc3f7' },
                              secondary: { main: '#ce93d8' },
                          }
                        : {
                              background: {
                                  default: '#f5f5f5',
                                  paper: '#ffffff',
                              },
                              primary: { main: '#1976d2' },
                              secondary: { main: '#9c27b0' },
                          }),
                },
                components: {
                    MuiTableCell: {
                        styleOverrides: {
                            head: {
                                fontWeight: 600,
                            },
                        },
                    },
                    MuiLink: {
                        styleOverrides: {
                            root: {
                                textDecoration: 'none',
                                '&:hover': { textDecoration: 'underline' },
                            },
                        },
                    },
                },
            }),
        [mode]
    );

    return (
        <ThemeContext.Provider value={{ mode, toggleTheme }}>
            <MuiThemeProvider theme={theme}>{children}</MuiThemeProvider>
        </ThemeContext.Provider>
    );
};
