/**
 * Mock implementation of react-native for Vitest.
 * Used as an alias to avoid parsing Flow types in the actual RN package.
 *
 * Each component renders a DOM element and translates the props a spec asserts
 * on (press handlers, accessibility role/label) into their DOM equivalents.
 */
import React from 'react';
import { vi } from 'vitest';

/** RN accessibility props → the ARIA attributes a spec can query. */
function toDomProps(
  name: string,
  {
    accessibilityRole,
    accessibilityLabel,
    accessibilityState: _accessibilityState,
    onAccessibilityTap: _onAccessibilityTap,
    numberOfLines: _numberOfLines,
    hitSlop: _hitSlop,
    ...rest
  }: Record<string, any>
): Record<string, any> {
  const domProps: Record<string, any> = { ...rest, 'data-testid': name };
  if (accessibilityRole) domProps.role = accessibilityRole;
  if (accessibilityLabel) domProps['aria-label'] = accessibilityLabel;
  return domProps;
}

const createMockComponent = (name: string, tag = 'div') => {
  const Component = ({
    onPress,
    disabled,
    children,
    ...rest
  }: Record<string, any>) => {
    const domProps = toDomProps(name, rest);
    // Like the real touchables: a disabled one does not fire.
    if (onPress && !disabled) domProps.onClick = onPress;
    if (disabled) domProps['aria-disabled'] = 'true';
    return React.createElement(tag, domProps, children);
  };
  Component.displayName = name;
  return Component;
};

export const View = createMockComponent('View');
export const Text = createMockComponent('Text', 'span');
export const Pressable = createMockComponent('Pressable');
export const TouchableOpacity = createMockComponent('TouchableOpacity');
export const ActivityIndicator = createMockComponent('ActivityIndicator');

export const Platform = {
  OS: 'ios' as string,
  select: (obj: Record<string, unknown>) => obj.ios ?? obj.default,
};

export const Linking = {
  openURL: vi.fn(() => Promise.resolve()),
  canOpenURL: vi.fn(() => Promise.resolve(true)),
};

export const StyleSheet = {
  create: <T extends Record<string, unknown>>(styles: T): T => styles,
  hairlineWidth: 1,
  flatten: (style: unknown) => style,
};
