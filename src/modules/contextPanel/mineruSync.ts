/**
 * Compatibility hook for the reference paper-search module.
 *
 * This project does not ship the MinerU attachment package, so no Zotero
 * attachment is excluded from the regular picker search.
 */
export function isMineruSyncPackageAttachment(
  _item: Zotero.Item | null,
): boolean {
  return false;
}
