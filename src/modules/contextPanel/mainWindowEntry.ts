import { t } from "../../utils/i18n";

export function registerMainWindowEntry(
  doc: Document,
  openLibraryChat: () => void,
): void {
  if (doc.getElementById("paperpilot-open-standalone")) return;
  const toolbar = doc.getElementById("zotero-items-toolbar");
  if (!toolbar) {
    ztoolkit.log("LLM: main window items toolbar is unavailable");
    return;
  }
  const button = doc.createXULElement("toolbarbutton");
  button.id = "paperpilot-open-standalone";
  button.setAttribute("label", t("Paper Pilot"));
  button.setAttribute("tooltiptext", t("Open Paper Pilot in Library mode"));
  button.setAttribute(
    "image",
    `chrome://${addon.data.config.addonRef}/content/icons/icon.svg`,
  );
  button.setAttribute("class", "zotero-tb-button");
  button.setAttribute("oncommand", "void(0)");
  button.addEventListener("command", openLibraryChat);
  const newNote = doc.getElementById("zotero-tb-note-add");
  if (newNote?.parentElement === toolbar) {
    toolbar.insertBefore(button, newNote.nextSibling);
  } else {
    ztoolkit.log("LLM: New Note toolbar anchor is unavailable");
    toolbar.appendChild(button);
  }
}
