import CONSTANTS from "../constants.js";
import logger from "../libs/logger.js";
import Utils from "../libs/Utils.js";

export default class TokenStates {

  static DEFAULT_ID = CONSTANTS.DEFAULT_STATE_ID;

  static isDefault(stateId) {
    return !stateId || stateId === this.DEFAULT_ID;
  }

  static getAvatarKey() {
    switch (game.system.id) {
      case "yzecoriolis": {
        if (foundry.utils.isNewerVersion("3.2.0", game.system.version)) {
          return "system.keyArt";
        }
        return "img";
      }
      default:
        return "img";
    }
  }

  static getAvatarPath(actor) {
    if (!actor) return null;
    return foundry.utils.getProperty(actor, this.getAvatarKey());
  }

  static strip(path) {
    if (!path || typeof path !== "string") return path;
    return path.split("?")[0];
  }

  static getActor(doc) {
    if (!doc) return null;
    if (doc.documentName === "Actor") return doc;
    if (doc.actor) return doc.actor;
    if (doc.document?.actor) return doc.document.actor;
    return null;
  }

  static getTokenDocument(token) {
    if (!token) return null;
    if (token.documentName === "Token") return token;
    if (token.document?.documentName === "Token") return token.document;
    return null;
  }

  static getWorldActor(doc) {
    const tokenDoc = this.getTokenDocument(doc);
    const actorId = tokenDoc?.actorId
      ?? doc?.actorId
      ?? (doc?.documentName === "Actor" && !doc.isToken ? doc.id : null)
      ?? doc?.actor?.id;
    if (actorId) {
      const world = game.actors.get(actorId);
      if (world) return world;
    }
    const actor = this.getActor(doc);
    if (!actor) return null;
    if (!actor.isToken) return actor;
    return game.actors.get(actor.id) ?? actor;
  }

  static flagActor(doc) {
    return this.getWorldActor(doc) ?? this.getActor(doc);
  }

  static getSavedStates(actor) {
    const actorDoc = this.flagActor(actor);
    if (!actorDoc) return [];
    const states = actorDoc.getFlag(CONSTANTS.MODULE_ID, CONSTANTS.FLAG_KEYS.STATES);
    return Array.isArray(states) ? foundry.utils.deepClone(states) : [];
  }

  static getSavedState(actor, stateId) {
    return this.getSavedStates(actor).find((state) => state.id === stateId) ?? null;
  }

  static getDefaultName(actor) {
    const actorDoc = this.flagActor(actor);
    const named = actorDoc?.getFlag(CONSTANTS.MODULE_ID, CONSTANTS.FLAG_KEYS.DEFAULT_NAME);
    return named || game.i18n.localize(`${CONSTANTS.MODULE_ID}.states.default`);
  }

  static flagPath(prefix = "") {
    const path = `flags.${CONSTANTS.MODULE_ID}.${CONSTANTS.FLAG_KEYS.ACTIVE}`;
    return prefix ? `${prefix}.${path}` : path;
  }

  static readFlag(source, key) {
    if (!source) return undefined;
    if (typeof source.getFlag === "function") {
      return source.getFlag(CONSTANTS.MODULE_ID, key);
    }
    return source.flags?.[CONSTANTS.MODULE_ID]?.[key];
  }

  static resolveActiveId(source, library) {
    if (!source) return this.DEFAULT_ID;
    const active = this.readFlag(source, CONSTANTS.FLAG_KEYS.ACTIVE);
    if (this.isDefault(active)) return this.DEFAULT_ID;
    return this.getSavedState(library ?? source, active) ? active : this.DEFAULT_ID;
  }

  static getPrototypeActiveId(world) {
    return this.resolveActiveId(world?.prototypeToken, world);
  }

  static getInstanceActiveId(tokenDoc, world) {
    if (!tokenDoc || tokenDoc.actorLink !== false) return this.DEFAULT_ID;
    const sources = [
      tokenDoc,
      tokenDoc.delta,
      tokenDoc.actor?.isToken ? tokenDoc.actor : null,
    ];
    for (const source of sources) {
      const found = this.resolveActiveId(source, world);
      if (!this.isDefault(found)) return found;
    }
    return this.DEFAULT_ID;
  }

  static inferActiveId(world) {
    if (!world) return this.DEFAULT_ID;
    const fromWorld = this.resolveActiveId(world, world);
    if (!this.isDefault(fromWorld)) return fromWorld;

    const fromProto = this.getPrototypeActiveId(world);
    if (!this.isDefault(fromProto)) return fromProto;

    for (const scene of game.scenes ?? []) {
      for (const token of scene.tokens ?? []) {
        if (token.actorId === world.id) {
          const fromInstance = this.getInstanceActiveId(token, world);
          if (!this.isDefault(fromInstance)) return fromInstance;
        }
      }
    }
    return this.DEFAULT_ID;
  }

