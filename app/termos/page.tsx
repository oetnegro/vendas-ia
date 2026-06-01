import type { Metadata } from 'next'
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Termos de Uso | Vendas+IA',
  description:
    'Termos de uso e condições de serviço da Vendas+IA. Leia antes de utilizar nossa plataforma.',
  alternates: {
    canonical: 'https://www.vendasmaisia.com/termos',
  },
}

export default function Termos() {
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
        <h1 className="text-3xl font-bold text-slate-900 mb-2">Termos de Uso</h1>
        <p className="text-slate-500 text-sm mb-10">Última atualização: maio de 2026</p>

        <div className="prose prose-slate max-w-none space-y-8 text-slate-700 leading-relaxed">

          <section>
            <h2 className="text-xl font-bold text-slate-900 mb-3">1. Aceitação dos termos</h2>
            <p>
              Ao acessar ou utilizar a plataforma <strong>Vendas+IA</strong>, você concorda com estes Termos de Uso. Se não concordar com alguma das condições aqui descritas, não utilize nossos serviços.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-slate-900 mb-3">2. Sobre a plataforma</h2>
            <p>
              A <strong>Vendas+IA</strong> é uma plataforma de automação de pré-vendas via WhatsApp, desenvolvida pela empresa Lucas de Paula ME, com sede no Brasil. Oferecemos serviços de prospecção, qualificação de leads e agendamento de reuniões por meio de inteligência artificial.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-slate-900 mb-3">3. Uso permitido</h2>
            <p>Você concorda em utilizar a plataforma exclusivamente para fins legais e em conformidade com:</p>
            <ul className="list-disc pl-6 mt-3 space-y-1">
              <li>A legislação brasileira vigente</li>
              <li>As políticas de uso do WhatsApp Business (Meta)</li>
              <li>A Lei Geral de Proteção de Dados (LGPD — Lei nº 13.709/2018)</li>
              <li>As diretrizes de uso aceitável definidas pela Vendas+IA</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-bold text-slate-900 mb-3">4. Uso proibido</h2>
            <p>É expressamente proibido:</p>
            <ul className="list-disc pl-6 mt-3 space-y-1">
              <li>Utilizar a plataforma para envio de spam ou mensagens não autorizadas</li>
              <li>Violar direitos de privacidade de terceiros</li>
              <li>Tentar acessar sistemas ou dados sem autorização</li>
              <li>Revender ou sublicenciar o acesso à plataforma sem autorização prévia</li>
              <li>Utilizar os serviços para finalidades ilegais ou fraudulentas</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-bold text-slate-900 mb-3">5. Conta e responsabilidade</h2>
            <p>
              Você é responsável por manter a confidencialidade das suas credenciais de acesso e por todas as atividades realizadas em sua conta. Em caso de uso não autorizado, notifique-nos imediatamente pelo e-mail <strong>lucas@vendasmaisia.com</strong>.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-slate-900 mb-3">6. Propriedade intelectual</h2>
            <p>
              Todo o conteúdo da plataforma — incluindo textos, logotipos, código-fonte, interfaces e funcionalidades — é de propriedade exclusiva da Vendas+IA e protegido pelas leis de propriedade intelectual. É proibida a reprodução ou uso sem autorização prévia por escrito.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-slate-900 mb-3">7. Limitação de responsabilidade</h2>
            <p>
              A Vendas+IA não se responsabiliza por resultados comerciais específicos decorrentes do uso da plataforma, por interrupções de serviço causadas por terceiros (incluindo a Meta/WhatsApp), nem por danos indiretos ou consequentes relacionados ao uso dos serviços.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-slate-900 mb-3">8. Privacidade dos dados</h2>
            <p>
              O tratamento dos seus dados pessoais é regido pela nossa{' '}
              <Link href="/privacidade" className="text-yellow-600 hover:underline font-medium">
                Política de Privacidade
              </Link>
              , em conformidade com a LGPD.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-slate-900 mb-3">9. Alterações nos termos</h2>
            <p>
              Podemos atualizar estes Termos de Uso periodicamente. O uso continuado da plataforma após a publicação de alterações constitui aceitação dos novos termos. Recomendamos a revisão periódica desta página.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-slate-900 mb-3">10. Foro e legislação aplicável</h2>
            <p>
              Estes Termos são regidos pelas leis da República Federativa do Brasil. Fica eleito o foro da Comarca de São Paulo/SP para dirimir quaisquer controvérsias decorrentes deste instrumento.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-slate-900 mb-3">11. Contato</h2>
            <p>Em caso de dúvidas sobre estes termos:</p>
            <ul className="list-none mt-3 space-y-1">
              <li><strong>E-mail:</strong> lucas@vendasmaisia.com</li>
              <li><strong>WhatsApp:</strong> (11) 93623-0826</li>
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
