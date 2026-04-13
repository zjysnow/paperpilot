async function saveTxtToItem(content, title, path) {
	data = JSON.parse(content);
    path = `${path}/${title}.md` // "/Users/albert/Workspace/" + title + ".md";
    await Zotero.File.putContentsAsync(path, data.text);
    return path;
}

async function query(data, url, apiKey, flowID) {
	const json = JSON.stringify(data);

	const encoder = new TextEncoder();
    const bodyBytes = encoder.encode(json);
	query_url = `${url}/api/v1/prediction/${flowID}`
    const response = await fetch(
        query_url,
        {
            method: "POST",
            headers: {
				Authorization: `Bearer ${apiKey}`,
                "Content-Type": "application/json",
				"Content-Length": bodyBytes.length.toString()
            },
            body: bodyBytes,
        }
    );
    const result = await response.text();
    return result;
}



async function uploadPDFToFlowise(filePath, url, apiKey, docID) {
    const binaryStr = await Zotero.File.getBinaryContentsAsync(filePath);

    const boundary = "----ZoteroFlowiseBoundary" + Math.random().toString(16).slice(2);
    const fileName = filePath.split(/[\\/]/).pop() || "paper.pdf";

    const encoder = new TextEncoder();

    function part(name, value) {
        return (
            `--${boundary}\r\n` +
            `Content-Disposition: form-data; name="${name}"\r\n\r\n` +
            `${value}\r\n`
        );
    }

    let header = "";
    header += part("docId", docID);
    header += part("loaderName", "zotero pdf loader");
    header += part("splitter", JSON.stringify({ config: { chunkSize: 2048 } }));
    header += part("metadata", "{}");
    header += part("replaceExisting", "true");
    header += part("createNewDocStore", "false");

    header +=
        `--${boundary}\r\n` +
        `Content-Disposition: form-data; name="files"; filename="${fileName}"\r\n` +
        `Content-Type: application/pdf\r\n\r\n`;

    const footer = `\r\n--${boundary}--\r\n`;

    const headerBytes = encoder.encode(header);
    const footerBytes = encoder.encode(footer);

    const fileBytes = new Uint8Array(binaryStr.length);
    for (let i = 0; i < binaryStr.length; i++) {
        fileBytes[i] = binaryStr.charCodeAt(i) & 0xff;
    }

    const bodyBytes = new Uint8Array(
        headerBytes.length + fileBytes.length + footerBytes.length
    );
    bodyBytes.set(headerBytes, 0);
    bodyBytes.set(fileBytes, headerBytes.length);
    bodyBytes.set(footerBytes, headerBytes.length + fileBytes.length);

	document_url = `${url}/api/v1/document-store/upsert/${docID}`
    const res = await fetch(document_url, {
        method: "POST",
        headers: {
            Authorization: `Bearer ${apiKey}`,
            "Content-Type": `multipart/form-data; boundary=${boundary}`,
        },
        body: bodyBytes,
    });
	const raw = await res.text();
	return raw;
}


PaperPilot = {
	id: null,
	version: null,
	rootURI: null,
	initialized: false,
	addedElementIDs: [],

	// ======== Preference 读取辅助函数 ========
	getPref(key) {
		return Zotero.Prefs.get("paperpilot." + key);
	},

	setPref(key, value) {
		return Zotero.Prefs.set("paperpilot." + key, value);
	},

	init({ id, version, rootURI }) {
		if (this.initialized) return;
		this.id = id;
		this.version = version;
		this.rootURI = rootURI;
		this.initialized = true;
	},

	log(msg) {
		Zotero.debug("My Plugin: " + msg);
	},

	addToWindow(window) {
		let doc = window.document;

		// 加载 Fluent 国际化
		window.MozXULElement.insertFTLIfNeeded("paperpilot.ftl");

		// 优先使用 Zotero 8 MenuManager API
		this._registerMenuManager();
	},

	// Zotero 8 推荐方式：MenuManager API
	_registerMenuManager() {
		if (this.registeredMenuID) return;

		this.registeredMenuID = Zotero.MenuManager.registerMenu({
			menuID: "zotero-flowise-menu",
			pluginID: this.id,
			target: "main/library/item",
			menus: [
				{
					menuType: "submenu",
					l10nID: "flowise-menu",
					onShowing: (_event, context) => {
						const items = context.items || [];
						// 必须选中一个附件
						if (items.length !== 1) {
							context.setVisible(false);
							return;
						}
						const item = items[0];
						// 必须是附件
						if (!item.isAttachment) {
							context.setVisible(false);
							return;
						}
						// 必须是 PDF
						const mime = item.attachmentContentType || "";
						const isPDF = mime.toLowerCase() === "application/pdf";
						context.setVisible(isPDF);
					},
					menus: [
						{
							menuType: "menuitem",
							l10nID: "flowise-show-title",
							
							onCommand: async (_event, context) => {
								await this._getTitle(context.items);
							},
						},
					],
				},
			],
		});
		this.log("MenuManager registered: " + this.registeredMenuID);

	},

	async _getTitle(items) {
    	const filePath = await items[0].getFilePathAsync();

		const result = await uploadPDFToFlowise(filePath, this.getPref("flowiseURL"), this.getPref("apiKey"), this.getPref("docID"));

		const parentID = items[0].parentItemID;
		const parent = Zotero.Items.get(parentID);
		// 2. 获取标题
		const title = parent.getField("title") || "(untitled)";

		// await saveTxtToItem(result)
		const response = await query({"question": "总结论文"}, this.getPref("flowiseURL"), this.getPref("apiKey"), this.getPref("flowID"));
		await saveTxtToItem(response, title, this.getPref("obsidianPath"));

	},


	addToAllWindows() {
		var windows = Zotero.getMainWindows();
		for (let win of windows) {
			if (!win.ZoteroPane) continue;
			this.addToWindow(win);
		}
	},

	storeAddedElement(elem) {
		if (!elem.id) {
			throw new Error("Element must have an id");
		}
		this.addedElementIDs.push(elem.id);
	},

	removeFromWindow(window) {
		var doc = window.document;
		for (let id of this.addedElementIDs) {
			doc.getElementById(id)?.remove();
		}
		doc.querySelector('[href="paperpilot.ftl"]')?.remove();
	},

	removeFromAllWindows() {
		var windows = Zotero.getMainWindows();
		for (let win of windows) {
			if (!win.ZoteroPane) continue;
			this.removeFromWindow(win);
		}
	},

	onMenuCommand(window) {
		window.alert("Hello from My Zotero Plugin! (v" + this.version + ")");
	},

	// async main() {
	// 	this.log("Plugin loaded successfully. Version: " + this.version);
	// },
};