  static getActiveId(doc) {
    const world = this.flagActor(doc);
    const tokenDoc = this.getTokenDocument(doc);
    const fromInstance = this.getInstanceActiveId(tokenDoc, world);
    if (!this.isDefault(fromInstance)) return fromInstance;
    return this.inferActiveId(world);
  }

  static getDefaultState(actor, token) {
    const actorDoc = this.flagActor(actor);
    const tokenDoc = this.getTokenDocument(token);
    return {
      id: this.DEFAULT_ID,
      name: this.getDefaultName(actorDoc),
      slug: this.DEFAULT_ID,
      isDefault: true,
      avatar: this.getAvatarPath(actorDoc),
      token: tokenDoc?.texture?.src ?? actorDoc?.prototypeToken?.texture?.src,
      forceDynamicRing: Boolean(tokenDoc?.ring?.enabled ?? actorDoc?.prototypeToken?.ring?.enabled),
    };
  }

  static normalizeState(actor, state, token) {
    if (!state || this.isDefault(state.id)) {
      return this.getDefaultState(actor, token);
    }
    const fallback = this.getDefaultState(actor, token);
    return {
      id: state.id,
      name: state.name || game.i18n.localize(`${CONSTANTS.MODULE_ID}.states.unnamed`),
      slug: state.slug || state.id,
      isDefault: false,
      avatar: state.avatar || fallback.avatar,
      token: state.token || fallback.token,
      forceDynamicRing: Boolean(state.forceDynamicRing),
    };
  }

  static getStates(actor, token) {
    const actorDoc = this.flagActor(actor);
    const states = [this.getDefaultState(actorDoc, token)];
    for (const saved of this.getSavedStates(actorDoc)) {
      states.push(this.normalizeState(actorDoc, saved, token));
    }
    return states;
  }

  static getState(actor, stateId, token) {
    if (this.isDefault(stateId)) return this.getDefaultState(actor, token);
    const saved = this.getSavedState(actor, stateId);
    return this.normalizeState(actor, saved ?? { id: this.DEFAULT_ID }, token);
  }

  static getAvatarSrc(actor, stateId) {
    return this.getState(actor, stateId).avatar;
  }

  static getTokenSrc(actor, token, stateId) {
    return this.getState(actor, stateId, token).token;
  }

  static getDisplayAvatarSrc(actor) {
    return this.getAvatarSrc(actor, this.getActiveId(actor));
  }

  static getDisplayTokenSrc(token) {
    const tokenDoc = this.getTokenDocument(token);
    const actor = this.flagActor(token);
    const activeId = this.getActiveId(token);
    if (this.isDefault(activeId)) {
      return tokenDoc?.texture?.src ?? this.getTokenSrc(actor, tokenDoc, activeId);
    }
    return this.getTokenSrc(actor, tokenDoc, activeId);
  }

  static canSwitch(token) {
    if (!game.user) return false;
    if (game.user.isGM) return true;
    const tokenDoc = this.getTokenDocument(token);
    const actor = this.getActor(token);
    return Boolean(token?.isOwner || tokenDoc?.isOwner || actor?.isOwner);
  }

  static canUseTokenizer() {
    if (game.user?.can("FILES_UPLOAD")) return true;
    return !game.settings.get(CONSTANTS.MODULE_ID, "disable-player");
  }

  static async confirmDelete(name) {
    return foundry.applications.api.DialogV2.confirm({
      window: { title: game.i18n.localize(`${CONSTANTS.MODULE_ID}.states.delete-title`) },
      content: `<p>${game.i18n.format(`${CONSTANTS.MODULE_ID}.states.delete-confirm`, { name })}</p>`,
    });
  }

  static async promptName({ title, value = "" } = {}) {
    const safeValue = foundry.utils.escapeHTML(value ?? "");
    return foundry.applications.api.DialogV2.prompt({
      window: { title: title || game.i18n.localize(`${CONSTANTS.MODULE_ID}.states.name-title`) },
      content: `
        <div class="form-group">
          <label>${game.i18n.localize(`${CONSTANTS.MODULE_ID}.states.name`)}</label>
          <input type="text" name="stateName" value="${safeValue}" autofocus>
        </div>`,
      ok: {
        label: game.i18n.localize(`${CONSTANTS.MODULE_ID}.label.OK`),
        callback: (_event, button) => button.form.elements.stateName.value?.trim(),
      },
      rejectClose: false,
    });
  }

