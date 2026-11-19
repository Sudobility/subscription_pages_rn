/**
 * Test utilities for rendering components.
 *
 * Lightweight helpers for a jsdom environment using react-dom with proper
 * async support via `act` — the same shape the sibling `*_pages_rn` packages
 * use, so a spec reads alike across them.
 */
import React from 'react';

const ReactDOMClient = require('react-dom/client');

const { act: reactAct } = require('react');

export interface RenderResult {
  container: HTMLElement;
  /** First element whose own text is exactly `text`; throws when absent. */
  getByText: (text: string) => HTMLElement;
  /** First element whose own text is exactly `text` (or matches), or null. */
  queryByText: (text: string | RegExp) => HTMLElement | null;
  getAllByText: (text: string | RegExp) => HTMLElement[];
  getByTestId: (testId: string) => HTMLElement;
  queryByTestId: (testId: string) => HTMLElement | null;
  rerender: (element: React.ReactElement) => Promise<void>;
  unmount: () => void;
}

/**
 * Gets the direct text content of an element, concatenating only its
 * immediate text node children (not text from nested elements).
 */
function getDirectTextContent(el: HTMLElement): string {
  let text = '';
  for (const child of el.childNodes) {
    if (child.nodeType === Node.TEXT_NODE) {
      text += child.textContent ?? '';
    }
  }
  return text;
}

function findByText(container: HTMLElement, text: string | RegExp) {
  const results: HTMLElement[] = [];
  for (const el of container.querySelectorAll('*')) {
    const htmlEl = el as HTMLElement;
    const own = getDirectTextContent(htmlEl).trim();
    if (own === '') continue;
    if (typeof text === 'string' ? own === text : text.test(own)) {
      results.push(htmlEl);
    }
  }
  return results;
}

/**
 * Renders a React element into a DOM container.
 * Uses async act to properly flush effects (including resolved promises).
 */
export async function render(
  element: React.ReactElement
): Promise<RenderResult> {
  const container = document.createElement('div');
  document.body.appendChild(container);

  const root = ReactDOMClient.createRoot(container);

  await reactAct(async () => {
    root.render(element);
  });

  const queryByText = (text: string | RegExp): HTMLElement | null =>
    findByText(container, text)[0] ?? null;

  const queryByTestId = (testId: string): HTMLElement | null =>
    container.querySelector(`[data-testid="${testId}"]`);

  return {
    container,
    getByText: (text: string) => {
      const found = queryByText(text);
      if (!found) throw new Error(`Text "${text}" not found`);
      return found;
    },
    queryByText,
    getAllByText: (text: string | RegExp) => findByText(container, text),
    getByTestId: (testId: string) => {
      const found = queryByTestId(testId);
      if (!found) throw new Error(`Test id "${testId}" not found`);
      return found;
    },
    queryByTestId,
    rerender: async (next: React.ReactElement) => {
      await reactAct(async () => {
        root.render(next);
      });
    },
    unmount: () => {
      reactAct(() => {
        root.unmount();
      });
      container.remove();
    },
  };
}

/**
 * Simulates pressing an element by dispatching a click event, then lets the
 * promises the handler started settle.
 */
export async function firePress(element: HTMLElement): Promise<void> {
  await reactAct(async () => {
    element.click();
  });
}

/**
 * Flush all promises (microtasks) within act.
 */
export async function flushPromises(): Promise<void> {
  await reactAct(async () => {
    await new Promise(resolve => setTimeout(resolve, 0));
  });
}
