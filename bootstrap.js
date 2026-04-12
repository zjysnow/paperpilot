var PaperPilot;

function log(msg) {
	Zotero.debug("My Plugin: " + msg);
}

function install() {
	log("Installed");
}

async function startup({ id, version, rootURI }) {
	log("Starting");

	// Zotero.PreferencePanes.register({
	// 	id: "zotero-flowise-prefs@example.com",
	// 	label: "Flowise",
	// 	image: null,
	// 	src: rootURI + "preferences.xhtml",
	// 	// scripts: ["chrome://zotero-flowise/content/prefs.js"],
	// 	// onLoad: (win) => {
	// 	// 	// 这里就是 addToWindow 的等价物
	// 	// 	addToWindow(win);
	// 	// }
	// });

	// 注册 Preference Pane
	Zotero.PreferencePanes.register({
		pluginID: "paperpilot@zjysnow",
		src: rootURI + "preferences.xhtml",
		label: "Flowise",
		image: "chrome://zotero/skin/16/universal/zotero.svg",
	});

	Services.scriptloader.loadSubScript(rootURI + "main.js");
	PaperPilot.init({ id, version, rootURI });
	PaperPilot.addToAllWindows();
	// await PaperPilot.main();
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
