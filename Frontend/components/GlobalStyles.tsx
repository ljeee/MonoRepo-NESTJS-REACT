import React from 'react';
import { Platform } from 'react-native';

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
          background-color: #252932 !important; /* colors.bgLight */
          color: #e8eaed !important; /* colors.text */
          border-color: #3d4451 !important; /* colors.border */
          padding: 10px;
          border-radius: 8px;
          outline: none;
        }

        option {
          background-color: #252932 !important;
          color: #e8eaed !important;
        }

        /* Input autofill fix for dark mode */
        input:-webkit-autofill,
        input:-webkit-autofill:hover, 
        input:-webkit-autofill:focus, 
        input:-webkit-autofill:active{
            -webkit-box-shadow: 0 0 0 30px #252932 inset !important;
            -webkit-text-fill-color: #e8eaed !important;
        }

        /* Custom Scrollbar */
        ::-webkit-scrollbar {
          width: 8px;
          height: 8px;
        }
        ::-webkit-scrollbar-track {
          background: #1a1d23; 
        }
        ::-webkit-scrollbar-thumb {
          background: #3d4451; 
          border-radius: 4px;
        }
        ::-webkit-scrollbar-thumb:hover {
          background: #10b981; 
        }
      `}
        </style>
    );
};
