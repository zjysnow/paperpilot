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
		if (Zotero.MenuManager) {
			this._registerMenuManager();
		} else {
			this._addMenuManually(doc);
		}
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
							
							onCommand: (_event, context) => {
								this._getTitle(context.items);
								// this._showPaperTitle(context.items);
							},
						},
					],
				},
			],
		});
		this.log("MenuManager registered: " + this.registeredMenuID);
	},

	// Zotero 7 兼容回退：手动操作 DOM
	_addMenuManually(doc) {
		let popup = doc.getElementById("zotero-itemmenu");
		if (!popup) return;

		let submenu = doc.createXULElement("menu");
		submenu.id = "flowise-submenu";
		submenu.setAttribute("data-l10n-id", "flowise-menu");

		let menupopup = doc.createXULElement("menupopup");
		menupopup.id = "flowise-submenu-popup";

		let showItem = doc.createXULElement("menuitem");
		showItem.id = "flowise-show-title-item";
		showItem.setAttribute("data-l10n-id", "flowise-show-title");
		showItem.addEventListener("command", () => {
			let items = Zotero.getActiveZoteroPane().getSelectedItems();
			this._getBibTeXFromPDFItem(items);
		});

		menupopup.appendChild(showItem);
		submenu.appendChild(menupopup);
		popup.appendChild(submenu);

		this.addedElementIDs.push(submenu.id);
	},

	_getTitle(items) {
		if (!items || items.length === 0) {
			this.log("No items selected");
			return;
		}

		if (!items[0] || !items[0].isAttachment) {
			throw new Error("必须传入 PDF 附件条目");
		}

		const parentID = items[0].parentItemID;
		if (!parentID) {
			throw new Error("该 PDF 没有父条目");
		}

		const parent = Zotero.Items.get(parentID);

		// 2. 获取标题
		const title = parent.getField("title") || "(untitled)";

		// 3. 获取作者
		const creators = parent.getCreators();
		let firstAuthor = "";
		if (creators.length > 0) {
			let c = creators[0];
			firstAuthor = c.lastName || c.name || "";
			if (creators.length > 1) firstAuthor += " et al.";
		}

		// 4. 获取年份
		const year = parent.getField("year") || parent.getField("date") || "";

		let parts = [];
		if (firstAuthor) parts.push(firstAuthor);
		if (year) parts.push(year);
		let meta = parts.length > 0 ? " (" + parts.join(", ") + ")" : "";

		const message = title + meta;

		Services.prompt.alert(
			null,
			"Flowise — Paper Info",
			message
		);
		
	},

	_showPaperTitle(items) {
		if (!items || items.length === 0) {
			this.log("No items selected");
			return;
		}

		let lines = items.map((item, i) => {
			let title = item.getField("title") || "(untitled)";
			let year = item.getField("year") || item.getField("date") || "";
			let creators = item.getCreators();
			let firstAuthor = "";
			if (creators.length > 0) {
				let c = creators[0];
				firstAuthor = c.lastName || c.name || "";
				if (creators.length > 1) firstAuthor += " et al.";
			}

			let parts = [];
			if (firstAuthor) parts.push(firstAuthor);
			if (year) parts.push(year);
			let meta = parts.length > 0 ? " (" + parts.join(", ") + ")" : "";

			return (items.length > 1 ? (i + 1) + ". " : "") + title + meta;
		});

		let message = lines.join("\n\n");
		this.log("Show title:\n" + message);

		Services.prompt.alert(
			null,
			"Flowise — Paper Info",
			message
		);
	},

	async _getBibTeXFromPDFItem(pdfItem) {
		if (!pdfItem || !pdfItem.isAttachment) {
			throw new Error("必须传入 PDF 附件条目");
		}

		// 1. 获取父条目 ID
		const parentID = pdfItem.parentItemID;
		if (!parentID) {
			throw new Error("该 PDF 没有父条目");
		}

		// 2. 获取父条目对象
		const parent = Zotero.Items.get(parentID);
		if (!parent) {
			throw new Error("无法获取父条目");
		}

		// 3. 获取标题
		const title = parent.getField("title") || "(无标题)";
		return title;
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
