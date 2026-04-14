export type MeetingSummaryPayload = {
  summary: string;
  keyPoints: string[];
  decisions: string[];
  actionItems: string[];
};

export function buildMeetingSummaryTemplate(): MeetingSummaryPayload {
  return {
    summary: "",
    keyPoints: [],
    decisions: [],
    actionItems: [],
  };
}

export function stringifyMeetingSummary(payload: MeetingSummaryPayload) {
  return JSON.stringify(payload);
}

export function parseMeetingSummary(value: string): MeetingSummaryPayload {
  if (!value.trim()) {
    return buildMeetingSummaryTemplate();
  }
  try {
    const parsed = JSON.parse(value) as Partial<MeetingSummaryPayload>;
    return {
      summary: parsed.summary?.trim() ?? "",
      keyPoints: Array.isArray(parsed.keyPoints) ? parsed.keyPoints.map((item) => String(item).trim()).filter(Boolean) : [],
      decisions: Array.isArray(parsed.decisions) ? parsed.decisions.map((item) => String(item).trim()).filter(Boolean) : [],
      actionItems: Array.isArray(parsed.actionItems) ? parsed.actionItems.map((item) => String(item).trim()).filter(Boolean) : [],
    };
  } catch {
    return buildMeetingSummaryTemplate();
  }
}

export function getMeetingSummaryFormValue(summaryRaw: string) {
  const summary = parseMeetingSummary(summaryRaw);
  return {
    summary: summary.summary,
    keyPoints: summary.keyPoints.join("\n"),
    decisions: summary.decisions.join("\n"),
    actionItems: summary.actionItems.join("\n"),
  };
}

