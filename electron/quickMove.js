/** Native popup lifecycle; mirrored by src-tauri/src/quick_move.rs. */
export class QuickMoveSession {
  #state = { openingId: 0, revision: 0, enabled: false };
  #open = false;

  snapshot() { return { ...this.#state }; }

  open() {
    this.#open = true;
    this.#state = { openingId: this.#state.openingId + 1, revision: this.#state.revision + 1, enabled: false };
    return this.snapshot();
  }

  close() {
    if (this.#open) {
      this.#open = false;
      this.#state = { openingId: this.#state.openingId + 1, revision: this.#state.revision + 1, enabled: false };
    }
    return this.snapshot();
  }

  setEnabled(openingId, enabled) {
    if (this.isCurrent(openingId) && this.#state.enabled !== enabled) {
      this.#state = { ...this.#state, enabled, revision: this.#state.revision + 1 };
    }
    return this.snapshot();
  }

  isCurrent(openingId) { return this.#open && this.#state.openingId === openingId; }

  dismissOnBlur() {
    return this.#open && !this.#state.enabled ? this.close() : null;
  }
}
