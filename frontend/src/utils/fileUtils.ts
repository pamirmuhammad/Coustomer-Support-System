// Strips the UUID prefix from attachment filenames to return a human-readable display name
export function getAttachmentDisplayName(attachmentPath?: string): string {
  if (!attachmentPath) return 'attachment';
  const fileName = attachmentPath.split('/').pop() || attachmentPath;
  return fileName.replace(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}_/i, '');
}


