use serde::Serialize;

#[derive(Clone, Copy, Debug, Default, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct QuickMoveState {
    pub opening_id: u64,
    pub revision: u64,
    pub enabled: bool,
}

#[derive(Default)]
pub struct QuickMoveSession {
    state: QuickMoveState,
    open: bool,
}

impl QuickMoveSession {
    pub fn snapshot(&self) -> QuickMoveState {
        self.state
    }

    pub fn open(&mut self) -> QuickMoveState {
        self.open = true;
        self.reset();
        self.state
    }

    pub fn close(&mut self) -> QuickMoveState {
        if self.open {
            self.open = false;
            self.reset();
        }
        self.state
    }

    fn reset(&mut self) {
        self.state.opening_id += 1;
        self.state.revision += 1;
        self.state.enabled = false;
    }

    pub fn set_enabled(&mut self, opening_id: u64, enabled: bool) -> QuickMoveState {
        if self.is_current(opening_id) && self.state.enabled != enabled {
            self.state.enabled = enabled;
            self.state.revision += 1;
        }
        self.state
    }

    pub fn is_current(&self, opening_id: u64) -> bool {
        self.open && self.state.opening_id == opening_id
    }

    pub fn dismiss_on_blur(&mut self) -> Option<QuickMoveState> {
        if self.open && !self.state.enabled {
            Some(self.close())
        } else {
            None
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn move_survives_repeated_blur_until_disabled() {
        let mut session = QuickMoveSession::default();
        let opening = session.open();
        assert!(session.set_enabled(opening.opening_id, true).enabled);
        assert_eq!(session.dismiss_on_blur(), None);
        assert_eq!(session.dismiss_on_blur(), None);
        assert!(session.snapshot().enabled);
        session.set_enabled(opening.opening_id, false);
        assert!(session.is_current(opening.opening_id));
        assert!(!session.dismiss_on_blur().unwrap().enabled);
        assert!(!session.is_current(opening.opening_id));
    }

    #[test]
    fn new_opening_resets_move_even_without_text() {
        let mut session = QuickMoveSession::default();
        let first = session.open();
        session.set_enabled(first.opening_id, true);
        let next = session.open();
        assert!(!next.enabled);
        assert_ne!(next.opening_id, first.opening_id);
        assert_eq!(session.set_enabled(first.opening_id, true), next);
        assert!(!session.is_current(first.opening_id));
        assert!(session.is_current(next.opening_id));
        assert!(session.dismiss_on_blur().is_some());
    }

    #[test]
    fn explicit_close_rejects_pending_toggles_and_text() {
        let mut session = QuickMoveSession::default();
        let opening = session.open();
        session.set_enabled(opening.opening_id, true);
        let closed = session.close();
        assert!(!closed.enabled);
        assert!(!session.is_current(opening.opening_id));
        assert_eq!(session.set_enabled(opening.opening_id, true), closed);
        assert_eq!(session.set_enabled(closed.opening_id, true), closed);
        assert_eq!(session.dismiss_on_blur(), None);
    }

    #[test]
    fn revisions_order_lifecycle_and_toggle_snapshots() {
        let mut session = QuickMoveSession::default();
        let initial = session.snapshot();
        let opening = session.open();
        let enabled = session.set_enabled(opening.opening_id, true);
        let disabled = session.set_enabled(opening.opening_id, false);
        let closed = session.close();
        assert!(!opening.enabled);
        assert!(enabled.enabled);
        assert!(!disabled.enabled);
        let snapshots = [initial, opening, enabled, disabled, closed];
        assert!(snapshots
            .windows(2)
            .all(|pair| pair[1].revision > pair[0].revision));
    }
}
