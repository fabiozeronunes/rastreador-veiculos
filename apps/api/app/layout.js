import Nav from './components/Nav';

export const metadata = {
  title: 'Rastreador de Oportunidades',
  description: 'Veículos abaixo do FIPE · leilão · repasse · classificado',
};

export default function RootLayout({ children }) {
  return (
    <html lang="pt-BR">
      <body style={{ margin: 0 }}>
        <Nav />
        {children}
      </body>
    </html>
  );
}
