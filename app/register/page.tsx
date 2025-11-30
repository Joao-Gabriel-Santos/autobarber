'use client';

import { useState } from 'react';

export default function RegisterPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [message, setMessage] = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setMessage('');

    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, full_name: fullName, phone }),
      });

      const data = await res.json();

      if (res.ok) {
        setMessage('Barbeiro cadastrado com sucesso!');
        setEmail('');
        setPassword('');
        setFullName('');
        setPhone('');
      } else {
        setMessage(`Erro: ${data.error || 'Falha no cadastro'}`);
      }
    } catch (error) {
      setMessage('Erro na conexão. Tente novamente.');
    }
  }

  return (
    <main style={{ maxWidth: 400, margin: '2rem auto', padding: '0 1rem' }}>
      <h1>Cadastrar Barbeiro</h1>
      <form onSubmit={handleSubmit}>

        <label>
          Email<br />
          <input
            type="email"
            value={email}
            required
            onChange={(e) => setEmail(e.target.value)}
            style={{ width: '100%', marginBottom: 10 }}
          />
        </label>

        <label>
          Senha<br />
          <input
            type="password"
            value={password}
            required
            minLength={6}
            onChange={(e) => setPassword(e.target.value)}
            style={{ width: '100%', marginBottom: 10 }}
          />
        </label>

        <label>
          Nome completo<br />
          <input
            type="text"
            value={fullName}
            required
            onChange={(e) => setFullName(e.target.value)}
            style={{ width: '100%', marginBottom: 10 }}
          />
        </label>

        <label>
          Telefone<br />
          <input
            type="tel"
            value={phone}
            required
            onChange={(e) => setPhone(e.target.value)}
            style={{ width: '100%', marginBottom: 10 }}
          />
        </label>

        <button type="submit" style={{ width: '100%', padding: '0.5rem' }}>
          Cadastrar
        </button>
      </form>

      {message && (
        <p style={{ marginTop: 10, fontWeight: 'bold' }}>
          {message}
        </p>
      )}
    </main>
  );
}
