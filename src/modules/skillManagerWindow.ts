import { config } from "../../package.json";
import { HTML_NS } from "../utils/domHelpers";
import { t } from "../utils/i18n";
import { setUserSkills } from "../agent/skills";
import {
  createSkillTemplate,
  deleteSkillFile,
  getSkillListing,
  initUserSkills,
  loadUserSkills,
  openSkillFile,
  restoreSkillToDefault,
} from "../agent/skills/userSkills";

let skillManagerWindow: Window | null = null;

const createElement = <T extends HTMLElement>(
  doc: Document,
  tag: string,
  style: string,
  text?: string,
): T => {
  const element = doc.createElementNS(HTML_NS, tag) as T;
  element.style.cssText = style;
  if (text !== undefined) element.textContent = text;
  return element;
};

function isOpen(): boolean {
  return !!skillManagerWindow && !skillManagerWindow.closed;
}

export function openSkillManagerWindow(): void {
  if (isOpen()) {
    skillManagerWindow?.focus();
    return;
  }

  const mainWin = Zotero.getMainWindow();
  if (!mainWin) return;

  const win = mainWin.openDialog(
    `chrome://${config.addonRef}/content/skillManager.xhtml`,
    "paperpilot-skill-manager",
    "chrome,dialog=no,resizable,centerscreen",
  ) as Window | null;
  if (!win) return;
  skillManagerWindow = win;
  win.addEventListener(
    "load",
    () => {
      renderSkillManager(win);
    },
    { once: true },
  );
  win.addEventListener(
    "unload",
    () => {
      if (skillManagerWindow === win) skillManagerWindow = null;
    },
    { once: true },
  );
}

async function renderSkillManager(win: Window): Promise<void> {
  const doc = win.document;
  const root = doc.getElementById("paperpilot-skill-manager-root");
  if (!root) return;

  const header = createElement<HTMLDivElement>(
    doc,
    "div",
    "display:flex;align-items:center;gap:8px;margin-bottom:14px;",
  );
  const title = createElement<HTMLSpanElement>(
    doc,
    "span",
    "font-size:16px;font-weight:700;flex:1;",
    t("Skills"),
  );
  const newButton = createElement<HTMLButtonElement>(
    doc,
    "button",
    "padding:5px 10px;",
    t("New skill"),
  );
  const refreshButton = createElement<HTMLButtonElement>(
    doc,
    "button",
    "padding:5px 10px;",
    t("Check for updates"),
  );
  header.append(title, newButton, refreshButton);

  const grid = createElement<HTMLDivElement>(
    doc,
    "div",
    "display:grid;grid-template-columns:repeat(auto-fill,minmax(180px,1fr));gap:8px;",
  );
  const contextMenu = createElement<HTMLDivElement>(
    doc,
    "div",
    "position:fixed;display:none;z-index:10;min-width:150px;padding:4px;background:Field;border:1px solid ThreeDShadow;box-shadow:0 3px 10px rgba(0,0,0,.2);",
  );
  const showButton = createElement<HTMLButtonElement>(
    doc,
    "button",
    "display:block;width:100%;padding:6px 8px;text-align:left;border:0;background:transparent;",
    t("Show in file system"),
  );
  const restoreButton = createElement<HTMLButtonElement>(
    doc,
    "button",
    "display:block;width:100%;padding:6px 8px;text-align:left;border:0;background:transparent;",
    t("Restore to default"),
  );
  const deleteButton = createElement<HTMLButtonElement>(
    doc,
    "button",
    "display:block;width:100%;padding:6px 8px;text-align:left;border:0;background:transparent;color:#c00;",
    t("Delete"),
  );
  contextMenu.append(showButton, restoreButton, deleteButton);
  root.append(header, grid, contextMenu);

  let activeFilePath: string | null = null;
  const refreshLoadedSkills = async () => {
    await initUserSkills();
    setUserSkills(await loadUserSkills());
  };
  const renderListing = async () => {
    grid.replaceChildren();
    const listing = await getSkillListing();
    if (!listing.length) {
      grid.append(
        createElement<HTMLDivElement>(
          doc,
          "div",
          "grid-column:1/-1;padding:24px;text-align:center;color:GrayText;",
          t("No skills found."),
        ),
      );
      return;
    }
    for (const skill of listing) {
      const card = createElement<HTMLButtonElement>(
        doc,
        "button",
        "display:flex;align-items:center;gap:8px;min-height:58px;padding:10px;text-align:left;background:Field;color:FieldText;border:1px solid ThreeDLightShadow;border-radius:6px;cursor:pointer;",
      );
      card.title = skill.filePath;
      card.append(
        createElement<HTMLSpanElement>(
          doc,
          "span",
          "font-size:18px;",
          "\u{1F4C4}",
        ),
        createElement<HTMLSpanElement>(
          doc,
          "span",
          "overflow:hidden;text-overflow:ellipsis;white-space:nowrap;",
          skill.filename,
        ),
      );
      card.addEventListener("click", () => void openSkillFile(skill.filePath));
      card.addEventListener("contextmenu", (event) => {
        event.preventDefault();
        activeFilePath = skill.filePath;
        restoreButton.style.display =
          skill.source === "customized" ? "block" : "none";
        contextMenu.style.display = "block";
        contextMenu.style.left = `${event.clientX}px`;
        contextMenu.style.top = `${event.clientY}px`;
      });
      grid.append(card);
    }
  };
  const refresh = async () => {
    await refreshLoadedSkills();
    await renderListing();
  };

  refreshButton.addEventListener("click", () => void refresh());
  newButton.addEventListener("click", async () => {
    const filePath = await createSkillTemplate();
    if (filePath) {
      await refresh();
      await openSkillFile(filePath);
    }
  });
  showButton.addEventListener("click", () => {
    if (activeFilePath) void openSkillFile(activeFilePath);
    contextMenu.style.display = "none";
  });
  restoreButton.addEventListener("click", async () => {
    if (activeFilePath) {
      await restoreSkillToDefault(activeFilePath);
      await refresh();
    }
    contextMenu.style.display = "none";
  });
  deleteButton.addEventListener("click", async () => {
    if (activeFilePath) {
      await deleteSkillFile(activeFilePath);
      await refresh();
    }
    contextMenu.style.display = "none";
  });
  doc.addEventListener("mousedown", (event) => {
    if (
      contextMenu.style.display !== "none" &&
      !contextMenu.contains(event.target as Node)
    ) {
      contextMenu.style.display = "none";
    }
  });

  await refresh();
}
