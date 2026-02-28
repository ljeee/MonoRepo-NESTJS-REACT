import React from 'react';
import { Platform } from 'react-native';
import { colors } from '../styles/theme';

export const GlobalStyles = () => {
    if (Platform.OS !== 'web') return null;

    return (
        <style type="text/css">
            {`
        @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700;800&display=swap');

        * {
          font-family: 'Outfit', -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
        }

        /* Fix Select/Option Visibility in Dark Mode */
        select {
          background-color: ${colors.bgLight} !important;
          color: ${colors.text} !important;
          border-color: ${colors.border} !important;
          padding: 10px;
          border-radius: 8px;
          outline: none;
        }

        option {
          background-color: ${colors.bgLight} !important;
          color: ${colors.text} !important;
        }

        /* Input autofill fix for dark mode */
        input:-webkit-autofill,
        input:-webkit-autofill:hover, 
        input:-webkit-autofill:focus, 
        input:-webkit-autofill:active{
          -webkit-box-shadow: 0 0 0 30px ${colors.bgLight} inset !important;
          -webkit-text-fill-color: ${colors.text} !important;
        }

        /* Custom Scrollbar */
        ::-webkit-scrollbar {
          width: 8px;
          height: 8px;
        }
        ::-webkit-scrollbar-track {
          background: ${colors.bg}; 
        }
        ::-webkit-scrollbar-thumb {
          background: ${colors.border}; 
          border-radius: 4px;
        }
        ::-webkit-scrollbar-thumb:hover {
          background: ${colors.success}; 
        }
      `}
        </style>
    );
};
