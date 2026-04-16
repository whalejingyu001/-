const ATTACHMENT_MARKER = "__ATTACHMENT_META__:";

export function encodeReasonWithAttachmentMeta(reason: string, attachmentName: string, attachmentUrl: string) {
  const payload = JSON.stringify({ attachmentName, attachmentUrl });
  return `${reason}\n\n${ATTACHMENT_MARKER}${payload}`;
}

export function extractReasonAndAttachment(
  reason: string,
  attachmentName?: string | null,
  attachmentUrl?: string | null,
) {
  if (attachmentName && attachmentUrl) {
    return {
      reasonText: stripAttachmentMarker(reason),
      attachmentName,
      attachmentUrl,
    };
  }

  const index = reason.lastIndexOf(ATTACHMENT_MARKER);
  if (index < 0) {
    return { reasonText: reason, attachmentName: null, attachmentUrl: null };
  }

  const reasonText = reason.slice(0, index).trimEnd();
  const raw = reason.slice(index + ATTACHMENT_MARKER.length).trim();
  try {
    const parsed = JSON.parse(raw) as { attachmentName?: string; attachmentUrl?: string };
    return {
      reasonText,
      attachmentName: parsed.attachmentName ?? null,
      attachmentUrl: parsed.attachmentUrl ?? null,
    };
  } catch {
    return { reasonText: reason, attachmentName: null, attachmentUrl: null };
  }
}

function stripAttachmentMarker(reason: string) {
  const index = reason.lastIndexOf(ATTACHMENT_MARKER);
  if (index < 0) return reason;
  return reason.slice(0, index).trimEnd();
}

export function isMissingAttachmentColumnsError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  return (
    message.includes("attachmentName") ||
    message.includes("attachmentUrl") ||
    message.includes("The column `attachmentName`") ||
    message.includes("The column `attachmentUrl`") ||
    message.includes("Unknown argument `attachmentName`") ||
    message.includes("Unknown argument `attachmentUrl`")
  );
}

