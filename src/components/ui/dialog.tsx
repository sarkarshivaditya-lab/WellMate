import * as React from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { XIcon } from "lucide-react";
import { cn } from "@/lib/utils.ts";

function Dialog(
  props: React.ComponentProps<typeof DialogPrimitive.Root>,
) {
  return <DialogPrimitive.Root data-slot="dialog" {...props} />;
}

function DialogTrigger(
  props: React.ComponentProps<typeof DialogPrimitive.Trigger>,
) {
  return (
    <DialogPrimitive.Trigger
      data-slot="dialog-trigger"
      {...props}
    />
  );
}

function DialogPortal(
  props: React.ComponentProps<typeof DialogPrimitive.Portal>,
) {
  return <DialogPrimitive.Portal data-slot="dialog-portal" {...props} />;
}

function DialogClose(
  props: React.ComponentProps<typeof DialogPrimitive.Close>,
) {
  return <DialogPrimitive.Close data-slot="dialog-close" {...props} />;
}

/* ======================================================
   STAGE 6 — MODAL BACKDROP
   ====================================================== */
function DialogOverlay({
  className,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Overlay>) {
  return (
    <DialogPrimitive.Overlay
      data-slot="dialog-overlay"
      className={cn(
        [
          "fixed inset-0 z-50",
          "bg-black/65 backdrop-blur-[2px]",

          /* Motion */
          "data-[state=open]:animate-in data-[state=closed]:animate-out",
          "data-[state=open]:fade-in-0 data-[state=closed]:fade-out-0",
        ].join(" "),
        className,
      )}
      {...props}
    />
  );
}

/* ======================================================
   STAGE 6 — MODAL SURFACE
   ====================================================== */
function DialogContent({
  className,
  children,
  showCloseButton = true,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Content> & {
  showCloseButton?: boolean;
}) {
  return (
    <DialogPortal>
      <DialogOverlay />
      <DialogPrimitive.Content
        data-slot="dialog-content"
        className={cn(
          [
            /* Positioning */
            "fixed left-1/2 top-1/2 z-50",
            "w-full max-w-[calc(100%-2rem)] sm:max-w-lg",
            "-translate-x-1/2 -translate-y-1/2",

            /* Surface */
            "bg-card text-card-foreground",
            "rounded-xl",
            "ring-1 ring-border/30",
            "shadow-card",

            /* Layout */
            "grid gap-4 p-6",

            /* Mobile keyboard safety — dvh tracks the visual viewport
               (shrinks when iOS keyboard opens), so max-h stays within
               what is actually visible. overflow-y-auto lets the browser
               scroll focused inputs into view above the keyboard. */
            "max-h-[85dvh] overflow-y-auto",

            /* Motion — weighted, not floaty */
            "data-[state=open]:animate-in data-[state=closed]:animate-out",
            "data-[state=open]:fade-in-0 data-[state=closed]:fade-out-0",
            "data-[state=open]:slide-in-from-bottom-2",
            "data-[state=closed]:slide-out-to-bottom-2",

            "duration-200",
          ].join(" "),
          className,
        )}
        {...props}
      >
        {children}

        {showCloseButton && (
          <DialogPrimitive.Close
            data-slot="dialog-close"
            className={cn(
              [
                "absolute right-4 top-4 rounded-sm",
                "opacity-70 hover:opacity-100 transition-opacity",

                "focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
                "ring-offset-card",

                "[&_svg]:size-4 [&_svg]:pointer-events-none",
              ].join(" "),
            )}
          >
            <XIcon />
            <span className="sr-only">Close</span>
          </DialogPrimitive.Close>
        )}
      </DialogPrimitive.Content>
    </DialogPortal>
  );
}

function DialogHeader({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="dialog-header"
      className={cn(
        "flex flex-col gap-2 text-center sm:text-left",
        className,
      )}
      {...props}
    />
  );
}

function DialogFooter({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="dialog-footer"
      className={cn(
        "flex flex-col-reverse gap-2 sm:flex-row sm:justify-end",
        className,
      )}
      {...props}
    />
  );
}

function DialogTitle({
  className,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Title>) {
  return (
    <DialogPrimitive.Title
      data-slot="dialog-title"
      className={cn("text-lg font-semibold leading-none", className)}
      {...props}
    />
  );
}

function DialogDescription({
  className,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Description>) {
  return (
    <DialogPrimitive.Description
      data-slot="dialog-description"
      className={cn("text-sm text-muted-foreground", className)}
      {...props}
    />
  );
}

export {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogOverlay,
  DialogPortal,
  DialogTitle,
  DialogTrigger,
};
