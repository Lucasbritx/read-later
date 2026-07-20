import { act, type ReactElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

export function render(ui: ReactElement) {
  const container = document.createElement('div');
  let root: Root | undefined;

  document.body.appendChild(container);

  act(() => {
    root = createRoot(container);
    root.render(ui);
  });

  return {
    container,
    unmount: () => {
      act(() => {
        root?.unmount();
      });
      container.remove();
    }
  };
}

export async function click(element: Element) {
  await act(async () => {
    element.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
  });
}

export async function typeInto(input: HTMLInputElement, value: string) {
  await act(async () => {
    const valueSetter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
    valueSetter?.call(input, value);
    input.dispatchEvent(new Event('input', { bubbles: true }));
  });
}

export async function waitFor(assertion: () => void) {
  const startedAt = Date.now();
  let lastError: unknown;

  while (Date.now() - startedAt < 1000) {
    try {
      assertion();
      return;
    } catch (error) {
      lastError = error;
      await act(async () => {
        await Promise.resolve();
      });
    }
  }

  throw lastError;
}

export function getByText(container: ParentNode, text: string) {
  const element = queryByText(container, text);

  if (!element) {
    throw new Error(`Could not find text: ${text}`);
  }

  return element;
}

export function queryByText(container: ParentNode, text: string) {
  return Array.from(container.querySelectorAll('*')).find(
    (element) => element.textContent?.trim() === text
  );
}

export function getInputByLabel(container: ParentNode, labelText: string) {
  const label = Array.from(container.querySelectorAll('label')).find((element) =>
    element.textContent?.includes(labelText)
  );
  const inputId = label?.getAttribute('for');
  const input = inputId
    ? container.querySelector<HTMLInputElement>(`#${inputId}`)
    : label?.querySelector('input');

  if (!input) {
    throw new Error(`Could not find input label: ${labelText}`);
  }

  return input;
}

export function getButton(container: ParentNode, name: string) {
  const button = Array.from(container.querySelectorAll('button')).find((element) => {
    const accessibleName = element.getAttribute('aria-label') ?? element.textContent?.trim();
    return accessibleName === name;
  });

  if (!button) {
    throw new Error(`Could not find button: ${name}`);
  }

  return button;
}
