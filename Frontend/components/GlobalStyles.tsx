import React from 'react';
import { Platform } from 'react-native';

const WEB_GLOBAL_CSS = `
        @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700;800&display=swap');
        @import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@300;400;500;600;700&display=swap');

        * {
          font-family: 'Outfit', -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
        }

        /* Fix Select/Option Visibility in Dark Mode */
        select {
          background-color: #0f172a !important; /* bg-surface color fallback */
          color: #f1f5f9 !important;
          border-color: rgba(255, 255, 255, 0.05) !important;
          padding: 10px;
          border-radius: 8px;
          outline: none;
        }

        option {
          background-color: #0f172a !important;
          color: #f1f5f9 !important;
        }

        /* Input autofill fix for dark mode */
        input:-webkit-autofill,
        input:-webkit-autofill:hover, 
        input:-webkit-autofill:focus, 
        input:-webkit-autofill:active{
          -webkit-box-shadow: 0 0 0 30px #0f172a inset !important;
          -webkit-text-fill-color: #f1f5f9 !important;
        }

        /* Custom Scrollbar */
        ::-webkit-scrollbar {
          width: 8px;
          height: 8px;
        }
        ::-webkit-scrollbar-track {
          background: #020617; /* bg-bg color fallback */
        }
        ::-webkit-scrollbar-thumb {
          background: rgba(255, 255, 255, 0.05); 
          border-radius: 4px;
        }
        ::-webkit-scrollbar-thumb:hover {
          background: #F5A524; /* primary color fallback */
        }
      `;

export const GlobalStyles = () => {
    if (Platform.OS !== 'web') return null;

    return React.createElement('style', {
        type: 'text/css',
        dangerouslySetInnerHTML: { __html: WEB_GLOBAL_CSS },
    } as any);
};
