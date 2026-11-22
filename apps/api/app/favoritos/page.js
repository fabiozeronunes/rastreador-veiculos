import { redirect } from 'next/navigation';

// /favoritos redireciona pra /?fav=1 (mantém tudo num lugar só)
export default function FavoritosPage() {
  redirect('/?fav=1');
}