  static async setDefaultName(actor, name) {
    const actorDoc = this.flagActor(actor);
    if (!actorDoc || !name) return;
    const trimmed = name.trim();
    if (!trimmed || trimmed === this.getDefaultName(actorDoc)) return;
    await actorDoc.setFlag(CONSTANTS.MODULE_ID, CONSTANTS.FLAG_KEYS.DEFAULT_NAME, trimmed);
  }

  static async createState(actor, name, { token } = {}) {
    const actorDoc = this.flagActor(actor);
    const tokenDoc = this.getTokenDocument(token);
    const trimmed = name?.trim();
    if (!actorDoc || !trimmed) return null;

    const id = foundry.utils.randomID();
    let slug = await Utils.makeSlug(trimmed);
    const existing = this.getSavedStates(actorDoc);
    if (existing.some((state) => state.slug === slug)) {
      slug = `${slug}-${id.slice(0, 4)}`;
    }

    const state = {
      id,
      name: trimmed,
      slug,
      avatar: this.strip(this.getAvatarPath(actorDoc)),
      token: this.strip(tokenDoc?.texture?.src ?? actorDoc.prototypeToken?.texture?.src),
      forceDynamicRing: false,
    };
    existing.push(state);
    await actorDoc.update({
      [`flags.${CONSTANTS.MODULE_ID}.${CONSTANTS.FLAG_KEYS.STATES}`]: existing,
    });
    return this.normalizeState(actorDoc, state);
  }

  static async renameState(actor, stateId, name) {
    const actorDoc = this.flagActor(actor);
    const trimmed = name?.trim();
    if (!actorDoc || !trimmed) return null;

    if (this.isDefault(stateId)) {
      await this.setDefaultName(actorDoc, trimmed);
      return this.getDefaultState(actorDoc);
    }

    const states = this.getSavedStates(actorDoc);
    const state = states.find((entry) => entry.id === stateId);
    if (!state) return null;
    state.name = trimmed;
    await actorDoc.update({
      [`flags.${CONSTANTS.MODULE_ID}.${CONSTANTS.FLAG_KEYS.STATES}`]: states,
    });
    return this.normalizeState(actorDoc, state);
  }

  static async deleteState(actor, stateId) {
    const actorDoc = this.flagActor(actor);
    if (!actorDoc || this.isDefault(stateId)) return;

    const states = this.getSavedStates(actorDoc).filter((state) => state.id !== stateId);
    const update = {
      [`flags.${CONSTANTS.MODULE_ID}.${CONSTANTS.FLAG_KEYS.STATES}`]: states,
    };
    if (this.getActiveId(actorDoc) === stateId) {
      update[this.flagPath()] = this.DEFAULT_ID;
      update[this.flagPath("prototypeToken")] = this.DEFAULT_ID;
    }
    await actorDoc.update(update);
    await this.refreshActorDisplays(actorDoc);
  }

  static async saveState(actor, data) {
    const actorDoc = this.flagActor(actor);
    if (!actorDoc || this.isDefault(data?.id)) return null;

    const states = this.getSavedStates(actorDoc);
    let state = states.find((entry) => entry.id === data.id);
    if (!state) {
      state = { id: data.id, slug: data.slug || data.id };
      states.push(state);
    }
    state.name = data.name || state.name;
    state.slug = data.slug || state.slug;
    if (data.avatar) state.avatar = this.strip(data.avatar);
    if (data.token) state.token = this.strip(data.token);
    if (data.forceDynamicRing !== undefined) state.forceDynamicRing = Boolean(data.forceDynamicRing);

    await actorDoc.update({
      [`flags.${CONSTANTS.MODULE_ID}.${CONSTANTS.FLAG_KEYS.STATES}`]: states,
    });
    return this.normalizeState(actorDoc, state);
  }

  static async persistActive(actorDoc, stateId, { token } = {}) {
    if (!actorDoc) return;
    const update = {
      [this.flagPath()]: stateId,
      [this.flagPath("prototypeToken")]: stateId,
    };
    await actorDoc.update(update);
    const tokenDoc = this.getTokenDocument(token);
    if (tokenDoc && tokenDoc.actorLink === false) {
      await tokenDoc.update({ [this.flagPath()]: stateId });
    }
  }

