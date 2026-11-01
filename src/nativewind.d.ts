// Type declarations for NativeWind className prop
import 'react-native';

declare module 'react-native' {
  interface ViewProps {
    className?: string;
  }
  interface TextProps {
    className?: string;
  }
  interface ImageProps {
    className?: string;
  }
  interface ScrollViewProps {
    className?: string;
    contentContainerClassName?: string;
  }
  interface PressableProps {
    className?: string | ((state: { pressed: boolean }) => string);
  }
  interface TouchableOpacityProps {
    className?: string;
  }
}
