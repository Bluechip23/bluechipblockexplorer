import React, { createContext, useContext, useMemo, useState } from 'react';
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

export const ThemeContextProvider: React.FC<React.PropsWithChildren> = ({ children }) => {
    const [mode, setMode] = useState<ThemeMode>(() => {
        const saved = localStorage.getItem('themeMode');
        return (saved === 'dark' || saved === 'light') ? saved : 'light';
    });

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
                                  default: '#121212',
                                  paper: '#1e1e1e',
                              },
                          }
                        : {}),
                },
            }),
        [mode]
    );

    return (
        <ThemeContext.Provider value={{ mode, toggleTheme }}>
            <MuiThemeProvider theme={theme}>
                <CssBaseline />
                {children}
            </MuiThemeProvider>
        </ThemeContext.Provider>
    );
};
