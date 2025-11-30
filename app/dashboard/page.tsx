import { getUser } from '@/lib/getUser';

export default async function Dashboard() {
  const user = await getUser();

  return (
    <div>
      <h1>Bem-vindo, {user?.email}</h1>
    </div>
  );
}
