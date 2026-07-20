import { Slot } from '@radix-ui/react-slot';
import { type VariantProps, cva } from 'class-variance-authority';
import * as React from 'react';

import { cn } from '~/lib/utils';

import { Loading } from '../Loading';

const buttonVariants = cva(
  'inline-flex items-center rounded-md justify-center whitespace-nowrap text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50',
  {
    variants: {
      variant: {
        default:
          'bg-primary text-primary-foreground shadow hover:bg-primary/90',
        destructive:
          'bg-destructive text-destructive-foreground shadow-sm hover:bg-destructive/90',
        outline:
          'border border-input bg-background shadow-sm hover:bg-accent hover:text-accent-foreground',
        secondary:
          'bg-secondary text-secondary-foreground shadow-sm hover:bg-secondary/80',
        ghost: 'hover:text-muted-foreground',
        link: 'text-primary underline-offset-4 hover:underline',
      },
      size: {
        sm: 'h-3 px-1 text-xs',
        default: 'h-4 px-2 text-sm',
        lg: 'h-5 px-3 text-xl',
        icon: 'h-4 w-4',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
  loading?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      children,
      className,
      variant,
      size,
      loading = false,
      asChild = false,
      ...props
    },
    ref,
  ) => {
    const Comp = asChild ? Slot : 'button';
    const loadingColor = () => {
      switch (variant) {
        case 'default':
          return 'fill-primary/80';
        case 'destructive':
          return 'fill-destructive/80';
        case 'outline':
          return 'fill-accent-foreground/80';
        case 'secondary':
          return 'fill-secondary-foreground/80';
        case 'ghost':
          return 'fill-muted-foreground/80';
        case 'link':
          return 'fill-primary/80';
        default:
          return 'fill-primary-foreground/80';
      }
    };

    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      >
        {loading ? <Loading color={loadingColor()} /> : children}
      </Comp>
    );
  },
);
Button.displayName = 'Button';

// eslint-disable-next-line react-refresh/only-export-components -- co-locating the cva variants helper with its component is the shadcn/ui pattern; a separate module is out of scope for the lint pass
export { Button, buttonVariants };
