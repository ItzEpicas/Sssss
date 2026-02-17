import type { StaffApplicationPosition, StaffApplicationStatus } from "./types";

export const positionLabels: Record<StaffApplicationPosition, string> = {
  moderator: "Moderator",
  helper: "Helper",
  admin: "Admin",
  support: "Support",
  builder: "Builder",
  other: "Other",
};

export const positionLabelsKa: Record<StaffApplicationPosition, string> = {
  moderator: "მოდერატორი",
  helper: "ჰელპერი",
  admin: "ადმინისტრატორი",
  support: "მხარდაჭერა",
  builder: "ბილდერი",
  other: "სხვა",
};

export const statusLabels: Record<StaffApplicationStatus, string> = {
  pending: "Pending",
  accepted: "Accepted",
  denied: "Denied",
  need_more_info: "Need more info",
};

export const statusLabelsKa: Record<StaffApplicationStatus, string> = {
  pending: "მოლოდინში",
  accepted: "დამტკიცდა",
  denied: "უარყოფილია",
  need_more_info: "საჭიროა დამატებითი ინფორმაცია",
};

export const statusBadgeClass: Record<StaffApplicationStatus, string> = {
  pending: "bg-yellow-500/20 text-yellow-500 border-yellow-500/30",
  accepted: "bg-green-500/20 text-green-500 border-green-500/30",
  denied: "bg-red-500/20 text-red-500 border-red-500/30",
  need_more_info: "bg-blue-500/20 text-blue-500 border-blue-500/30",
};

export function getPositionLabel(position: StaffApplicationPosition, language: "en" | "ka") {
  return language === "ka" ? positionLabelsKa[position] : positionLabels[position];
}

export function getStatusLabel(status: StaffApplicationStatus, language: "en" | "ka") {
  return language === "ka" ? statusLabelsKa[status] : statusLabels[status];
}

export function formatStaffAppDate(value: string | null | undefined) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
}
