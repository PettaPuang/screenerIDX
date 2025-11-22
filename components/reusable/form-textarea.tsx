"use client";

import { useFormContext, Controller } from "react-hook-form";
import { Field, FieldLabel, FieldContent, FieldError } from "@/components/ui/field";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils/utils";
import type { FieldPath, FieldValues } from "react-hook-form";

interface FormTextareaProps<TFieldValues extends FieldValues> {
  name: FieldPath<TFieldValues>;
  label: string;
  placeholder?: string;
  required?: boolean;
  disabled?: boolean;
  rows?: number;
  className?: string;
}

export function FormTextarea<TFieldValues extends FieldValues>({
  name,
  label,
  placeholder,
  required = false,
  disabled = false,
  rows = 4,
  className,
}: FormTextareaProps<TFieldValues>) {
  const { control } = useFormContext<TFieldValues>();

  return (
    <Controller
      control={control}
      name={name}
      render={({ field, fieldState }) => (
        <div className={cn("flex items-start w-full gap-2", className)}>
          <div className="w-1/4 flex items-center pt-2">
            <FieldLabel htmlFor={name}>
              {label}
              {required && <span className="text-destructive ml-1">*</span>}
            </FieldLabel>
          </div>
          <div className="w-3/4 flex flex-col">
            <Textarea
              id={name}
              placeholder={placeholder}
              disabled={disabled}
              rows={rows}
              {...field}
            />
            <FieldError errors={fieldState.error ? [fieldState.error] : undefined} />
          </div>
        </div>
      )}
    />
  );
}

