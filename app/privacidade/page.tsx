import type { Metadata } from 'next'
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Política de Privacidade | Vendas+IA',
  description:
    'Política de privacidade da Vendas+IA. Saiba como coletamos, usamos e protegemos seus dados em conformidade com a LGPD.',
  alternates: {
    canonical: 'https://www.vendasmaisia.com/privacidade',
  },
}

export default function Privacidade() {
  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <header className="bg-slate-900 py-6 px-4">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <span className="text-xl font-bold">
              <span className="text-white">Vendas</span>
              <span className="text-yellow-500">+</span>
              <span className="text-slate-300">IA</span>
            </span>
          </Link>
          <Link href="/" className="text-slate-400 hover:text-yellow-500 text-sm transition-colors">
            ← Voltar ao site
          </Link>
        </div>
      </header>

      {/* Content */}
      <main className="max-w-4xl mx-auto px-4 py-12">
        <h1 className="text-3xl font-bold text-slate-900 mb-2">Política de Privacidade</h1>
        <p className="text-slate-500 text-sm mb-10">Última atualização: março de 2026</p>

        <div className="prose prose-slate max-w-none space-y-8 text-slate-700 leading-relaxed">

          <section>
            <h2 className="text-xl font-bold text-slate-900 mb-3">1. Quem somos</h2>
            <p>
              A <strong>Vendas+IA</strong> é uma plataforma de automação de pré-vendas via WhatsApp, desenvolvida pela empresa Lucas de Paula ME, com sede no Brasil. Nosso site é <strong>vendasmaisia.com</strong>.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-slate-900 mb-3">2. Quais dados coletamos</h2>
            <p>Coletamos os seguintes dados quando você preenche nosso formulário de contato ou utiliza nossa plataforma:</p>
            <ul className="list-disc pl-6 mt-3 space-y-1">
              <li>Nome completo</li>
              <li>Endereço de e-mail</li>
              <li>Número de telefone / WhatsApp</li>
              <li>Nome da empresa</li>
              <li>Tamanho da equipe</li>
              <li>Informações sobre seu desafio comercial</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-bold text-slate-900 mb-3">3. Como usamos seus dados</h2>
            <p>Utilizamos seus dados para:</p>
            <ul className="list-disc pl-6 mt-3 space-y-1">
              <li>Entrar em contato para apresentar nossa solução</li>
              <li>Agendar demonstrações da plataforma</li>
              <li>Enviar informações relevantes sobre nossos serviços</li>
              <li>Melhorar nossos produtos e atendimento</li>
            </ul>
            <p className="mt-3">Não vendemos, alugamos ou compartilhamos seus dados com terceiros para fins comerciais.</p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-slate-900 mb-3">4. Armazenamento dos dados</h2>
            <p>
              Seus dados são armazenados de forma segura em nosso banco de dados (Supabase), hospedado nos Estados Unidos, com criptografia em trânsito e em repouso. Mantemos seus dados pelo tempo necessário para prestar nossos serviços ou conforme exigido por lei.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-slate-900 mb-3">5. Seus direitos (LGPD)</h2>
            <p>Em conformidade com a Lei Geral de Proteção de Dados (Lei nº 13.709/2018), você tem direito a:</p>
            <ul className="list-disc pl-6 mt-3 space-y-1">
              <li>Acessar seus dados pessoais que temos armazenados</li>
              <li>Corrigir dados incompletos ou desatualizados</li>
              <li>Solicitar a exclusão dos seus dados</li>
              <li>Revogar o consentimento a qualquer momento</li>
              <li>Solicitar portabilidade dos seus dados</li>
            </ul>
            <p className="mt-3">Para exercer qualquer um desses direitos, entre em contato pelo e-mail: <strong>lucas@vendasmaisia.com</strong></p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-slate-900 mb-3">6. Cookies</h2>
            <p>
              Nosso site pode utilizar cookies essenciais para o funcionamento correto da plataforma. Não utilizamos cookies de rastreamento ou publicidade de terceiros.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-slate-900 mb-3">7. Comunicações</h2>
            <p>
              Ao preencher nosso formulário, você concorda em receber comunicações da Vendas+IA relacionadas aos nossos serviços. Você pode cancelar o recebimento a qualquer momento entrando em contato conosco.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-slate-900 mb-3">8. Alterações nesta política</h2>
            <p>
              Podemos atualizar esta política periodicamente. Quando houver mudanças significativas, notificaremos você por e-mail ou por aviso em nosso site.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-slate-900 mb-3">9. Contato</h2>
            <p>Em caso de dúvidas sobre esta política ou sobre o tratamento dos seus dados:</p>
            <ul className="list-none mt-3 space-y-1">
              <li><strong>E-mail:</strong> lucas@vendasmaisia.com</li>
              <li><strong>WhatsApp:</strong> (11) 95213-4106</li>
              <li><strong>Site:</strong> vendasmaisia.com</li>
            </ul>
          </section>

        </div>
      </main>

      {/* Footer */}
      <footer className="bg-slate-900 py-6 px-4 mt-12">
        <div className="max-w-4xl mx-auto text-center text-slate-500 text-sm">
          © 2026 Vendas+IA. Todos os direitos reservados.
        </div>
      </footer>
    </div>
  );
}
