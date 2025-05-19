// Type declarations for test helpers
declare global {
  interface Window {
    h: {
      elements: any[];
      state: any;
      app: any;
      history: any;
      scene: any;
      store: any;
      setState: (state: any, callback?: () => void) => void;
    };
  }
}

export {}; 