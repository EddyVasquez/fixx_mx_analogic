import { Component, type ReactNode } from "react";
import i18n from "@/i18n";

/** If something crashes, say so in the person's language and announce it to screen readers. */
export class ErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() {
    return this.state.failed
      ? <p role="alert" className="m-5 rounded-lg border-2 border-ink bg-paper p-4 font-bold">{i18n.t("error.generic")}</p>
      : this.props.children;
  }
}
