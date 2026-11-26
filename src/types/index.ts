import type {
  Priority,
  ProjectMemberRole,
  ProjectStatus,
  Role,
  TaskStatus,
  UserStatus,
} from "@prisma/client";
import "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      name: string;
      email: string;
      role: Role;
      status: UserStatus;
      designation: string | null;
      avatarUrl: string | null;
      departmentId: string | null;
    };
  }
}

export interface UserSummary {
  id: string;
  name: string;
  email: string;
  avatarUrl: string | null;
  designation: string | null;
  role: Role;
  status?: UserStatus;
  department?: { id: string; name: string } | null;
}

export interface TagSummary {
  id: string;
  name: string;
  color: string;
}

export interface ProjectSummary {
  id: string;
  code: string;
  name: string;
  color: string;
  status: ProjectStatus;
  priority: Priority;
}

export interface SubtaskItem {
  id: string;
  taskKey: string;
  title: string;
  description: string | null;
  status: TaskStatus;
  priority: Priority;
  progress: number;
  startDate: string | null;
  dueDate: string | null;
  projectId: string;
  parentId: string | null;
  assigneeId: string | null;
  assignee: UserSummary | null;
  _count?: {
    subtasks: number;
    comments: number;
    attachments: number;
  };
}

export interface TaskListItem {
  id: string;
  taskKey: string;
  title: string;
  description: string | null;
  status: TaskStatus;
  priority: Priority;
  position: number;
  progress: number;
  startDate: string | null;
  dueDate: string | null;
  completedAt: string | null;
  qaBypassed?: boolean;
  qaBypassedAt?: string | null;
  qaBypassReason?: string | null;
  qaBypassedBy?: {
    id: string;
    name: string;
    avatarUrl: string | null;
  } | null;
  projectId: string;
  parentId: string | null;
  assigneeId: string | null;
  creatorId: string;
  createdAt: string;
  updatedAt: string;
  project: {
    id: string;
    code: string;
    name: string;
    color: string;
    managerId?: string;
    isProjectLead?: boolean;
  };
  assignee: UserSummary | null;
  collaborators: { user: UserSummary }[];
  tags: { tag: TagSummary }[];
  subtasks: SubtaskItem[];
  dependencies: {
    id: string;
    dependsOnId: string;
    dependsOn: {
      id: string;
      taskKey: string;
      title: string;
      status: TaskStatus;
    };
  }[];
  _count: {
    subtasks: number;
    comments: number;
    attachments: number;
  };
}

export interface TaskDetailData extends TaskListItem {
  creator: UserSummary;
  parent: {
    id: string;
    taskKey: string;
    title: string;
  } | null;
  comments: {
    id: string;
    content: string;
    createdAt: string;
    author: UserSummary;
  }[];
  attachments: {
    id: string;
    fileName: string;
    fileUrl: string;
    mimeType: string;
    fileSize: number;
    createdAt: string;
    uploadedBy: UserSummary;
  }[];
  activityLogs: {
    id: string;
    action: string;
    description: string;
    createdAt: string;
    actor: UserSummary;
  }[];
}

export interface ProjectListItem {
  id: string;
  code: string;
  name: string;
  description: string | null;
  color: string;
  status: ProjectStatus;
  priority: Priority;
  startDate: string | null;
  endDate: string | null;
  managerId: string;
  manager: UserSummary;
  members: {
    id: string;
    role: ProjectMemberRole;
    user: UserSummary;
  }[];
  taskStats: {
    total: number;
    completed: number;
    inProgress: number;
    overdue: number;
    progress: number;
  };
}

export interface PersonalChecklistItem {
  id: string;
  title: string;
  completed: boolean;
}

export interface PersonalTaskItem {
  id: string;
  title: string;
  notes: string | null;
  status: TaskStatus;
  priority: Priority;
  category: string;
  dueDate: string | null;
  isPinned: boolean;
  checklist: PersonalChecklistItem[];
  completedAt: string | null;
  userId: string;
  createdAt: string;
  updatedAt: string;
}


export interface MilestoneItem {
  id: string;
  title: string;
  description: string | null;
  status: "UPCOMING" | "IN_PROGRESS" | "COMPLETED";
  dueDate: string | null;
  projectId: string;
  createdAt: string;
  createdBy: { id: string; name: string; avatarUrl: string | null };
  tasks: {
    id: string;
    taskKey: string;
    title: string;
    status: TaskStatus;
    priority: Priority;
    dueDate: string | null;
    assignee: { id: string; name: string; avatarUrl: string | null } | null;
  }[];
  taskStats: {
    total: number;
    completed: number;
    progress: number;
  };
}

export interface ProjectPostItem {
  id: string;
  type: "ANNOUNCEMENT" | "SUGGESTION";
  title: string;
  content: string;
  isPinned: boolean;
  projectId: string;
  createdAt: string;
  author: {
    id: string;
    name: string;
    avatarUrl: string | null;
    role: Role;
    designation: string | null;
  };
}

export interface PersonalNoteShareItem {
  id: string;
  userId: string;
  canEdit: boolean;
  user: {
    id: string;
    name: string;
    email: string;
    avatarUrl: string | null;
    designation: string | null;
  };
}

export interface PersonalNoteItem {
  id: string;
  title: string;
  icon: string;
  content: string;
  isPinned: boolean;
  createdAt: string;
  updatedAt: string;
  isOwner: boolean;
  canEdit: boolean;
  owner: {
    id: string;
    name: string;
    avatarUrl: string | null;
  };
  shares: PersonalNoteShareItem[];
}
