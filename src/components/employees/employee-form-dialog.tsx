"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";
import type { Role, UserStatus } from "@prisma/client";
import { createEmployeeAction, updateEmployeeAction } from "@/actions/employees";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export interface EmployeeRow {
  id: string;
  name: string;
  email: string;
  avatarUrl: string | null;
  designation: string | null;
  role: Role;
  status: UserStatus;
  departmentId: string | null;
  department: { id: string; name: string } | null;
  createdAt: string;
  stats: {
    totalTasks: number;
    completedTasks: number;
    activeTasks: number;
    overdueTasks: number;
    projectCount: number;
  };
}

const formSchema = z.object({
  name: z.string().min(2, "Full name is required"),
  email: z.string().email("Valid work email is required"),
  password: z.string().optional(),
  role: z.enum(["ADMIN", "MANAGER", "EMPLOYEE"]),
  status: z.enum(["ACTIVE", "INACTIVE", "INVITED"]),
  departmentId: z.string().optional(),
  designation: z.string().optional(),
  avatarUrl: z.string().optional(),
});

type FormValues = z.infer<typeof formSchema>;

export function EmployeeFormDialog({
  open,
  onOpenChange,
  departments,
  editingEmployee,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  departments: { id: string; name: string }[];
  editingEmployee: EmployeeRow | null;
}) {
  const router = useRouter();

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: "",
      email: "",
      password: "",
      role: "EMPLOYEE",
      status: "ACTIVE",
      departmentId: "",
      designation: "",
      avatarUrl: "",
    },
  });

  useEffect(() => {
    if (!open) return;
    if (editingEmployee) {
      reset({
        name: editingEmployee.name,
        email: editingEmployee.email,
        password: "",
        role: editingEmployee.role,
        status: editingEmployee.status,
        departmentId: editingEmployee.departmentId || "",
        designation: editingEmployee.designation || "",
        avatarUrl: editingEmployee.avatarUrl || "",
      });
    } else {
      reset({
        name: "",
        email: "",
        password: "",
        role: "EMPLOYEE",
        status: "INVITED",
        departmentId: departments[0]?.id || "",
        designation: "",
        avatarUrl: "",
      });
    }
  }, [open, editingEmployee, departments, reset]);

  const role = watch("role");
  const status = watch("status");
  const departmentId = watch("departmentId");

  const onSubmit = async (values: FormValues) => {
    if (!editingEmployee && (!values.password || values.password.length < 8)) {
      toast.error("Temporary password must be at least 8 characters");
      return;
    }

    const payload = {
      name: values.name,
      email: values.email,
      role: values.role,
      status: values.status,
      departmentId: values.departmentId || null,
      designation: values.designation || null,
      avatarUrl: values.avatarUrl || null,
      password: values.password || "",
    };

    const res = editingEmployee
      ? await updateEmployeeAction({ ...payload, id: editingEmployee.id })
      : await createEmployeeAction(payload);

    if (res.error) {
      toast.error(res.error);
      return;
    }

    toast.success(
      editingEmployee ? "Employee profile updated" : "Employee invited"
    );
    onOpenChange(false);
    router.refresh();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {editingEmployee ? "Edit Employee" : "Invite Employee"}
          </DialogTitle>
          <DialogDescription>
            {editingEmployee
              ? "Update profile details, department assignment, role, and account status."
              : "Add a new team member with role-based permissions."}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-3.5">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="emp-name">Full Name</Label>
              <Input
                id="emp-name"
                placeholder="Jordan Taylor"
                {...register("name")}
              />
              {errors.name && (
                <p className="text-[11px] text-red-600">{errors.name.message}</p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="emp-email">Work Email</Label>
              <Input
                id="emp-email"
                type="email"
                placeholder="jordan@meridian.io"
                {...register("email")}
              />
              {errors.email && (
                <p className="text-[11px] text-red-600">
                  {errors.email.message}
                </p>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Department</Label>
              <Select
                value={departmentId || "__none__"}
                onValueChange={(v) =>
                  setValue("departmentId", v === "__none__" ? "" : v)
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select department" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">No Department</SelectItem>
                  {departments.map((d) => (
                    <SelectItem key={d.id} value={d.id}>
                      {d.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="emp-desig">Designation</Label>
              <Input
                id="emp-desig"
                placeholder="Senior Software Engineer"
                {...register("designation")}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Permission Role</Label>
              <Select
                value={role}
                onValueChange={(v) => setValue("role", v as Role)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ADMIN">Admin (Full access)</SelectItem>
                  <SelectItem value="MANAGER">Manager (Projects &amp; Team)</SelectItem>
                  <SelectItem value="EMPLOYEE">Employee (Assigned work)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label>Account Status</Label>
              <Select
                value={status}
                onValueChange={(v) => setValue("status", v as UserStatus)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ACTIVE">Active</SelectItem>
                  <SelectItem value="INVITED">Invited</SelectItem>
                  <SelectItem value="INACTIVE">Inactive</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="emp-pass">
              {editingEmployee
                ? "Reset Password (optional)"
                : "Temporary Password"}
            </Label>
            <Input
              id="emp-pass"
              type="password"
              placeholder={
                editingEmployee
                  ? "Leave blank to keep current password"
                  : "Minimum 8 characters"
              }
              {...register("password")}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="emp-avatar">Profile Picture URL (optional)</Label>
            <Input
              id="emp-avatar"
              type="url"
              placeholder="https://..."
              {...register("avatarUrl")}
            />
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              {editingEmployee ? "Save Changes" : "Invite Employee"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
