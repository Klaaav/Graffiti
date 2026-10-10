import React from 'react';

type ButtonVariant = 'primary' | 'secondary' | 'outline';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  children: React.ReactNode;
  className?: string;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = 'primary', children, className = '', ...props }, ref) => {
    const baseStyles = 
      "inline-flex items-center justify-center px-6 py-3 text-sm font-bold uppercase tracking-wider transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-2 focus:ring-offset-background disabled:opacity-50 disabled:cursor-not-allowed";
    
    // Explicitly defining font-mono here since the tokens say labels/buttons could use mono, 
    // or we can use sans depending on design. Let's use clash display or mono for impact.
    // Design tokens state: IBM Plex Mono for technical/small labels. Let's use sans for button or mono.
    // Let's use font-sans and uppercase.
    
    const variants = {
      primary: "bg-[var(--color-accent)] text-background hover:bg-[var(--color-accent-hover)] hover:-translate-y-1 hover:shadow-[0_0_15px_rgba(0,240,255,0.4)]",
      secondary: "bg-[var(--color-border)] text-primary hover:bg-[#3f3f46] hover:-translate-y-1",
      outline: "border border-[var(--color-border)] text-primary hover:border-[var(--color-accent)] hover:text-[var(--color-accent)]"
    };

    return (
      <button
        ref={ref}
        className={`${baseStyles} ${variants[variant]} ${className}`}
        // Using custom easing from our design tokens
        style={{ transitionTimingFunction: 'var(--ease-out-expo)' }}
        {...props}
      >
        {children}
      </button>
    );
  }
);

Button.displayName = 'Button';
