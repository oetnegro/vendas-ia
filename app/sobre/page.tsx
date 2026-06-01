'use client'

import React from 'react';
import { MessageSquare, ArrowLeft, Linkedin, Mail, Target, Lightbulb, Users, Award } from 'lucide-react';
import { useRouter } from 'next/navigation';

export default function SobrePage() {
  const router = useRouter();

  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <nav className="bg-white shadow-md sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-20">
            <div className="flex items-center space-x-2">
              <MessageSquare className="w-8 h-8 text-yellow-500" />
              <span className="text-2xl font-bold">
                <span className="text-slate-800">Vendas</span>
                <span className="text-yellow-500">+</span>
                <span className="text-slate-600">IA</span>
              </span>
            </div>
            <button 
              onClick={() => router.push('/')}
              className="flex items-center gap-2 bg-yellow-500 hover:bg-yellow-600 text-slate-900 font-semibold px-6 py-3 rounded-lg transition-all duration-300 transform hover:scale-105"
            >
              <ArrowLeft className="w-5 h-5" />
              Voltar ao Site
            </button>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="py-20 px-4 sm:px-6 lg:px-8 bg-gradient-to-br from-slate-50 to-blue-50">
        <div className="max-w-4xl mx-auto text-center">
          <h1 className="text-4xl md:text-5xl font-bold text-slate-900 mb-6">
            Quem Somos
          </h1>
          <p className="text-xl text-slate-600 leading-relaxed">
            Desenvolvemos a primeira solução de IA para pré-vendas 100% em WhatsApp do Brasil
          </p>
        </div>
      </section>

      {/* Missão e Visão */}
      <section className="py-16 px-4 sm:px-6 lg:px-8 bg-white">
        <div className="max-w-6xl mx-auto">
          <div className="grid md:grid-cols-3 gap-8">
            {/* Missão */}
            <div className="bg-gradient-to-br from-yellow-50 to-yellow-100 rounded-2xl p-8 border-2 border-yellow-300">
              <div className="w-12 h-12 bg-yellow-500 rounded-xl flex items-center justify-center mb-4">
                <Target className="w-7 h-7 text-white" />
              </div>
              <h3 className="text-2xl font-bold text-slate-900 mb-3">Missão</h3>
              <p className="text-slate-700 leading-relaxed">
                Democratizar o acesso à inteligência artificial para equipes comerciais, 
                permitindo que empresas de qualquer porte tenham um time de pré-vendas 
                trabalhando 24/7.
              </p>
            </div>

            {/* Visão */}
            <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-2xl p-8 border-2 border-blue-300">
              <div className="w-12 h-12 bg-blue-500 rounded-xl flex items-center justify-center mb-4">
                <Lightbulb className="w-7 h-7 text-white" />
              </div>
              <h3 className="text-2xl font-bold text-slate-900 mb-3">Visão</h3>
              <p className="text-slate-700 leading-relaxed">
                Ser a principal plataforma de automação de pré-vendas via WhatsApp no Brasil, 
                reconhecida pela excelência em conversão e qualidade de relacionamento com leads.
              </p>
            </div>

            {/* Valores */}
            <div className="bg-gradient-to-br from-green-50 to-green-100 rounded-2xl p-8 border-2 border-green-300">
              <div className="w-12 h-12 bg-green-500 rounded-xl flex items-center justify-center mb-4">
                <Award className="w-7 h-7 text-white" />
              </div>
              <h3 className="text-2xl font-bold text-slate-900 mb-3">Valores</h3>
              <p className="text-slate-700 leading-relaxed">
                Inovação contínua, transparência com clientes, resultados mensuráveis, 
                e compromisso com a proteção de dados (LGPD).
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Nossa História */}
      <section className="py-16 px-4 sm:px-6 lg:px-8 bg-gradient-to-br from-slate-50 to-blue-50">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-3xl md:text-4xl font-bold text-slate-900 mb-8 text-center">
            Nossa História
          </h2>
          <div className="bg-white rounded-2xl p-8 shadow-xl border-2 border-slate-200">
            <p className="text-lg text-slate-700 leading-relaxed mb-6">
              A Vendas+IA nasceu da identificação de uma lacuna crítica no mercado brasileiro: 
              enquanto soluções internacionais de IA para pré-vendas focavam em e-mail, 
              <strong> no Brasil 95% da comunicação comercial acontece via WhatsApp</strong>.
            </p>
            <p className="text-lg text-slate-700 leading-relaxed mb-6">
              Desenvolvemos do zero uma plataforma que une <strong>API oficial do WhatsApp Business</strong>, 
              <strong> modelos de IA de última geração</strong> e <strong>CRM integrado</strong>, 
              criando a primeira solução completa de automação de pré-vendas via WhatsApp do país.
            </p>
            <p className="text-lg text-slate-700 leading-relaxed">
              Hoje ajudamos empresas B2B, agências e prestadores de serviço a escalarem suas operações 
              comerciais com <strong>redução de até 80% nos custos</strong> e <strong>disponibilidade 24/7</strong>.
            </p>
          </div>
        </div>
      </section>

      {/* Diferenciais Técnicos */}
      <section className="py-16 px-4 sm:px-6 lg:px-8 bg-white">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-3xl md:text-4xl font-bold text-slate-900 mb-12 text-center">
            Diferenciais Técnicos
          </h2>
          <div className="grid md:grid-cols-2 gap-8">
            <div className="bg-slate-50 rounded-xl p-6 border-2 border-slate-200">
              <h3 className="text-xl font-bold text-slate-900 mb-3 flex items-center gap-2">
                <span className="text-2xl">🇧🇷</span>
                WhatsApp-First
              </h3>
              <p className="text-slate-700 leading-relaxed">
                Única plataforma do mercado desenvolvida nativamente para WhatsApp usando API oficial da Meta. 
                Não adaptamos soluções de e-mail — construímos do zero para a realidade brasileira.
              </p>
            </div>

            <div className="bg-slate-50 rounded-xl p-6 border-2 border-slate-200">
              <h3 className="text-xl font-bold text-slate-900 mb-3 flex items-center gap-2">
                <span className="text-2xl">🤖</span>
                IA Contextual
              </h3>
              <p className="text-slate-700 leading-relaxed">
                Nossa IA não segue scripts rígidos. Ela analisa o sentimento do lead, adapta a abordagem 
                em tempo real e personaliza cada conversa baseada no histórico e perfil da empresa.
              </p>
            </div>

            <div className="bg-slate-50 rounded-xl p-6 border-2 border-slate-200">
              <h3 className="text-xl font-bold text-slate-900 mb-3 flex items-center gap-2">
                <span className="text-2xl">📊</span>
                CRM Integrado
              </h3>
              <p className="text-slate-700 leading-relaxed">
                Diferente de ferramentas que só fazem prospecção, oferecemos CRM completo com análise de 
                sentimento, scoring automático e funil de conversão em tempo real.
              </p>
            </div>

            <div className="bg-slate-50 rounded-xl p-6 border-2 border-slate-200">
              <h3 className="text-xl font-bold text-slate-900 mb-3 flex items-center gap-2">
                <span className="text-2xl">🔒</span>
                LGPD Nativo
              </h3>
              <p className="text-slate-700 leading-relaxed">
                Arquitetura desenvolvida desde o início com compliance total à LGPD. Dados armazenados 
                no Brasil, criptografia end-to-end e controles de privacidade por design.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Time - Lucas */}
      <section className="py-16 px-4 sm:px-6 lg:px-8 bg-gradient-to-br from-slate-900 to-slate-800 text-white">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-3xl md:text-4xl font-bold mb-12 text-center">
            Nosso Fundador
          </h2>
          
          <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-8 border-2 border-white/20">
            <div className="flex flex-col md:flex-row items-center md:items-start gap-8">
              {/* Foto */}
              <div className="flex-shrink-0">
                <div className="w-32 h-32 md:w-40 md:h-40 rounded-full bg-gradient-to-br from-yellow-400 to-yellow-600 p-1">
                  <div className="w-full h-full rounded-full bg-slate-800 flex items-center justify-center overflow-hidden">
                    <img 
                      src="/images/team-lucas.jpg" 
                      alt="Lucas de Paula"
                      className="w-full h-full object-cover"
                      onError={(e) => {
                        e.currentTarget.style.display = 'none';
                        e.currentTarget.parentElement!.innerHTML = '<span class="text-5xl text-yellow-400 font-bold">LP</span>';
                      }}
                    />
                  </div>
                </div>
              </div>

              {/* Info */}
              <div className="flex-1 text-center md:text-left">
                <h3 className="text-2xl md:text-3xl font-bold mb-2">Lucas de Paula</h3>
                <p className="text-yellow-400 font-semibold mb-4 text-lg">Founder & CEO</p>
                
                <p className="text-slate-200 leading-relaxed mb-6">
                  Empreendedor e desenvolvedor com experiência em automação comercial e inteligência artificial. 
                  Identificou a oportunidade de criar a primeira solução de IA para pré-vendas focada 100% em WhatsApp, 
                  desenvolvendo do zero toda a stack tecnológica que hoje atende empresas B2B em todo Brasil.
                </p>

                <div className="flex flex-wrap gap-4 justify-center md:justify-start">
                  <a 
                    href="https://www.linkedin.com/in/lucas-de-paula-b73a4496/" 
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold px-6 py-3 rounded-lg transition-all duration-300 transform hover:scale-105"
                  >
                    <Linkedin className="w-5 h-5" />
                    LinkedIn
                  </a>
                  <a 
                    href="mailto:lucas@vendasmaisia.com"
                    className="inline-flex items-center gap-2 bg-yellow-500 hover:bg-yellow-600 text-slate-900 font-semibold px-6 py-3 rounded-lg transition-all duration-300 transform hover:scale-105"
                  >
                    <Mail className="w-5 h-5" />
                    E-mail
                  </a>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Parceiro Meta */}
      <section className="py-16 px-4 sm:px-6 lg:px-8 bg-gradient-to-r from-blue-50 to-blue-100">
        <div className="max-w-4xl mx-auto text-center">
          <div className="bg-white rounded-2xl p-8 shadow-xl border-2 border-blue-300">
            <h2 className="text-3xl font-bold text-slate-900 mb-6">
              Parceiro Oficial Meta Business
            </h2>
            <p className="text-lg text-slate-700 leading-relaxed mb-6">
              Somos parceiros oficiais da Meta (Facebook/WhatsApp), utilizando a 
              <strong> API oficial do WhatsApp Business</strong> com todas as certificações 
              e garantias de segurança da plataforma.
            </p>
            <div className="inline-block bg-blue-50 border-2 border-blue-300 rounded-xl px-8 py-4">
              <p className="text-sm text-slate-600 font-semibold">✓ API Oficial Meta</p>
              <p className="text-sm text-slate-600 font-semibold">✓ Certificação de Segurança</p>
              <p className="text-sm text-slate-600 font-semibold">✓ Suporte Enterprise</p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Final */}
      <section className="py-20 px-4 sm:px-6 lg:px-8 bg-white">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-3xl md:text-4xl font-bold text-slate-900 mb-6">
            Pronto para Transformar sua Pré-Vendas?
          </h2>
          <p className="text-xl text-slate-600 mb-8">
            Junte-se às empresas que já automatizaram sua prospecção com IA
          </p>
          <button 
            onClick={() => router.push('/#contato')}
            className="bg-yellow-500 hover:bg-yellow-600 text-slate-900 font-bold px-12 py-4 rounded-xl text-lg transition-all duration-300 transform hover:scale-105 inline-flex items-center gap-2"
          >
            Solicitar Demonstração
            <MessageSquare className="w-6 h-6" />
          </button>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-slate-900 text-white py-8 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto text-center">
          <div className="flex items-center justify-center space-x-2 mb-4">
            <MessageSquare className="w-6 h-6 text-yellow-500" />
            <span className="text-xl font-bold">
              <span>Vendas</span>
              <span className="text-yellow-500">+</span>
              <span className="text-slate-300">IA</span>
            </span>
          </div>
          <p className="text-sm text-slate-400">
            © 2024 Vendas+IA. Todos os direitos reservados.
          </p>
        </div>
      </footer>
    </div>
  );
}