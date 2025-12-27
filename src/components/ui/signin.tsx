import { forwardRef, useCallback } from "react";
import { type VariantProps } from "class-variance-authority";
import { Loader2, LogIn, LogOut } from "lucide-react";
import { useAuth } from "@/hooks/use-auth.ts";
import { Button } from "@/components/ui/button.tsx";
import { buttonVariants } from "@/components/ui/button.variants";

export interface SignInButtonProps
  extends Omit<React.ComponentProps<"button">, "onClick">,
    VariantProps<typeof buttonVariants> {
  onClick?: (event: React.MouseEvent<HTMLButtonElement>) => void;
  showIcon?: boolean;
  signInText?: string;
  signOutText?: string;
  loadingText?: string;
  asChild?: boolean;
}

export const SignInButton = forwardRef<HTMLButtonElement, SignInButtonProps>(
  (
    {
      onClick,
      disabled,
      showIcon = true,
      signInText = "Sign In",
      signOutText = "Sign Out",
      loadingText,
      className,
      variant,
      size,
      asChild = false,
      ...props
    },
    ref,
  ) => {
    const { isAuthenticated, loginWithRedirect, logout, isLoading } = useAuth();

    const handleClick = useCallback(
      async (event: React.MouseEvent<HTMLButtonElement>) => {
        event.preventDefault();

        // ✅ CRITICAL: do nothing while Auth0 is hydrating
        if (isLoading) return;

        onClick?.(event);

        try {
          if (!isAuthenticated) {
            await loginWithRedirect({
              authorizationParams: {
                prompt: "login",
              },
            });
            return;
          }

          await logout({
            logoutParams: { returnTo: window.location.origin },
          });
        } catch (err) {
          console.error("Authentication error:", err);
        }
      },
      [isAuthenticated, isLoading, loginWithRedirect, logout, onClick],
    );

    const isDisabled = disabled || isLoading;

    const defaultLoadingText = isAuthenticated
      ? "Signing Out..."
      : "Signing In...";

    const buttonText = isLoading
      ? loadingText || defaultLoadingText
      : isAuthenticated
        ? signOutText
        : signInText;

    const icon = isLoading ? (
      <Loader2 className="size-4 animate-spin" />
    ) : isAuthenticated ? (
      <LogOut className="size-4" />
    ) : (
      <LogIn className="size-4" />
    );

    return (
      <Button
        ref={ref}
        onClick={handleClick}
        disabled={isDisabled}
        variant={variant}
        size={size}
        className={className}
        asChild={asChild}
        aria-label={
          isAuthenticated
            ? "Sign out of your account"
            : "Sign in to your account"
        }
        {...props}
      >
        {showIcon && icon}
        {buttonText}
      </Button>
    );
  },
);

SignInButton.displayName = "SignInButton";
