/**
 * tagTypes — shared type for RTK Query cache tag invalidation
 * driven by SSE events. Each tag maps to a specific RTK Query
 * providesTags/invalidatesTags entry across the API slices.
 */
export interface NotificationTag {
  type: string;
  id: string | number;
}
