import { create } from 'zustand';

interface UIState {
  tooltipsEnabled: boolean;
  toggleTooltips: () => void;
  gridSnapEnabled: boolean;
  toggleGridSnap: () => void;
}

const TOOLTIPS_KEY = 'codefyui-tooltips';
const GRIDSNAP_KEY = 'codefyui-gridsnap';

export const useUIStore = create<UIState>((set) => ({
  tooltipsEnabled: localStorage.getItem(TOOLTIPS_KEY) !== 'false',
  toggleTooltips: () =>
    set((state) => {
      const next = !state.tooltipsEnabled;
      localStorage.setItem(TOOLTIPS_KEY, String(next));
      return { tooltipsEnabled: next };
    }),
  gridSnapEnabled: localStorage.getItem(GRIDSNAP_KEY) === 'true',
  toggleGridSnap: () =>
    set((state) => {
      const next = !state.gridSnapEnabled;
      localStorage.setItem(GRIDSNAP_KEY, String(next));
      return { gridSnapEnabled: next };
    }),
}));
