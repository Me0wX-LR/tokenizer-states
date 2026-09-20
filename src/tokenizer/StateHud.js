import CONSTANTS from "../constants.js";
import TokenStates from "./TokenStates.js";

export default class StateHud {

  static PANEL_ID = "tokenizer-state-hud";

  static resolveHtml(html, hud) {
    if (html instanceof HTMLElement) return html;
    if (html?.[0] instanceof HTMLElement) return html[0];
    return hud?.element ?? null;
  }

  static async renderTemplate(data) {
    const path = `modules/${CONSTANTS.MODULE_ID}/templates/state-hud.hbs`;
    if (foundry.applications?.handlebars?.renderTemplate) {
      return foundry.applications.handlebars.renderTemplate(path, data);
    }
    return renderTemplate(path, data);
  }

  static close(root) {
    document.getElementById(this.PANEL_ID)?.remove();
    root?.querySelector(".control-icon[data-tokenizer-states]")?.classList.remove("active");
  }

  static positionPanel(panel, root) {
    const rect = root.getBoundingClientRect();
    const left = Math.min(window.innerWidth - 360, rect.right + 8);
    const top = Math.max(8, Math.min(window.innerHeight - 240, rect.top));
    panel.style.position = "fixed";
    panel.style.left = `${Math.max(8, left)}px`;
    panel.style.top = `${top}px`;
    panel.style.zIndex = "1000";
  }

  static async open(hud, root, token) {
    this.close(root);
    const data = TokenStates.hudData(token);
    const wrapper = document.createElement("div");
    wrapper.innerHTML = await this.renderTemplate(data);
    const panel = wrapper.firstElementChild;
    if (!panel) return;
    panel.addEventListener("click", (event) => this.onPanelClick(event, hud, root, token));
    panel.addEventListener("pointerdown", (event) => event.stopPropagation());
    this.positionPanel(panel, root);
    document.body.appendChild(panel);
    root.querySelector(".control-icon[data-tokenizer-states]")?.classList.add("active");
  }

  static async toggle(hud, root, token) {
    const existing = document.getElementById(this.PANEL_ID);
    if (existing) {
      this.close(root);
      return;
    }
    await this.open(hud, root, token);
  }

  static async onPanelClick(event, hud, root, token) {
    const actionEl = event.target.closest("[data-action]");
    if (!actionEl) return;
    event.preventDefault();
    event.stopPropagation();

    const actor = TokenStates.flagActor(token);
    const action = actionEl.dataset.action;
    const stateId = actionEl.dataset.stateId;
    const api = game.modules.get(CONSTANTS.MODULE_ID)?.api;

    if (action === "switch") {
      await TokenStates.setActive(actor, stateId, { token });
      await this.open(hud, root, token);
      return;
    }

    if (action === "edit" && api?.tokenizeDoc) {
      api.tokenizeDoc({ actor, token: TokenStates.getTokenDocument(token) }, { stateId });
      return;
    }

    if (action === "delete") {
      if (TokenStates.isDefault(stateId)) return;
      const state = TokenStates.getState(actor, stateId, token);
      const confirmed = await TokenStates.confirmDelete(state.name);
      if (!confirmed) return;
      await TokenStates.deleteState(actor, stateId);
      await this.open(hud, root, token);
      return;
    }

    if (action === "add" && api?.tokenizeDoc) {
      const name = await TokenStates.promptName();
      if (!name) return;
      const state = await TokenStates.createState(actor, name, { token });
      if (!state) return;
      api.tokenizeDoc({ actor, token: TokenStates.getTokenDocument(token) }, { stateId: state.id });
    }
  }

  static onRenderTokenHUD(hud, html) {
    const token = hud.object ?? hud.token;
    const actor = TokenStates.flagActor(token);
    if (!token || !actor || !TokenStates.canSwitch(token)) return;
    if (actor.prototypeToken?.randomImg) return;

    const root = this.resolveHtml(html, hud);
    if (!root) return;
    if (root.querySelector(".control-icon[data-tokenizer-states]")) return;

    const button = document.createElement("div");
    button.classList.add("control-icon");
    button.dataset.tokenizerStates = "true";
    button.dataset.tooltip = game.i18n.localize(`${CONSTANTS.MODULE_ID}.states.hud-title`);
    button.title = game.i18n.localize(`${CONSTANTS.MODULE_ID}.states.hud-title`);
    button.innerHTML = `<i class="fas fa-masks-theater"></i>`;
    button.style.pointerEvents = "all";
    button.addEventListener("click", async (event) => {
      event.preventDefault();
      event.stopPropagation();
      await this.toggle(hud, root, token);
    });

    const column = root.querySelector(".col.right, .right");
    if (column) column.appendChild(button);
    else root.appendChild(button);
  }

  static register() {
    Hooks.on("renderTokenHUD", (...args) => this.onRenderTokenHUD(...args));
    Hooks.on("closeTokenHUD", (hud, html) => {
      this.close(this.resolveHtml(html, hud));
    });
  }

}
