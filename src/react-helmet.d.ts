declare module 'react-helmet' {
    import { ComponentType, ReactNode } from 'react';
  
    export interface HelmetProps {
      children?: ReactNode;
    }
  
    export const Helmet: ComponentType<HelmetProps>;
  
    export default Helmet;
  }
  