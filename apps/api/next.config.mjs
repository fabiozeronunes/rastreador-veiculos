/** next.config.mjs — configuração mínima para Vercel */
export default {
  reactStrictMode: true,
  // Permitir arquivos .js nas rotas sem .ts
  typescript: {
    // !! WARN !!
    // Remove this if you have issues running your site on Vercel
    ignoreBuildErrors: true,
  },
};