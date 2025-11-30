import { NextResponse } from 'next/server';

export async function GET(request: Request, { params }: { params: { id: string } }) {
  const { id } = params;
  // lógica para buscar serviço por id
  return NextResponse.json({ id, message: 'GET service by id' });
}

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  const { id } = params;
  const body = await request.json();
  // lógica para atualizar serviço por id usando body
  return NextResponse.json({ id, body, message: 'PATCH service by id' });
}

export async function DELETE(request: Request, { params }: { params: { id: string } }) {
  const { id } = params;
  // lógica para deletar serviço por id
  return NextResponse.json({ id, message: 'DELETE service by id' });
}
