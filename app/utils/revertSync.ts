export function isRevertApplied(
  currentRevertMessageId: string | undefined,
  requestedMessageId: string,
  previousRevertMessageId?: string,
): boolean {
  const current = currentRevertMessageId?.trim() ?? '';
  const requested = requestedMessageId.trim();
  if (!current || !requested) return false;
  if (current === requested) return true;
  // OpenCode may remap the pointer to the last user message.
  return current !== (previousRevertMessageId?.trim() ?? '');
}

export function isUnrevertApplied(currentRevertMessageId: string | undefined): boolean {
  return !(currentRevertMessageId?.trim());
}
