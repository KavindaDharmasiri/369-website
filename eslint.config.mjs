import nextVitals from 'eslint-config-next/core-web-vitals'

const config = [
  ...nextVitals,
  { ignores: ['node_modules/**', '.next/**', '.next-dev/**', 'out/**', 'dist/**', 'public/litert-wasm/**', 'next-env.d.ts'] },
]

export default config
