"use client";

import * as React from "react";
import { z } from "zod";
import { Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { SheetForm } from "@/components/reusable";
import { FormInput, FormSelect, FormTextarea } from "@/components/reusable";
import {
  whitelistEmailSchema,
  type WhitelistEmailInput,
} from "@/lib/validations/whitelist";
import { createWhitelistEmail } from "@/lib/actions/whitelist.action";

const roleOptions = [
  { value: "USER", label: "USER" },
  { value: "MODERATOR", label: "MODERATOR" },
  { value: "ADMIN", label: "ADMIN" },
];

const schema = whitelistEmailSchema.extend({
  notes: z.string().optional(),
});

export function WhitelistAddForm() {
  return (
    <SheetForm<WhitelistEmailInput & { notes?: string }>
      trigger={
        <Button>
          <Plus className="size-4 mr-2" />
          Add Email
        </Button>
      }
      title="Add Email to Whitelist"
      description="Add a new email address to the whitelist with a specific role."
      schema={schema}
      defaultValues={{
        email: "",
        role: "USER",
        notes: "",
      }}
      onSubmit={async (data) => {
        return await createWhitelistEmail(data);
      }}
      confirmDialog={{
        title: "Confirm Add Email",
        description: (data) => (
          <>
            Are you sure you want to add <strong>{data.email}</strong> to the
            whitelist with role <strong>{data.role}</strong>?
          </>
        ),
        loadingMessage: (data) => `Adding ${data.email} to the whitelist...`,
      }}
      submitButtonText="Add Email"
      successMessage="Email added to whitelist"
    >
      {(form) => (
        <>
          <FormInput
            name="email"
            label="Email"
            type="email"
            placeholder="user@example.com"
            required
            disabled={form.formState.isSubmitting}
          />
          <FormSelect
            name="role"
            label="Role"
            options={roleOptions}
            placeholder="Select role"
            required
            disabled={form.formState.isSubmitting}
          />
          <FormTextarea
            name="notes"
            label="Notes"
            placeholder="Optional notes about this email..."
            rows={3}
            disabled={form.formState.isSubmitting}
          />
          <FormTextarea
            name="notes"
            label="Notes"
            placeholder="Optional notes about this email..."
            rows={3}
            disabled={form.formState.isSubmitting}
          />
        </>
      )}
    </SheetForm>
  );
}
