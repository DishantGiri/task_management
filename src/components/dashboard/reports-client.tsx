"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { ProjectStatusBadge } from "@/components/shared/badges";
import type { ProjectStatus } from "@prisma/client";

export interface ReportsData {
  summary: {
    totalTasks: number;
    completedTasks: number;
    overdueTasks: number;
    completionRate: number;
    onTimeRate: number;
    totalProjects: number;
    activeEmployees: number;
  };
  priorityBreakdown: { name: string; count: number; color: string }[];
  workloadData: {
    name: string;
    active: number;
    completed: number;
    overdue: number;
  }[];
  departmentStats: {
    name: string;
    members: number;
    assigned: number;
    completed: number;
    rate: number;
  }[];
  projectScorecard: {
    id: string;
    code: string;
    name: string;
    color: string;
    status: ProjectStatus;
    managerName: string;
    totalTasks: number;
    completedTasks: number;
    overdueTasks: number;
    progress: number;
  }[];
}

export function ReportsClient({ data }: { data: ReportsData }) {
  const exportCSV = () => {
    const headers = [
      "Project Code",
      "Project Name",
      "Status",
      "Manager",
      "Total Tasks",
      "Completed Tasks",
      "Overdue Tasks",
      "Progress (%)",
    ];
    const rows = data.projectScorecard.map((p) => [
      p.code,
      `"${p.name.replace(/"/g, '""')}"`,
      p.status,
      `"${p.managerName.replace(/"/g, '""')}"`,
      p.totalTasks,
      p.completedTasks,
      p.overdueTasks,
      p.progress,
    ]);
    const csv = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `meridian-work-report-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-[24px] font-semibold tracking-tight text-[#20232B]">
            Reports &amp; Analytics
          </h1>
          <p className="text-[13px] text-[#737987] mt-0.5">
            Real-time company delivery metrics, workload distribution, and project health.
          </p>
        </div>

        <Button variant="outline" size="sm" onClick={exportCSV}>
          <Download className="h-3.5 w-3.5" />
          Export CSV Report
        </Button>
      </div>

      {/* KPI Row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="rounded-lg border border-[#EAECF0] bg-white p-4 shadow-subtle">
          <p className="text-xs font-medium text-[#737987]">Completion Rate</p>
          <p className="mt-1.5 text-2xl font-semibold text-[#20232B]">
            {data.summary.completionRate}%
          </p>
          <p className="mt-1 text-[11px] text-[#737987]">
            {data.summary.completedTasks} of {data.summary.totalTasks} tasks done
          </p>
        </div>
        <div className="rounded-lg border border-[#EAECF0] bg-white p-4 shadow-subtle">
          <p className="text-xs font-medium text-[#737987]">On-Time Delivery</p>
          <p className="mt-1.5 text-2xl font-semibold text-[#16A34A]">
            {data.summary.onTimeRate}%
          </p>
          <p className="mt-1 text-[11px] text-[#737987]">
            Completed on or before due date
          </p>
        </div>
        <div className="rounded-lg border border-[#EAECF0] bg-white p-4 shadow-subtle">
          <p className="text-xs font-medium text-[#737987]">Overdue Tasks</p>
          <p className="mt-1.5 text-2xl font-semibold text-[#EF4444]">
            {data.summary.overdueTasks}
          </p>
          <p className="mt-1 text-[11px] text-[#737987]">
            Requiring immediate attention
          </p>
        </div>
        <div className="rounded-lg border border-[#EAECF0] bg-white p-4 shadow-subtle">
          <p className="text-xs font-medium text-[#737987]">Active Workforce</p>
          <p className="mt-1.5 text-2xl font-semibold text-[#635BDB]">
            {data.summary.activeEmployees}
          </p>
          <p className="mt-1 text-[11px] text-[#737987]">
            Across {data.summary.totalProjects} tracked projects
          </p>
        </div>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        <Card className="lg:col-span-7">
          <CardHeader className="pb-2">
            <CardTitle>Employee Workload &amp; Completion</CardTitle>
            <p className="text-xs text-[#737987]">
              Active vs. completed tasks per team member
            </p>
          </CardHeader>
          <CardContent>
            <div className="h-[260px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={data.workloadData}
                  margin={{ top: 10, right: 12, left: -20, bottom: 0 }}
                >
                  <CartesianGrid
                    strokeDasharray="3 3"
                    vertical={false}
                    stroke="#EAECF0"
                  />
                  <XAxis
                    dataKey="name"
                    axisLine={false}
                    tickLine={false}
                    tick={{ fontSize: 11, fill: "#737987" }}
                  />
                  <YAxis
                    allowDecimals={false}
                    axisLine={false}
                    tickLine={false}
                    tick={{ fontSize: 11, fill: "#737987" }}
                  />
                  <Tooltip
                    cursor={{ fill: "#F7F8FA" }}
                    contentStyle={{
                      backgroundColor: "#FFFFFF",
                      border: "1px solid #EAECF0",
                      borderRadius: "6px",
                      fontSize: "12px",
                    }}
                  />
                  <Bar
                    dataKey="active"
                    name="Active"
                    fill="#635BDB"
                    radius={[3, 3, 0, 0]}
                    maxBarSize={26}
                  />
                  <Bar
                    dataKey="completed"
                    name="Completed"
                    fill="#16A34A"
                    radius={[3, 3, 0, 0]}
                    maxBarSize={26}
                  />
                  <Bar
                    dataKey="overdue"
                    name="Overdue"
                    fill="#EF4444"
                    radius={[3, 3, 0, 0]}
                    maxBarSize={26}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card className="lg:col-span-5">
          <CardHeader className="pb-2">
            <CardTitle>Tasks by Priority</CardTitle>
            <p className="text-xs text-[#737987]">
              Urgency distribution across all open &amp; completed tasks
            </p>
          </CardHeader>
          <CardContent>
            <div className="h-[260px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={data.priorityBreakdown}
                  layout="vertical"
                  margin={{ top: 10, right: 16, left: 0, bottom: 0 }}
                >
                  <CartesianGrid
                    strokeDasharray="3 3"
                    horizontal={false}
                    stroke="#EAECF0"
                  />
                  <XAxis
                    type="number"
                    allowDecimals={false}
                    axisLine={false}
                    tickLine={false}
                    tick={{ fontSize: 11, fill: "#737987" }}
                  />
                  <YAxis
                    type="category"
                    dataKey="name"
                    axisLine={false}
                    tickLine={false}
                    width={64}
                    tick={{ fontSize: 11.5, fill: "#374151" }}
                  />
                  <Tooltip
                    cursor={{ fill: "#F7F8FA" }}
                    contentStyle={{
                      backgroundColor: "#FFFFFF",
                      border: "1px solid #EAECF0",
                      borderRadius: "6px",
                      fontSize: "12px",
                    }}
                  />
                  <Bar dataKey="count" name="Tasks" radius={[0, 4, 4, 0]} maxBarSize={24}>
                    {data.priorityBreakdown.map((entry, idx) => (
                      <Cell key={idx} fill={entry.color} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Department Performance */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle>Department Performance</CardTitle>
          <p className="text-xs text-[#737987]">
            Headcount and task throughput grouped by company department
          </p>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto border-t border-[#EAECF0]">
            <table className="w-full text-left border-collapse min-w-[600px]">
              <thead>
                <tr className="border-b border-[#EAECF0] bg-[#F7F8FA] text-[11px] font-semibold uppercase tracking-wider text-[#737987]">
                  <th className="py-2.5 pl-5 pr-3">Department</th>
                  <th className="py-2.5 px-3">Employees</th>
                  <th className="py-2.5 px-3">Assigned Tasks</th>
                  <th className="py-2.5 px-3">Completed</th>
                  <th className="py-2.5 pl-3 pr-5 w-[200px]">Completion Rate</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#EAECF0] text-[13px]">
                {data.departmentStats.map((dept) => (
                  <tr key={dept.name} className="hover:bg-[#F7F8FA]/80">
                    <td className="py-3 pl-5 pr-3 font-medium text-[#20232B]">
                      {dept.name}
                    </td>
                    <td className="py-3 px-3 text-xs text-[#525866]">
                      {dept.members}
                    </td>
                    <td className="py-3 px-3 text-xs text-[#525866]">
                      {dept.assigned}
                    </td>
                    <td className="py-3 px-3 text-xs font-medium text-[#16A34A]">
                      {dept.completed}
                    </td>
                    <td className="py-3 pl-3 pr-5">
                      <div className="flex items-center gap-2.5">
                        <Progress value={dept.rate} className="h-1.5 flex-1" />
                        <span className="text-xs font-medium text-[#20232B] w-9 text-right">
                          {dept.rate}%
                        </span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Project Health Scorecard */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle>Project Health Scorecard</CardTitle>
          <p className="text-xs text-[#737987]">
            Comprehensive summary of project progress and overdue risks
          </p>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto border-t border-[#EAECF0]">
            <table className="w-full text-left border-collapse min-w-[700px]">
              <thead>
                <tr className="border-b border-[#EAECF0] bg-[#F7F8FA] text-[11px] font-semibold uppercase tracking-wider text-[#737987]">
                  <th className="py-2.5 pl-5 pr-3">Project</th>
                  <th className="py-2.5 px-3">Manager</th>
                  <th className="py-2.5 px-3">Status</th>
                  <th className="py-2.5 px-3">Tasks</th>
                  <th className="py-2.5 px-3">Overdue</th>
                  <th className="py-2.5 pl-3 pr-5 w-[180px]">Progress</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#EAECF0] text-[13px]">
                {data.projectScorecard.map((proj) => (
                  <tr key={proj.id} className="hover:bg-[#F7F8FA]/80">
                    <td className="py-3 pl-5 pr-3">
                      <div className="flex items-center gap-2">
                        <span
                          className="h-2.5 w-2.5 rounded-[3px]"
                          style={{ backgroundColor: proj.color }}
                        />
                        <span className="font-medium text-[#20232B]">
                          {proj.name}
                        </span>
                        <span className="font-mono text-[11px] text-[#9CA3AF]">
                          {proj.code}
                        </span>
                      </div>
                    </td>
                    <td className="py-3 px-3 text-xs text-[#525866]">
                      {proj.managerName}
                    </td>
                    <td className="py-3 px-3">
                      <ProjectStatusBadge status={proj.status} />
                    </td>
                    <td className="py-3 px-3 text-xs text-[#525866]">
                      {proj.completedTasks}/{proj.totalTasks}
                    </td>
                    <td className="py-3 px-3 text-xs">
                      {proj.overdueTasks > 0 ? (
                        <span className="font-semibold text-[#EF4444]">
                          {proj.overdueTasks}
                        </span>
                      ) : (
                        <span className="text-[#9CA3AF]">0</span>
                      )}
                    </td>
                    <td className="py-3 pl-3 pr-5">
                      <div className="flex items-center gap-2">
                        <Progress value={proj.progress} className="h-1.5 flex-1" />
                        <span className="text-xs font-medium text-[#20232B] w-9 text-right">
                          {proj.progress}%
                        </span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
