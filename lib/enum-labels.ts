import type {
  AttendanceType,
  CustomerPriority,
  CustomerStage,
  FollowUpStatus,
  MeetingSourceType,
  ReimbursementStatus,
  UserStatus,
} from "@prisma/client";

export const CUSTOMER_PRIORITY_LABELS: Record<CustomerPriority, string> = {
  LOW: "低",
  MEDIUM: "中",
  HIGH: "高",
  CRITICAL: "紧急",
};

export const CUSTOMER_STAGE_LABELS: Record<CustomerStage, string> = {
  NEW: "新客户",
  CONTACTED: "已联系",
  FOLLOWING: "跟进中",
  WON: "已成交",
};

export const FOLLOW_UP_STATUS_LABELS: Record<FollowUpStatus, string> = {
  PENDING: "待处理",
  DONE: "已完成",
  OVERDUE: "已逾期",
};

export const ATTENDANCE_TYPE_LABELS: Record<AttendanceType, string> = {
  CLOCK_IN: "上班打卡",
  CLOCK_OUT: "下班打卡",
  FIELD_WORK: "外勤打卡",
};

export const USER_STATUS_LABELS: Record<UserStatus, string> = {
  ACTIVE: "启用",
  DISABLED: "停用",
};

export const REIMBURSEMENT_STATUS_LABELS: Record<ReimbursementStatus, string> = {
  PENDING: "待审核",
  APPROVED: "已通过",
  REJECTED: "已驳回",
};

export const MEETING_SOURCE_LABELS: Record<MeetingSourceType, string> = {
  REALTIME_AUDIO: "实时录音",
  AUDIO_UPLOAD: "音频上传",
  VIDEO_UPLOAD: "视频上传",
};

