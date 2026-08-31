/**
 * Most of this code is from Zotero team's official Make It Red example[1]
 * or the Zotero 7 documentation[2].
 * [1] https://github.com/zotero/make-it-red
 * [2] https://www.zotero.org/support/dev/zotero_7_for_developers
 */

var chromeHandle;

/**
 * Zotero can preserve an add-on entry while marking it disabled during an
 * application upgrade. Re-enable the current add-on before loading its code.
 * This is intentionally best-effort: older Zotero builds do not expose the
 * AddonManager ES module, and the normal startup path must still work there.
 */
async function migrateAfterApplicationUpgrade(id) {
  var currentVersion = Services.appinfo?.version;
  var migrationPref = `extensions.zotero.${id}.lastApplicationVersion`;
  var previousVersion = Zotero.Prefs.get(migrationPref, true);
  if (
    typeof currentVersion !== "string" ||
    (typeof previousVersion === "string" &&
      previousVersion.trim() === currentVersion)
  ) {
    return;
  }
  Zotero.Prefs.set(migrationPref, currentVersion, true);

  // The first run after installation is not an application migration.
  if (typeof previousVersion !== "string" || !previousVersion.trim()) {
    return;
  }

  var addonManager = globalThis.AddonManager;
  if (!addonManager && globalThis.ChromeUtils?.importESModule) {
    addonManager = globalThis.ChromeUtils.importESModule(
      "resource://gre/modules/AddonManager.sys.mjs",
    ).AddonManager;
  }
  if (!addonManager?.getAddonByID) {
    return;
  }

  var addon = await addonManager.getAddonByID(id);
  if (addon?.userDisabled) {
    await addon.enable();
    Zotero.debug(`[${id}] re-enabled after Zotero application upgrade`);
  }
}

function install(data, reason) {}

async function startup({ id, version, resourceURI, rootURI }, reason) {
  var aomStartup = Components.classes[
    "@mozilla.org/addons/addon-manager-startup;1"
  ].getService(Components.interfaces.amIAddonManagerStartup);
  var manifestURI = Services.io.newURI(rootURI + "manifest.json");
  chromeHandle = aomStartup.registerChrome(manifestURI, [
    ["content", "__addonRef__", rootURI + "content/"],
  ]);

  /**
   * Global variables for plugin code.
   * The `_globalThis` is the global root variable of the plugin sandbox environment
   * and all child variables assigned to it is globally accessible.
   * See `src/index.ts` for details.
   */
  const ctx = { rootURI };
  ctx._globalThis = ctx;

  Services.scriptloader.loadSubScript(
    `${rootURI}/content/scripts/__addonRef__.js`,
    ctx,
  );
  await migrateAfterApplicationUpgrade(id);
  await Zotero.__addonInstance__.hooks.onStartup();
}

async function onMainWindowLoad({ window }, reason) {
  await Zotero.__addonInstance__?.hooks.onMainWindowLoad(window);
}

async function onMainWindowUnload({ window }, reason) {
  await Zotero.__addonInstance__?.hooks.onMainWindowUnload(window);
}

async function shutdown({ id, version, resourceURI, rootURI }, reason) {
  if (reason === APP_SHUTDOWN) {
    return;
  }

  await Zotero.__addonInstance__?.hooks.onShutdown();

  if (chromeHandle) {
    chromeHandle.destruct();
    chromeHandle = null;
  }
}

async function uninstall(data, reason) {}
