export const theme = {
  colors: {
    primary: {
      light: 'bg-blue-50',
      DEFAULT: 'bg-blue-600',
      dark: 'bg-blue-700',
      text: 'text-blue-600',
      hover: 'hover:bg-blue-700'
    },
    secondary: {
      light: 'bg-purple-50',
      DEFAULT: 'bg-purple-600',
      dark: 'bg-purple-700',
      text: 'text-purple-600'
    },
    accent: {
      light: 'bg-rose-50',
      DEFAULT: 'bg-rose-600',
      dark: 'bg-rose-700',
      text: 'text-rose-600'
    }
  },
  components: {
    button: {
      primary: "flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors",
      secondary: "flex items-center px-4 py-2 border border-purple-200 text-purple-700 rounded-lg hover:bg-purple-50 transition-colors",
      danger: "flex items-center px-4 py-2 bg-rose-600 text-white rounded-lg hover:bg-rose-700 transition-colors"
    },
    card: "bg-white rounded-xl shadow-sm border border-blue-100/50 p-6",
    input: "w-full p-2 border border-blue-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent",
    badge: {
      success: "bg-green-100 text-green-800",
      error: "bg-rose-100 text-rose-800",
      warning: "bg-amber-100 text-amber-800",
      info: "bg-blue-100 text-blue-800"
    }
  },
  typography: {
    h1: 'text-4xl font-bold',
    h2: 'text-3xl font-bold',
    h3: 'text-2xl font-bold',
    h4: 'text-xl font-bold',
    body: 'text-base',
    small: 'text-sm'
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
    lg: '1rem',
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
  typography: {
    h1: 'text-4xl font-bold',
    h2: 'text-3xl font-bold',
    h3: 'text-2xl font-bold',
    h4: 'text-xl font-bold',
    body: 'text-base',
    small: 'text-sm'
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
    lg: '1rem',
    full: '9999px'
  }
};
