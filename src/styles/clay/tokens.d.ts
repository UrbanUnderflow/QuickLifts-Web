export declare const CLAY: Readonly<{
  paper: string; surface: string; raised: string; raisedSelected: string;
  ink: string; ink2: string; ink3: string; line: string; lineStrong: string;
  lime: string; limeDeep: string; onLime: string; sage: string;
  lightPaper: string; lightInk: string; lightMuted: string; moss: string;
}>;
export declare const CLAY_FONTS: Readonly<{ sans: string; serif: string }>;
export declare function clayCssVariables(): Record<string, string>;
export declare function clayTailwindColors(): Record<string, string>;
export declare function clayAlpha(hex: string, alpha: number): string;