  static async rememberActiveFromExisting(actor) {
    const world = this.flagActor(actor);
    if (!world) return this.DEFAULT_ID;
    const inferred = this.inferActiveId(world);
    const stored = this.resolveActiveId(world, world);
    if (this.isDefault(inferred) || stored === inferred) return inferred;
    try {
      await this.persistActive(world, inferred);
    } catch (error) {
      logger.debug("Could not persist inferred token state", error);
    }
    return inferred;
  }

  static async setActive(actor, stateId, { token } = {}) {
    const actorDoc = this.flagActor(token ?? actor);
    if (!actorDoc) return;

    const tokenDoc = this.getTokenDocument(token);
    const state = this.getState(actorDoc, stateId, tokenDoc);
    await this.persistActive(actorDoc, state.id, { token: tokenDoc });
    await this.refreshActorDisplays(actorDoc);
  }

  static hudData(token) {
    const actor = this.flagActor(token);
    const tokenDoc = this.getTokenDocument(token);
    const activeId = this.getActiveId(token);
    const fallback = CONST.DEFAULT_TOKEN;
    return {
      states: this.getStates(actor, tokenDoc).map((state) => ({
        ...state,
        active: state.id === activeId,
        preview: state.token || state.avatar || fallback,
      })),
      canEdit: this.canUseTokenizer() && this.canSwitch(token),
      canDelete: this.canSwitch(token),
      activeId,
    };
  }

  static applySheetAvatar(app, html) {
    const actor = this.flagActor(app?.document) ?? this.flagActor(app?.actor);
    if (!actor) return;
    const src = this.getDisplayAvatarSrc(actor);
    if (!src) return;

    const root = html instanceof HTMLElement ? html : html?.[0];
    if (!root?.querySelectorAll) return;

    const key = this.getAvatarKey();
    root.querySelectorAll(`[data-edit="${key}"]`).forEach((el) => {
      if (el.tagName === "IMG") el.src = src;
      el.querySelectorAll?.("img").forEach((img) => {
        img.src = src;
      });
    });
  }

  static textureCache = new Map();

  static async loadTexture(src) {
    if (!src) return null;
    if (this.textureCache.has(src)) return this.textureCache.get(src);
    let texture;
    if (typeof foundry.canvas.loadTexture === "function") {
      texture = await foundry.canvas.loadTexture(src);
    } else if (typeof window.loadTexture === "function") {
      texture = await window.loadTexture(src);
    } else if (foundry.canvas.TextureLoader?.loader?.loadTexture) {
      texture = await foundry.canvas.TextureLoader.loader.loadTexture(src);
    } else {
      throw new Error(`Unable to load texture: ${src}`);
    }
    this.textureCache.set(src, texture);
    return texture;
  }

  static originalRefreshMesh = null;

  static assignTexture(token, texture) {
    if (!token?.mesh || !texture) return;
    if (typeof token.mesh.setTexture === "function") {
      token.mesh.setTexture(texture);
    } else {
      token.mesh.texture = texture;
    }
    if (typeof token.mesh.refresh === "function") token.mesh.refresh();
  }

  static async restoreDefaultMesh(token) {
    const generation = (token._tokenizerStateGen || 0) + 1;
    token._tokenizerStateGen = generation;
    token._tokenizerAppliedSrc = null;

    if (this.originalRefreshMesh) {
      token._tokenizerSkipOverlay = true;
      try {
        this.originalRefreshMesh.call(token);
      } finally {
        token._tokenizerSkipOverlay = false;
      }
    }

    const src = this.getDisplayTokenSrc(token);
    if (!src) return;
    try {
      const texture = await this.loadTexture(src);
      if (generation !== token._tokenizerStateGen || !texture) return;
      this.assignTexture(token, texture);
    } catch (error) {
      logger.error("Failed to restore default token texture", error);
    }
  }

  static _pendingApply = new Set();

  static getSceneTokens(actor) {
    const world = this.flagActor(actor);
    if (!world || !canvas.ready) return [];
    return canvas.tokens.placeables.filter((token) => token.document?.actorId === world.id);
  }

  static scheduleApply(tokenDoc, attempt = 0) {
    const id = tokenDoc?.id;
    if (!id) return;
    if (attempt === 0) {
      if (this._pendingApply.has(id)) return;
      this._pendingApply.add(id);
    }
    const token = canvas.tokens?.get(id) ?? tokenDoc.object;
    if (token?.mesh) {
      this._pendingApply.delete(id);
      this.applyTokenDisplay(token);
      return;
    }
    if (attempt >= 20) {
      this._pendingApply.delete(id);
      return;
    }
    window.setTimeout(() => this.scheduleApply(tokenDoc, attempt + 1), 50);
  }

