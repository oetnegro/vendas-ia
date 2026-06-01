import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { nome, email, telefone, empresa, tamanho_equipe, desafio } = body

    // Validação básica
    if (!nome || !email || !telefone || !empresa || !tamanho_equipe || !desafio) {
      return NextResponse.json(
        { error: 'Todos os campos são obrigatórios' },
        { status: 400 }
      )
    }

    // Salvar no Supabase
    const { data, error } = await supabase
      .from('leads_formulario')
      .insert([
        {
          nome,
          email,
          telefone,
          empresa,
          tamanho_equipe,
          desafio
        }
      ])
      .select()

    if (error) {
      console.error('Erro ao salvar no Supabase:', error)
      return NextResponse.json(
        { error: `Erro ao salvar os dados: ${error.message}` },
        { status: 500 }
      )
    }

    console.log('Lead salvo com sucesso:', data)

    // Enviar notificação por email via Resend (API gratuita)
    // Você pode configurar depois, por enquanto vou deixar preparado
    try {
      await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.RESEND_API_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          from: 'Vendas+IA <onboarding@resend.dev>',
          to: [process.env.NOTIFICATION_EMAIL || 'lucas@vendasmaisia.com'],
          subject: `🎯 Novo Lead: ${nome} - ${empresa}`,
          html: `
            <h2>Novo Lead Cadastrado!</h2>
            <p><strong>Nome:</strong> ${nome}</p>
            <p><strong>Email:</strong> ${email}</p>
            <p><strong>Telefone:</strong> ${telefone}</p>
            <p><strong>Empresa:</strong> ${empresa}</p>
            <p><strong>Tamanho da Equipe:</strong> ${tamanho_equipe}</p>
            <p><strong>Desafio:</strong> ${desafio}</p>
            <hr>
            <p><small>Enviado via vendasmaisia.com</small></p>
          `
        })
      })
    } catch (emailError) {
      console.error('Erro ao enviar email (não crítico):', emailError)
      // Não retorna erro porque o lead já foi salvo
    }

    return NextResponse.json(
      {
        success: true,
        message: 'Formulário enviado com sucesso!',
        data
      },
      { status: 200 }
    )

  } catch (error) {
    console.error('Erro geral:', error)
    return NextResponse.json(
      { error: 'Erro ao processar solicitação' },
      { status: 500 }
    )
  }
}
