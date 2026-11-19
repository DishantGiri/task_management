"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Building2, KeyRound, Loader2, Plus, Tag, Trash2, User } from "lucide-react";
import { toast } from "sonner";
import type { SessionUser } from "@/lib/permissions";
import {
  changePasswordAction,
  createDepartmentAction,
  createTagAction,
  deleteDepartmentAction,
  deleteTagAction,
  updateProfileAction,
} from "@/actions/employees";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { RoleBadge } from "@/components/shared/badges";

export function SettingsClient({
  user,
  departments,
  tags,
}: {
  user: SessionUser;
  departments: { id: string; name: string; description: string | null; _count: { users: number } }[];
  tags: { id: string; name: string; color: string; _count: { tasks: number } }[];
}) {
  const router = useRouter();

  // Profile form
  const [name, setName] = useState(user.name);
  const [designation, setDesignation] = useState(user.designation || "");
  const [avatarUrl, setAvatarUrl] = useState(user.avatarUrl || "");
  const [savingProfile, setSavingProfile] = useState(false);

  // Password form
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [savingPassword, setSavingPassword] = useState(false);

  // Department form
  const [deptName, setDeptName] = useState("");
  const [deptDesc, setDeptDesc] = useState("");
  const [savingDept, setSavingDept] = useState(false);

  // Tag form
  const [tagName, setTagName] = useState("");
  const [tagColor, setTagColor] = useState("#635BDB");
  const [savingTag, setSavingTag] = useState(false);

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingProfile(true);
    const res = await updateProfileAction({ name, designation, avatarUrl });
    setSavingProfile(false);
    if (res.error) {
      toast.error(res.error);
      return;
    }
    toast.success("Profile updated");
    router.refresh();
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingPassword(true);
    const res = await changePasswordAction({ currentPassword, newPassword });
    setSavingPassword(false);
    if (res.error) {
      toast.error(res.error);
      return;
    }
    toast.success("Password updated successfully");
    setCurrentPassword("");
    setNewPassword("");
  };

  const handleAddDepartment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!deptName.trim()) return;
    setSavingDept(true);
    const res = await createDepartmentAction({
      name: deptName.trim(),
      description: deptDesc.trim() || null,
    });
    setSavingDept(false);
    if (res.error) {
      toast.error(res.error);
      return;
    }
    toast.success("Department created");
    setDeptName("");
    setDeptDesc("");
    router.refresh();
  };

  const handleDeleteDept = async (id: string) => {
    const res = await deleteDepartmentAction(id);
    if (res.error) {
      toast.error(res.error);
      return;
    }
    toast.success("Department removed");
    router.refresh();
  };

  const handleAddTag = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tagName.trim()) return;
    setSavingTag(true);
    const res = await createTagAction({
      name: tagName.trim(),
      color: tagColor,
    });
    setSavingTag(false);
    if (res.error) {
      toast.error(res.error);
      return;
    }
    toast.success("Tag created");
    setTagName("");
    router.refresh();
  };

  const handleDeleteTag = async (id: string) => {
    const res = await deleteTagAction(id);
    if (res.error) {
      toast.error(res.error);
      return;
    }
    toast.success("Tag deleted");
    router.refresh();
  };

  const isAdmin = user.role === "ADMIN";
  const canManageTags = user.role === "ADMIN" || user.role === "MANAGER";

  return (
    <div className="space-y-5 max-w-4xl">
      <div>
        <h1 className="text-[24px] font-semibold tracking-tight text-[#20232B]">
          Settings
        </h1>
        <p className="text-[13px] text-[#737987] mt-0.5">
          Manage your profile, account security, company departments, and workspace labels.
        </p>
      </div>

      <Tabs defaultValue="profile">
        <TabsList>
          <TabsTrigger value="profile" className="gap-1.5">
            <User className="h-3.5 w-3.5" />
            Profile
          </TabsTrigger>
          <TabsTrigger value="security" className="gap-1.5">
            <KeyRound className="h-3.5 w-3.5" />
            Security
          </TabsTrigger>
          {isAdmin && (
            <TabsTrigger value="departments" className="gap-1.5">
              <Building2 className="h-3.5 w-3.5" />
              Departments
            </TabsTrigger>
          )}
          {canManageTags && (
            <TabsTrigger value="tags" className="gap-1.5">
              <Tag className="h-3.5 w-3.5" />
              Task Tags
            </TabsTrigger>
          )}
        </TabsList>

        <TabsContent value="profile">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Personal Profile</CardTitle>
                  <CardDescription>
                    Update how your name and title appear across projects and comments.
                  </CardDescription>
                </div>
                <RoleBadge role={user.role} />
              </div>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSaveProfile} className="space-y-4 max-w-md">
                <div className="space-y-1.5">
                  <Label>Work Email</Label>
                  <Input value={user.email} disabled className="bg-[#F7F8FA]" />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="prof-name">Full Name</Label>
                  <Input
                    id="prof-name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="prof-desig">Designation</Label>
                  <Input
                    id="prof-desig"
                    value={designation}
                    onChange={(e) => setDesignation(e.target.value)}
                    placeholder="e.g., Senior Frontend Engineer"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="prof-avatar">Avatar Image URL</Label>
                  <Input
                    id="prof-avatar"
                    type="url"
                    value={avatarUrl}
                    onChange={(e) => setAvatarUrl(e.target.value)}
                    placeholder="https://..."
                  />
                </div>
                <Button type="submit" disabled={savingProfile}>
                  {savingProfile && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                  Save Profile
                </Button>
              </form>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="security">
          <Card>
            <CardHeader>
              <CardTitle>Google OAuth 2.0 Authentication</CardTitle>
              <CardDescription>
                Your workspace uses Google single sign-on (SSO) and administrator role approval.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 text-xs text-[#525866]">
              <div className="rounded-lg border border-[#EAECF0] bg-[#F7F8FA] p-4 space-y-1.5">
                <p className="font-semibold text-[#20232B]">
                  Connected Google Account: {user.email}
                </p>
                <p className="text-[#737987]">
                  Password authentication is disabled for this organization. Manage your
                  2-Step Verification and security settings directly in your Google Account.
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {isAdmin && (
          <TabsContent value="departments" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Company Departments</CardTitle>
                <CardDescription>
                  Organize employees into departments for filtering and reporting.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <form
                  onSubmit={handleAddDepartment}
                  className="flex flex-col sm:flex-row gap-2.5"
                >
                  <Input
                    value={deptName}
                    onChange={(e) => setDeptName(e.target.value)}
                    placeholder="Department name (e.g., Data Science)"
                    className="sm:w-56"
                  />
                  <Input
                    value={deptDesc}
                    onChange={(e) => setDeptDesc(e.target.value)}
                    placeholder="Short description (optional)"
                    className="flex-1"
                  />
                  <Button type="submit" disabled={savingDept || !deptName.trim()}>
                    <Plus className="h-3.5 w-3.5" />
                    Add
                  </Button>
                </form>

                <div className="divide-y divide-[#EAECF0] rounded-lg border border-[#EAECF0]">
                  {departments.map((d) => (
                    <div
                      key={d.id}
                      className="flex items-center justify-between gap-3 px-4 py-3"
                    >
                      <div>
                        <p className="text-[13px] font-medium text-[#20232B]">
                          {d.name}
                        </p>
                        <p className="text-xs text-[#737987]">
                          {d.description || "No description"} · {d._count.users}{" "}
                          members
                        </p>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-[#737987] hover:text-red-600 hover:bg-red-50"
                        onClick={() => handleDeleteDept(d.id)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        )}

        {canManageTags && (
          <TabsContent value="tags" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Workspace Task Tags</CardTitle>
                <CardDescription>
                  Reusable color-coded labels for categorizing tasks across projects.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <form
                  onSubmit={handleAddTag}
                  className="flex flex-wrap items-center gap-2.5"
                >
                  <Input
                    value={tagName}
                    onChange={(e) => setTagName(e.target.value)}
                    placeholder="Tag name (e.g., Infrastructure)"
                    className="w-60"
                  />
                  <input
                    type="color"
                    value={tagColor}
                    onChange={(e) => setTagColor(e.target.value)}
                    className="h-9 w-11 cursor-pointer rounded-md border border-[#E2E6EE] bg-white p-1"
                  />
                  <Button type="submit" disabled={savingTag || !tagName.trim()}>
                    <Plus className="h-3.5 w-3.5" />
                    Add Tag
                  </Button>
                </form>

                <div className="flex flex-wrap gap-2">
                  {tags.map((t) => (
                    <div
                      key={t.id}
                      className="inline-flex items-center gap-2 rounded-md border border-[#EAECF0] bg-[#F7F8FA] px-3 py-1.5 text-xs font-medium text-[#20232B]"
                    >
                      <span
                        className="h-2 w-2 rounded-full"
                        style={{ backgroundColor: t.color }}
                      />
                      <span>{t.name}</span>
                      <span className="text-[11px] text-[#9CA3AF]">
                        ({t._count.tasks})
                      </span>
                      <button
                        type="button"
                        onClick={() => handleDeleteTag(t.id)}
                        className="ml-1 text-[#9CA3AF] hover:text-red-600"
                        title="Delete tag"
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}
