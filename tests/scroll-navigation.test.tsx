import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, it } from 'vitest';
import { useScrollNavigation } from '@/hooks/use-scroll-navigation';
function Navigation({ destination = 'setup' }: { destination?: string }) {
  const { visible, navigationRef, reveal } = useScrollNavigation(destination);
  return <nav ref={navigationRef} onFocusCapture={reveal} data-visible={visible}><button>Navigate</button></nav>;
}
function scrollTo(top: number) {
  Object.defineProperty(window, 'scrollY', { configurable: true, value: top });
  fireEvent.scroll(window);
}
afterEach(() => { cleanup(); Object.defineProperty(window, 'scrollY', { configurable: true, value: 0 }); });
it('keeps restored/programmatic scrolling visible and hides only after user scroll intent', () => {
  render(<Navigation />);
  scrollTo(500);
  expect(screen.getByRole('navigation').getAttribute('data-visible')).toBe('true');
  fireEvent.wheel(window);
  scrollTo(700);
  expect(screen.getByRole('navigation').getAttribute('data-visible')).toBe('false');
  scrollTo(600);
  expect(screen.getByRole('navigation').getAttribute('data-visible')).toBe('true');
});
it('reveals focused controls and resets visibility when the destination changes', () => {
  const view = render(<Navigation />);
  fireEvent.wheel(window); scrollTo(800);
  act(() => screen.getByRole('button').focus());
  expect(screen.getByRole('navigation').getAttribute('data-visible')).toBe('true');
  scrollTo(900);
  expect(screen.getByRole('navigation').getAttribute('data-visible')).toBe('true');
  act(() => screen.getByRole('button').blur());
  scrollTo(1000);
  expect(screen.getByRole('navigation').getAttribute('data-visible')).toBe('false');
  view.rerender(<Navigation destination="playground" />);
  expect(screen.getByRole('navigation').getAttribute('data-visible')).toBe('true');
});
