import { defineConfig } from 'tsup';

export default defineConfig({
  entry: {
    index: 'src/index.ts',
    'types/index': 'src/types/index.ts',
    'utils/index': 'src/utils/index.ts',
    'constants/index': 'src/constants/index.ts',
    'events/index': 'src/events/index.ts',
    'reporting/index': 'src/reporting/index.ts',
  },
  format: ['cjs', 'esm'],
  dts: true,
  clean: true,
  sourcemap: true,
});
