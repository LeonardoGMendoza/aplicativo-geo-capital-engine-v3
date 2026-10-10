import { Component, createElement, type ReactNode } from 'react'

/** Isolates loading and rendering failures without replacing textual context. */
export class MapErrorBoundary extends Component<{ children: ReactNode; message: string }, { failed: boolean }> {
  state = { failed: false }

  static getDerivedStateFromError() { return { failed: true } }

  render() {
    return this.state.failed
      ? createElement('p', { role: 'alert', className: 'rounded border bg-secondary p-4 text-sm' }, this.props.message)
      : this.props.children
  }
}
