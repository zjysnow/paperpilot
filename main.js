async function saveTxtToItem(content) {
    const path = "/Users/albert/Workspace/debug.txt";
    await Zotero.File.putContentsAsync(path, content);
    return path;
}

async function query(data) {
	const json = JSON.stringify(data);

	const encoder = new TextEncoder();
    const bodyBytes = encoder.encode(json);

    const response = await fetch(
        "http://localhost:3000/api/v1/prediction/1cf19a51-0d66-4ef6-8645-88a47d42f656",
        {
            method: "POST",
            headers: {
				Authorization: "Bearer sEvSONlaZ1JnnSm45ovu3Z-I__25UsPB57B61wAiFaQ",
                "Content-Type": "application/json",
				"Content-Length": bodyBytes.length.toString()
            },
            body: bodyBytes,
        }
    );
    const result = await response.text();
    return result;
}



async function uploadPDFToFlowise(filePath, apiKey) {
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
    header += part("docId", "f8755353-c1ad-4225-bd84-fbc72178701c");
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

    const res = await fetch(`http://localhost:3000/api/v1/document-store/upsert/5a5209a5-9926-4673-a1c5-1a19fe354b55`, {
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

		const result = await uploadPDFToFlowise(filePath, "sEvSONlaZ1JnnSm45ovu3Z-I__25UsPB57B61wAiFaQ")

		// await saveTxtToItem(result)
		const response = await query({"question": "总结论文"});
		await saveTxtToItem(response);
		// query({"question": "总结论文"}).then((response) => {
		// 	this.log(response);
		// });
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

	async main() {
		this.log("Plugin loaded successfully. Version: " + this.version);
	},
};
