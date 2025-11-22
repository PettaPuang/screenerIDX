"use client";

import * as React from "react";
import { useForm, type FieldValues, type UseFormReturn } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { type z } from "zod";
import { toast } from "sonner";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
  SheetFooter,
} from "@/components/ui/sheet";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Form, FormContent } from "@/components/ui/form";
import { FieldGroup } from "@/components/ui/field";

interface SheetFormProps<TFieldValues extends FieldValues> {
  trigger: React.ReactNode;
  title: string;
  description?: string;
  schema: z.ZodSchema<TFieldValues>;
  defaultValues: TFieldValues;
  onSubmit: (data: TFieldValues) => Promise<{ success: boolean; error?: string }>;
  children: (form: UseFormReturn<TFieldValues>) => React.ReactNode;
  confirmDialog?: {
    title: string;
    description: (data: TFieldValues) => React.ReactNode;
    loadingMessage?: (data: TFieldValues) => string;
  };
  submitButtonText?: string;
  cancelButtonText?: string;
  successMessage?: string;
  onSuccess?: () => void;
  refreshOnSuccess?: boolean;
}

export function SheetForm<TFieldValues extends FieldValues>({
  trigger,
  title,
  description,
  schema,
  defaultValues,
  onSubmit,
  children,
  confirmDialog,
  submitButtonText = "Submit",
  cancelButtonText = "Cancel",
  successMessage = "Success",
  onSuccess,
  refreshOnSuccess = true,
}: SheetFormProps<TFieldValues>) {
  const router = useRouter();
  const form = useForm<TFieldValues>({
    resolver: zodResolver(schema),
    defaultValues,
  });

  const [open, setOpen] = React.useState(false);
  const [isLoading, setIsLoading] = React.useState(false);
  const [showConfirmDialog, setShowConfirmDialog] = React.useState(false);
  const [pendingData, setPendingData] = React.useState<TFieldValues | null>(null);

  const handleSubmit = async (data: TFieldValues) => {
    if (confirmDialog) {
      setPendingData(data);
      setShowConfirmDialog(true);
    } else {
      await executeSubmit(data);
    }
  };

  const executeSubmit = async (data: TFieldValues) => {
    setIsLoading(true);
    try {
      const result = await onSubmit(data);

      if (!result.success) {
        toast.error(result.error || "Failed to submit");
        setIsLoading(false);
        return;
      }

      toast.success(successMessage);
      form.reset();
      setPendingData(null);
      setIsLoading(false);
      if (confirmDialog) {
        setShowConfirmDialog(false);
      }
      setOpen(false);
      if (refreshOnSuccess) {
        router.refresh();
      }
      onSuccess?.();
    } catch (error: any) {
      console.error("Error submitting form:", error);
      toast.error(error.message || "Failed to submit");
      setIsLoading(false);
    }
  };

  const handleConfirm = async () => {
    if (!pendingData) return;
    await executeSubmit(pendingData);
  };

  return (
    <>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetTrigger asChild>{trigger}</SheetTrigger>
        <SheetContent>
          <SheetHeader>
            <SheetTitle>{title}</SheetTitle>
            {description && <SheetDescription>{description}</SheetDescription>}
          </SheetHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(handleSubmit)}>
              <FormContent className="py-2">
                <FieldGroup>{children(form)}</FieldGroup>
              </FormContent>
              <SheetFooter className="flex-row justify-end">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    form.reset();
                    setOpen(false);
                  }}
                  disabled={isLoading}
                >
                  {cancelButtonText}
                </Button>
                <Button type="submit" disabled={isLoading}>
                  {isLoading ? "Submitting..." : submitButtonText}
                </Button>
              </SheetFooter>
            </form>
          </Form>
        </SheetContent>
      </Sheet>
      {confirmDialog && (
        <AlertDialog
          open={showConfirmDialog}
          onOpenChange={(open) => {
            if (!isLoading) {
              setShowConfirmDialog(open);
            }
          }}
        >
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>
                {isLoading
                  ? confirmDialog.loadingMessage?.(pendingData!) || "Processing..."
                  : confirmDialog.title}
              </AlertDialogTitle>
            </AlertDialogHeader>
            <div className="bg-muted/50 p-4">
              {isLoading ? (
                <div className="flex items-center gap-2">
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                  <AlertDialogDescription>
                    {confirmDialog.loadingMessage?.(pendingData!) || "Processing..."}
                  </AlertDialogDescription>
                </div>
              ) : (
                <AlertDialogDescription>
                  {pendingData && confirmDialog.description(pendingData)}
                </AlertDialogDescription>
              )}
            </div>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={isLoading}>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={handleConfirm} disabled={isLoading}>
                {isLoading ? "Processing..." : "Confirm"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}
    </>
  );
}

