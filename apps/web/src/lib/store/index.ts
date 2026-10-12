/**
 * Typed Redux hooks — use these throughout the app,
 * never the raw useSelector / useDispatch from react-redux
 */

import { useDispatch, useSelector } from 'react-redux';
import type { RootState, AppDispatch } from './store';

export const useAppDispatch = useDispatch.withTypes<AppDispatch>();
export const useAppSelector = useSelector.withTypes<RootState>();

// Re-export store and API for convenience
export { store } from './store';
export { siteflowApi } from './api';
