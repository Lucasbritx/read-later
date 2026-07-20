declare module 'lucide-react/dist/esm/icons/*.js' {
  import type { ForwardRefExoticComponent, RefAttributes, SVGProps } from 'react';

  type LucideIconProps = SVGProps<SVGSVGElement> & {
    size?: string | number;
    absoluteStrokeWidth?: boolean;
  };

  const Icon: ForwardRefExoticComponent<LucideIconProps & RefAttributes<SVGSVGElement>>;

  export default Icon;
}
