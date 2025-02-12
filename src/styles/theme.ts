export const theme = {
  colors: {
    primary: {
      light: '#3B82F6',  // Soft Blue
      main: '#2563EB',   // Deeper Blue
      dark: '#1D4ED8',   // Dark Blue
    },
    secondary: {
      light: '#10B981',  // Soft Green
      main: '#059669',   // Deeper Green
      dark: '#047857',   // Dark Green
    },
    background: {
      light: '#F3F4F6',  // Light Gray
      main: '#E5E7EB',   // Medium Gray
      dark: '#D1D5DB',   // Dark Gray
    },
    text: {
      primary: '#111827', // Almost Black
      secondary: '#4B5563', // Dark Gray
      tertiary: '#6B7280', // Light Gray
    },
    error: {
      light: '#F87171',  // Soft Red
      main: '#EF4444',   // Deeper Red
      dark: '#DC2626',   // Dark Red
    },
    success: {
      light: '#34D399',  // Soft Green
      main: '#10B981',   // Deeper Green
      dark: '#059669',   // Dark Green
    }
  },
  typography: {
    fontFamily: "'Inter', sans-serif",
    fontSize: {
      small: '0.75rem',
      base: '1rem',
      large: '1.25rem',
      heading: '1.5rem'
    }
  },
  spacing: {
    xs: '0.25rem',
    sm: '0.5rem',
    md: '1rem',
    lg: '1.5rem',
    xl: '2rem'
  },
  borderRadius: {
    sm: '0.25rem',
    md: '0.5rem',
    lg: '0.75rem',
    full: '9999px'
  }
};

export const darkTheme = {
  colors: {
    primary: {
      light: '#60A5FA',  // Lighter Blue
      main: '#3B82F6',   // Soft Blue
      dark: '#2563EB',   // Deeper Blue
    },
    secondary: {
      light: '#6EE7B7',  // Lighter Green
      main: '#34D399',   // Soft Green
      dark: '#10B981',   // Deeper Green
    },
    background: {
      light: '#1F2937',  // Dark Gray
      main: '#111827',   // Darker Gray
      dark: '#0F172A',   // Almost Black
    },
    text: {
      primary: '#F9FAFB', // Almost White
      secondary: '#E5E7EB', // Light Gray
      tertiary: '#9CA3AF', // Medium Gray
    },
    error: {
      light: '#FCA5A5',  // Soft Red
      main: '#F87171',   // Deeper Red
      dark: '#EF4444',   // Dark Red
    },
    success: {
      light: '#6EE7B7',  // Soft Green
      main: '#34D399',   // Deeper Green
      dark: '#10B981',   // Dark Green
    }
  },
  typography: theme.typography,
  spacing: theme.spacing,
  borderRadius: theme.borderRadius
};
