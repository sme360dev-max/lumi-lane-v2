export const STAMP_GOAL = 8;
export const STAMP_STORAGE_KEY = 'lumi-lane-stamp-ritual-demo-v1';

type Phase = 'idle' | 'pressing' | 'imprint' | 'earned' | 'unlocking' | 'unlocked' | 'preview' | 'redeemed';

export interface StampState {
  count: number;
  phase: Phase;
  restored: boolean;
}

export type StampAction =
  | { type: 'restore'; count: number }
  | { type: 'earn' | 'impact' | 'settle' | 'unlock' | 'flip' | 'replay' | 'redeem' | 'undo' | 'reset' | 'example' };

export const initialStampState: StampState = { count: 0, phase: 'idle', restored: false };

export const isCollecting = ({ phase }: StampState) => phase === 'idle' || phase === 'earned' || phase === 'redeemed';
export const hasReward = ({ phase }: StampState) => phase === 'unlocked' || phase === 'preview';
export const isInMotion = ({ phase }: StampState) => phase === 'pressing' || phase === 'imprint' || phase === 'unlocking';

export function stampReducer(state: StampState, action: StampAction): StampState {
  const { count, phase, restored } = state;
  if (action.type === 'restore') {
    if (restored) return state;
    const saved = Number.isInteger(action.count) && action.count >= 0 && action.count <= STAMP_GOAL ? action.count : 0;
    return { count: saved, phase: saved === STAMP_GOAL ? 'unlocked' : 'idle', restored: true };
  }
  if (!restored) return state;

  switch (action.type) {
    case 'earn':
      return isCollecting(state) ? { ...state, phase: 'pressing' } : state;
    case 'impact':
      return phase === 'pressing' ? { ...state, count: count + 1, phase: 'imprint' } : state;
    case 'settle':
      return phase === 'imprint' ? { ...state, phase: count === STAMP_GOAL ? 'unlocking' : 'earned' } : state;
    case 'unlock':
      return phase === 'unlocking' ? { ...state, phase: 'unlocked' } : state;
    case 'flip':
      return hasReward(state) ? { ...state, phase: phase === 'unlocked' ? 'preview' : 'unlocked' } : state;
    case 'replay':
      return hasReward(state) ? { ...state, phase: 'unlocking' } : state;
    case 'redeem':
      return phase === 'preview' ? { ...state, count: 0, phase: 'redeemed' } : state;
    case 'undo':
      return isCollecting(state) && count > 0
        ? { ...state, count: count - 1, phase: 'idle' }
        : state;
    case 'reset':
      return isInMotion(state) ? state : { ...state, count: 0, phase: 'idle' };
    case 'example':
      return isCollecting(state) ? { ...state, count: STAMP_GOAL - 1, phase: 'idle' } : state;
  }
}
