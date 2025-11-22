"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Trash2, Edit2, X, Check } from "lucide-react";
import type { Role } from "@prisma/client";
import {
  updateWhitelistEmail,
  deleteWhitelistEmail,
} from "@/lib/actions/whitelist.action";
import { useRouter } from "next/navigation";
import { WhitelistAddForm } from "@/components/whitelist-add-form";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface WhitelistEmail {
  id: string;
  email: string;
  role: Role;
  createdAt: Date | string;
  updatedAt: Date | string;
}

interface WhitelistManagerProps {
  initialData: WhitelistEmail[];
}

export function WhitelistManager({ initialData }: WhitelistManagerProps) {
  const [whitelist, setWhitelist] = useState<WhitelistEmail[]>(initialData);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState({ email: "", role: "USER" as Role });
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();

  const handleEdit = (item: WhitelistEmail) => {
    setEditingId(item.id);
    setFormData({ email: item.email, role: item.role });
  };

  const handleUpdate = async () => {
    if (!editingId || !formData.email) {
      toast.error("Email is required");
      return;
    }

    setIsLoading(true);
    try {
      const result = await updateWhitelistEmail(editingId, formData);

      if (!result.success) {
        toast.error(result.error || "Failed to update email");
        return;
      }

      toast.success("Email updated");
      setEditingId(null);
      setFormData({ email: "", role: "USER" });
      router.refresh();
    } catch (error: any) {
      console.error("Error updating whitelist:", error);
      toast.error(error.message || "Failed to update email");
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (
      !confirm("Are you sure you want to remove this email from whitelist?")
    ) {
      return;
    }

    setIsLoading(true);
    try {
      const result = await deleteWhitelistEmail(id);

      if (!result.success) {
        toast.error(result.error || "Failed to delete email");
        return;
      }

      toast.success("Email removed from whitelist");
      router.refresh();
    } catch (error: any) {
      console.error("Error deleting whitelist:", error);
      toast.error(error.message || "Failed to delete email");
    } finally {
      setIsLoading(false);
    }
  };

  const handleCancel = () => {
    setEditingId(null);
    setFormData({ email: "", role: "USER" });
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-semibold">Whitelisted Emails</h2>
        {!editingId && <WhitelistAddForm />}
      </div>

      {editingId && (
        <div className="border rounded-lg p-4 bg-card">
          <FieldGroup>
            <Field>
              <FieldLabel>Email</FieldLabel>
              <Input
                type="email"
                placeholder="user@example.com"
                value={formData.email}
                onChange={(e) =>
                  setFormData({ ...formData, email: e.target.value })
                }
                disabled
              />
            </Field>
            <Field>
              <FieldLabel>Role</FieldLabel>
              <Select
                value={formData.role}
                onValueChange={(value) =>
                  setFormData({ ...formData, role: value as Role })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="USER">USER</SelectItem>
                  <SelectItem value="MODERATOR">MODERATOR</SelectItem>
                  <SelectItem value="ADMIN">ADMIN</SelectItem>
                </SelectContent>
              </Select>
            </Field>
            <div className="flex gap-2">
              <Button onClick={handleUpdate} disabled={isLoading}>
                <Check className="size-4 mr-2" />
                Update
              </Button>
              <Button
                variant="outline"
                onClick={handleCancel}
                disabled={isLoading}
              >
                <X className="size-4 mr-2" />
                Cancel
              </Button>
            </div>
          </FieldGroup>
        </div>
      )}

      {whitelist.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {whitelist.map((item) => (
            <Card key={item.id}>
              <CardHeader>
                <CardTitle>{item.email}</CardTitle>
                <CardDescription>
                  Created: {new Date(item.createdAt).toLocaleDateString()}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Badge variant="secondary">{item.role}</Badge>
              </CardContent>
              <CardFooter className="flex justify-end gap-2">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => handleEdit(item)}
                  disabled={!!editingId || isLoading}
                >
                  <Edit2 className="size-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => handleDelete(item.id)}
                  disabled={!!editingId || isLoading}
                >
                  <Trash2 className="size-4" />
                </Button>
              </CardFooter>
            </Card>
          ))}
        </div>
      )}

      <div className="border rounded-lg">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Email</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Created At</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {whitelist.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={4}
                  className="text-center text-muted-foreground"
                >
                  No whitelisted emails. Add one to get started.
                </TableCell>
              </TableRow>
            ) : (
              whitelist.map((item) => (
                <TableRow key={item.id}>
                  <TableCell className="font-medium">{item.email}</TableCell>
                  <TableCell>
                    <span className="px-2 py-1 rounded bg-muted text-sm">
                      {item.role}
                    </span>
                  </TableCell>
                  <TableCell>
                    {new Date(item.createdAt).toLocaleDateString()}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleEdit(item)}
                        disabled={!!editingId || isLoading}
                      >
                        <Edit2 className="size-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleDelete(item.id)}
                        disabled={!!editingId || isLoading}
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
