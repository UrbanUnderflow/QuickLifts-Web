/// <reference types="@types/applepayjs" />
declare global {
  interface Window {
    ApplePaySession: typeof ApplePaySession;
  }
}

export {}; 