import defaultTheme from 'tailwindcss/defaultTheme';

/** @type {import('tailwindcss').Config} */
module.exports = {
    darkMode: ['class'],
    content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
    prefix: '',
    theme: {
    	container: {
    		center: true,
    		padding: '2rem',
    		screens: {
    			'2xl': '1400px'
    		}
    	},
    	extend: {
    		fontFamily: {
    			primary: [
    				'Raleway',
                    ...defaultTheme.fontFamily.sans
                ]
    		},
    		fontSize: {
    			display: ['24px', { lineHeight: '32px', fontWeight: '700' }],
    			heading: ['18px', { lineHeight: '26px', fontWeight: '600' }],
    			subheading: ['15px', { lineHeight: '22px', fontWeight: '600' }],
    			body: ['13px', { lineHeight: '20px' }],
    			caption: ['12px', { lineHeight: '16px' }],
    			metadata: ['11px', { lineHeight: '14px' }]
    		},
    		colors: {
    			border: 'hsl(var(--border))',
    			input: 'hsl(var(--input))',
    			ring: 'hsl(var(--ring))',
    			background: 'hsl(var(--background))',
    			foreground: 'hsl(var(--foreground))',
    			subtitle: 'hsl(var(--subtitle))',
    			primary: {
    				DEFAULT: 'hsl(var(--primary))',
    				foreground: 'hsl(var(--primary-foreground))'
    			},
    			secondary: {
    				DEFAULT: 'hsl(var(--secondary))',
    				foreground: 'hsl(var(--secondary-foreground))'
    			},
    			destructive: {
    				DEFAULT: 'hsl(var(--destructive))',
    				foreground: 'hsl(var(--destructive-foreground))'
    			},
    			success: {
    				DEFAULT: 'hsl(var(--success))',
    				foreground: 'hsl(var(--success-foreground))'
    			},
    			warning: {
    				DEFAULT: 'hsl(var(--warning))',
    				foreground: 'hsl(var(--warning-foreground))'
    			},
    			info: {
    				DEFAULT: 'hsl(var(--info))',
    				foreground: 'hsl(var(--info-foreground))'
    			},
    			muted: {
    				DEFAULT: 'hsl(var(--muted))',
    				foreground: 'hsl(var(--muted-foreground))'
    			},
    			accent: {
    				DEFAULT: 'hsl(var(--accent))',
    				foreground: 'hsl(var(--accent-foreground))'
    			},
    			popover: {
    				DEFAULT: 'hsl(var(--popover))',
    				foreground: 'hsl(var(--popover-foreground))'
    			},
    			card: {
    				DEFAULT: 'hsl(var(--card))',
    				foreground: 'hsl(var(--card-foreground))'
    			},
    			sidebar: {
    				DEFAULT: 'hsl(var(--sidebar-background))',
    				foreground: 'hsl(var(--sidebar-foreground))',
    				primary: 'hsl(var(--sidebar-primary))',
    				'primary-foreground': 'hsl(var(--sidebar-primary-foreground))',
    				accent: 'hsl(var(--sidebar-accent))',
    				'accent-foreground': 'hsl(var(--sidebar-accent-foreground))',
    				border: 'hsl(var(--sidebar-border))',
    				ring: 'hsl(var(--sidebar-ring))'
    			}
    		},
    		borderRadius: {
    			xl: 'var(--radius-xl)',
    			lg: 'var(--radius-lg)',
    			md: 'var(--radius-md)',
    			sm: 'var(--radius-sm)'
    		},
    		keyframes: {
    			'accordion-down': {
    				from: {
    					height: '0'
    				},
    				to: {
    					height: 'var(--radix-accordion-content-height)'
    				}
    			},
    			'accordion-up': {
    				from: {
    					height: 'var(--radix-accordion-content-height)'
    				},
    				to: {
    					height: '0'
    				}
    			},
    			scale: {
    				'0%': {
    					transform: 'scale(1)'
    				},
    				'50%': {
    					transform: 'scale(1.05)'
    				},
    				'100%': {
    					transform: 'scale(1)'
    				}
    			},
    			'scale-2': {
    				'0%': {
    					transform: 'scale(1)'
    				},
    				'50%': {
    					transform: 'scale(1.05)'
    				},
    				'100%': {
    					transform: 'scale(1)'
    				}
    			},
    			blink: {
    				'0%, 100%': {
    					opacity: '1'
    				},
    				'50%': {
    					opacity: '0'
    				}
    			}
    		},
    		animation: {
    			'accordion-down': 'accordion-down 0.2s ease-out',
    			'accordion-up': 'accordion-up 0.2s ease-out',
    			scale: 'scale 1s ease-in-out 1',
    			'scale-2': 'scale-2 1s ease-in-out 2',
    			blink: 'blink 1s infinite'
    		}
    	}
    },
    plugins: [require('tailwindcss-animate')],
};
