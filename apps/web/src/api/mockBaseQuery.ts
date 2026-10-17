/**
 * mockBaseQuery — minimal baseQuery for RTK Query endpoints using queryFn.
 * Returns empty data; actual responses come from queryFn implementations.
 */
export const mockBaseQuery = async () => ({ data: undefined as unknown });