  static stampActiveState(tokenDoc, data = {}) {
    const actorId = data.actorId ?? tokenDoc?.actorId;
    const world = game.actors.get(actorId);
    if (!world) return;
    const activeId = this.inferActiveId(world);
    if (this.isDefault(activeId)) return;
    const patch = {
      flags: {
        [CONSTANTS.MODULE_ID]: {
          [CONSTANTS.FLAG_KEYS.ACTIVE]: activeId,
        },
      },
    };
    if (typeof tokenDoc.updateSource === "function") tokenDoc.updateSource(patch);
    foundry.utils.mergeObject(data, patch);
  }

  static async applyTokenDisplay(token) {
    if (token?._tokenizerSkipOverlay) return;
    if (!token) return;
    if (!token.mesh) {
      this.scheduleApply(token.document ?? token);
      return;
    }
    const actor = this.flagActor(token);
    if (!actor) return;

    const activeId = this.getActiveId(token);
    if (this.isDefault(activeId)) {
      if (token._tokenizerAppliedSrc) await this.restoreDefaultMesh(token);
      return;
    }

    const src = this.getDisplayTokenSrc(token);
    if (!src) return;

    const cached = this.textureCache.get(src);
    if (cached) {
      this.assignTexture(token, cached);
      token._tokenizerAppliedSrc = src;
      return;
    }

    const generation = (token._tokenizerStateGen || 0) + 1;
    token._tokenizerStateGen = generation;
    try {
      const texture = await this.loadTexture(src);
      if (generation !== token._tokenizerStateGen || !token.mesh || !texture) return;
      token._tokenizerAppliedSrc = src;
      this.assignTexture(token, texture);
    } catch (error) {
      logger.error("Failed to apply token state texture", error);
    }
  }

  static async refreshActorDisplays(actor) {
    const actorDoc = this.flagActor(actor);
    if (!actorDoc) return;

    if (canvas.ready) {
      await Promise.all(this.getSceneTokens(actorDoc).map((token) => this.applyTokenDisplay(token)));
    }

    const apps = [
      ...Object.values(ui.windows ?? {}),
      ...(foundry.applications?.instances ? [...foundry.applications.instances.values()] : []),
    ];
    for (const app of apps) {
      const sheetActor = this.flagActor(app.document) ?? this.flagActor(app.actor);
      if (sheetActor?.id === actorDoc.id) {
        this.applySheetAvatar(app, app.element);
      }
    }
  }

  static refreshAllTokens() {
    if (!canvas.ready) return;
    const seen = new Set();
    for (const token of canvas.tokens.placeables) {
      const world = this.flagActor(token);
      if (world && !seen.has(world.id)) {
        seen.add(world.id);
        this.rememberActiveFromExisting(world);
      }
      this.applyTokenDisplay(token);
    }
  }

  static patchTokenRefresh() {
    const proto = CONFIG.Token?.objectClass?.prototype;
    if (!proto || proto._tokenizerStatesPatched) return;
    const refresh = proto._refreshMesh;
    if (typeof refresh !== "function") return;
    proto._tokenizerStatesPatched = true;
    this.originalRefreshMesh = refresh;
    proto._refreshMesh = function _refreshMesh(...args) {
      const result = refresh.apply(this, args);
      if (this._tokenizerSkipOverlay) return result;
      TokenStates.applyTokenDisplay(this);
      return result;
    };
  }

  static registerHooks() {
    this.patchTokenRefresh();
    Hooks.on("canvasReady", () => this.refreshAllTokens());
    Hooks.on("drawToken", (token) => this.applyTokenDisplay(token));
    Hooks.on("refreshToken", (token) => this.applyTokenDisplay(token));
    Hooks.on("preCreateToken", (tokenDoc, data) => this.stampActiveState(tokenDoc, data));
    Hooks.on("createToken", (tokenDoc) => this.scheduleApply(tokenDoc));
    Hooks.on("updateActor", (actor, changes) => {
      if (foundry.utils.getProperty(changes, `flags.${CONSTANTS.MODULE_ID}`)) {
        this.refreshActorDisplays(actor);
      }
    });
    Hooks.on("renderActorSheet", (app, html) => this.applySheetAvatar(app, html));
    Hooks.on("renderActorSheetV2", (app, html) => this.applySheetAvatar(app, html));
    Hooks.on("renderApplicationV2", (app, html) => {
      if (app.document instanceof Actor) this.applySheetAvatar(app, html);
    });
  }

}
