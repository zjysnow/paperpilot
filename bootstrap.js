var PaperPilot;

function log(msg) {
	Zotero.debug("My Plugin: " + msg);
}

function install() {
	log("Installed");
}

async function startup({ id, version, rootURI }) {
	log("Starting");

	Zotero.PreferencePanes.register({
		id: "zotero-flowise-prefs",
		label: "Flowise",
		image: null,
		src: "chrome://zotero-flowise/content/prefs.xhtml",
		scripts: ["chrome://zotero-flowise/content/prefs.js"],
		onLoad: (win) => {
			// 这里就是 addToWindow 的等价物
			addToWindow(win);
		}
	});

	Services.scriptloader.loadSubScript(rootURI + "main.js");
	PaperPilot.init({ id, version, rootURI });
	PaperPilot.addToAllWindows();
	await PaperPilot.main();
}

function onMainWindowLoad({ window }) {
	PaperPilot.addToWindow(window);
}

function onMainWindowUnload({ window }) {
	PaperPilot.removeFromWindow(window);
}

function shutdown() {
	log("Shutting down");
	PaperPilot.removeFromAllWindows();
	PaperPilot = undefined;
}

function uninstall() {
	log("Uninstalled");
}
