"use client";

import { useFormContext, Controller } from "react-hook-form";
import {
  Field,
  FieldLabel,
  FieldContent,
  FieldError,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils/utils";
import type { FieldPath, FieldValues } from "react-hook-form";

interface FormInputProps<TFieldValues extends FieldValues> {
  name: FieldPath<TFieldValues>;
  label: string;
  placeholder?: string;
  type?: string;
  required?: boolean;
  disabled?: boolean;
  className?: string;
}

export function FormInput<TFieldValues extends FieldValues>({
  name,
  label,
  placeholder,
  type = "text",
  required = false,
  disabled = false,
  className,
}: FormInputProps<TFieldValues>) {
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
            <Input
              id={name}
              type={type}
              placeholder={placeholder}
              disabled={disabled}
              {...field}
            />
            <FieldError
              errors={fieldState.error ? [fieldState.error] : undefined}
            />
          </div>
        </div>
      )}
    />
  );
}
