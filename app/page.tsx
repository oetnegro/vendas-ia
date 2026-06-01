'use client'

import React, { useState, useEffect } from 'react';
import { MessageSquare, Zap, CheckCircle, Mail, MapPin, ArrowRight, Target, BarChart3, Users, Calendar, Brain, TrendingUp, Star, Phone, Download, Sparkles, Tag, ChevronDown, ChevronUp } from 'lucide-react';

// CSS para animação
const styles = `
  @keyframes fadeIn {
    from {
      opacity: 0;
      transform: translateY(10px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }
  
  .animate-fade-in {
    animation: fadeIn 0.5s ease-out;
  }
`;

export default function VendasIALanding() {
  const [scrolled, setScrolled] = useState(false);
  const [teamSize, setTeamSize] = useState(2);
  const [crmCost, setCrmCost] = useState(300);
  const [heroTextIndex, setHeroTextIndex] = useState(0);
  const [fadeIn, setFadeIn] = useState(true);
  const [whatsappMessages, setWhatsappMessages] = useState<number[]>([]);
  const [isTyping, setIsTyping] = useState(false);
  const [openFaq, setOpenFaq] = useState<number | null>(null);
  const [formSubmitting, setFormSubmitting] = useState(false);
  const [formMessage, setFormMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);

  const heroTexts = [
    { 
      text: 'Reduza em até ', 
      highlight: '80%', 
      rest: ' dos custos em pré-vendas' 
    },
    { 
      text: 'Tenha dados ', 
      highlight: 'precisos', 
      rest: ' da sua área comercial' 
    },
    { 
      text: 'Prospecte ', 
      highlight: 'novos leads', 
      rest: ' todos os dias' 
    }
  ];

  const faqs = [
    {
      question: "O que é a VendasMaisIA?",
      answer: "A Vendas+IA é uma plataforma de IA para prospecção e pré-vendas B2B que substitui parte do trabalho operacional de SDRs e BDRs. Ela prospecta leads, conduz conversas pelo WhatsApp, qualifica oportunidades, agenda reuniões e registra tudo em um CRM próprio com dashboard em tempo real. A solução usa a API oficial do WhatsApp Business da Meta e foi criada para empresas que querem vender mais com previsibilidade, reduzindo custo comercial e aumentando a produtividade do time de vendas."
    },
    {
      question: "A VendasMaisIA é confiável?",
      answer: "Sim. A Vendas+IA utiliza a API oficial do WhatsApp Business, é Meta Business Partner e participa do Google for Startups, programas com critérios de seleção e validação técnica para empresas de tecnologia. Isso significa que a plataforma foi construída com foco em segurança, estabilidade e conformidade, evitando soluções improvisadas ou não oficiais que podem gerar bloqueios e riscos para a operação comercial."
    },
    {
      question: "Por que contratar uma IA e não um humano?",
      answer: "A Vendas+IA comprovou que sua IA de prospecção é significativamente mais produtiva que um SDR ou BDR tradicional. A Vendas+IA executa as mesmas funções — prospectar, qualificar, agendar reuniões e registrar informações no CRM — com um diferencial importante: análise de dados em tempo real. Nossa IA de pré-vendas entrega muito mais performance, insights estratégicos e dados estruturados do que um profissional humano conseguiria processar, permitindo que sua equipe tome decisões baseadas em inteligência real de mercado."
    },
    {
      question: "Qual a diferença entre IA SDR e IA BDR?",
      answer: "Na Vendas+IA, a IA BDR é responsável pela prospecção fria outbound e reativação de base de clientes inativos — realizando um trabalho mais complexo e estratégico com técnicas avançadas de vendas, análise de ICP e abordagens personalizadas por lead. Já a IA SDR da Vendas+IA foca na qualificação de leads inbound e nutrição de oportunidades aquecidas, garantindo que apenas os prospects mais qualificados cheguem ao time comercial."
    },
    {
      question: "Tenho risco de bloqueio no WhatsApp?",
      answer: "Não. A Vendas+IA utiliza exclusivamente a API oficial do WhatsApp Business, fornecida pela Meta — a mesma utilizada por grandes empresas globais. Isso garante máxima estabilidade, segurança e conformidade com todas as políticas da plataforma. Diferente de soluções não-oficiais que resultam em bloqueios, a infraestrutura da Vendas+IA proporciona automação de pré-vendas via WhatsApp com comunicação profissional e confiável, sem nenhum risco para sua operação."
    },
    {
      question: "Consigo gerar um número de prospecção com meu DDD?",
      answer: "Sim! A Vendas+IA gera números de prospecção com DDDs de todos os estados do Brasil. Você escolhe o DDD que melhor se adequa à sua estratégia comercial — seja para criar presença local em diferentes regiões ou fortalecer sua identidade regional. Isso aumenta significativamente as taxas de resposta na automação de prospecção via WhatsApp, pois os leads tendem a confiar mais em números da própria região."
    },
    {
      question: "Qual a diferença da IA para um chatbot comum?",
      answer: "Chatbots comuns não são inteligentes — seguem scripts rígidos e pré-programados que violam políticas do WhatsApp, resultando em bloqueios e queda nas taxas de resposta. A IA da Vendas+IA é completamente diferente: contextual e adaptativa, ela analisa o sentimento do lead, personaliza cada conversa, aprende com as interações e ajusta a abordagem em tempo real — garantindo conversas naturais de pré-vendas que realmente convertem, sem risco de bloqueio."
    },
    {
      question: "Integra com outros CRMs?",
      answer: "Sim! A Vendas+IA integra nativamente com os principais CRMs do mercado: HubSpot, Salesforce, Pipedrive e RD Station. Todos os dados de prospecção, qualificação de leads, interações e agendamentos são sincronizados automaticamente — garantindo visibilidade total do funil de pré-vendas e facilitando o trabalho do time comercial sem nenhuma entrada manual de dados."
    }
  ];

  const faqSchema = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: faqs.map((faq) => ({
      '@type': 'Question',
      name: faq.question,
      acceptedAnswer: {
        '@type': 'Answer',
        text: faq.answer,
      },
    })),
  };

  const softwareSchema = {
    '@context': 'https://schema.org',
    '@type': 'SoftwareApplication',
    name: 'Vendas+IA',
    applicationCategory: 'BusinessApplication',
    operatingSystem: 'Web, WhatsApp',
    description:
      'IA de prospecção e pré-vendas via WhatsApp com CRM integrado. Prospecta, qualifica leads e agenda reuniões 24/7, substituindo SDRs tradicionais.',
    offers: {
      '@type': 'Offer',
      price: '599',
      priceCurrency: 'BRL',
      priceValidUntil: '2026-12-31',
      priceSpecification: {
        '@type': 'UnitPriceSpecification',
        price: '599',
        priceCurrency: 'BRL',
        unitText: 'mês',
      },
    },
    url: 'https://www.vendasmaisia.com/',
  };

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 50);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  useEffect(() => {
    const interval = setInterval(() => {
      setFadeIn(false);
      
      setTimeout(() => {
        setHeroTextIndex((prev) => (prev + 1) % heroTexts.length);
        setFadeIn(true);
      }, 500);
      
    }, 4000);

    return () => clearInterval(interval);
  }, []);

  // Animação automática da conversa WhatsApp
  useEffect(() => {
    const messageTimings = [
      { delay: 1000, duration: 1500 }, // Mensagem 0: IA inicial
      { delay: 2000, duration: 2000 }, // Mensagem 1: IA pergunta interesse
      { delay: 1500, duration: 1000 }, // Mensagem 2: Lead responde
      { delay: 2000, duration: 2500 }, // Mensagem 3: IA explica + pergunta
      { delay: 1500, duration: 800 },  // Mensagem 4: Lead "pode perguntar"
      { delay: 1500, duration: 1200 }, // Mensagem 5: IA pergunta time
      { delay: 1800, duration: 1000 }, // Mensagem 6: Lead "3 pessoas"
      { delay: 2500, duration: 2800 }, // Mensagem 7: IA ROI + propõe demo
      { delay: 1500, duration: 1200 }, // Mensagem 8: Lead aceita
      { delay: 2000, duration: 2000 }, // Mensagem 9: IA agenda reunião
    ];

    let currentTimeout: NodeJS.Timeout;
    let cumulativeDelay = 0;

    messageTimings.forEach((timing, index) => {
      cumulativeDelay += timing.delay;
      
      // Mostra indicador "digitando..."
      currentTimeout = setTimeout(() => {
        setIsTyping(true);
      }, cumulativeDelay);

      // Mostra mensagem após delay de digitação
      cumulativeDelay += timing.duration;
      currentTimeout = setTimeout(() => {
        setIsTyping(false);
        setWhatsappMessages(prev => [...prev, index]);

        // Scroll automático para o final
        setTimeout(() => {
          const chatContainer = document.getElementById('whatsapp-chat');
          if (chatContainer) {
            chatContainer.scrollTop = chatContainer.scrollHeight;
          }
        }, 100);
      }, cumulativeDelay);
    });

    return () => clearTimeout(currentTimeout);
  }, []);

  const scrollToSection = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });
  };

  const openWhatsApp = () => {
    window.open('https://wa.me/5511936230826', '_blank');
  };

  const formatPhoneNumber = (value: string) => {
    // Remove tudo que não é número
    const numbers = value.replace(/\D/g, '');

    // Aplica a máscara (11) 99999-9999
    if (numbers.length <= 2) {
      return numbers;
    } else if (numbers.length <= 7) {
      return `(${numbers.slice(0, 2)}) ${numbers.slice(2)}`;
    } else if (numbers.length <= 11) {
      return `(${numbers.slice(0, 2)}) ${numbers.slice(2, 7)}-${numbers.slice(7, 11)}`;
    } else {
      // Limita a 11 dígitos
      return `(${numbers.slice(0, 2)}) ${numbers.slice(2, 7)}-${numbers.slice(7, 11)}`;
    }
  };

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = formatPhoneNumber(e.target.value);
    e.target.value = formatted;
  };

  const custoTradicional = teamSize * 4000 + crmCost;
  
  const getCustoVendasIA = () => {
    if (teamSize <= 1) return 599;
    if (teamSize <= 3) return 999;
    if (teamSize <= 5) return 1800;
    return null;
  };
  
  const custoVendasIA = getCustoVendasIA();
  const economia = custoVendasIA ? custoTradicional - custoVendasIA : 0;
  const economiaPercentual = custoVendasIA ? ((economia / custoTradicional) * 100).toFixed(0) : '80+';
  
  const getPlanoRecomendado = () => {
    if (teamSize <= 1) return { nome: "Starter", preco: 599, leads: 300 };
    if (teamSize <= 3) return { nome: "Pro", preco: 999, leads: 600 };
    if (teamSize <= 5) return { nome: "Growth", preco: 1800, leads: 1200 };
    return { nome: "Enterprise", preco: "Negociável", leads: "3000+" };
  };
  
  const planoRecomendado = getPlanoRecomendado();

  const handleFormSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setFormSubmitting(true);
    setFormMessage(null);

    // Guardar referência do form antes da chamada async
    const form = e.currentTarget;

    const formData = new FormData(form);
    const data = {
      nome: formData.get('nome') as string,
      email: formData.get('email') as string,
      telefone: formData.get('telefone') as string,
      empresa: formData.get('empresa') as string,
      tamanho_equipe: formData.get('tamanho_equipe') as string,
      desafio: formData.get('desafio') as string,
    };

    try {
      const response = await fetch('/api/contato', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      });

      const result = await response.json();

      console.log('Resposta da API:', response.status, result);

      if (response.ok && result.success) {
        setFormMessage({
          type: 'success',
          text: '🎉 Obrigado! Recebemos sua solicitação e nossa equipe entrará em contato em breve.'
        });
        form.reset();

        // Scroll suave para a mensagem
        setTimeout(() => {
          document.getElementById('contato')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }, 100);
      } else {
        setFormMessage({
          type: 'error',
          text: result.error || '❌ Erro ao enviar formulário. Tente novamente.'
        });
      }
    } catch (error) {
      console.error('Erro no fetch:', error);
      setFormMessage({
        type: 'error',
        text: '❌ Erro ao enviar formulário. Tente novamente.'
      });
    } finally {
      setFormSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-white overflow-x-hidden">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(softwareSchema) }}
      />
      <style dangerouslySetInnerHTML={{ __html: styles }} />
      
      {/* Navbar */}
      <nav className={`fixed w-full z-50 transition-all duration-300 ${scrolled ? 'bg-white shadow-md' : 'bg-transparent'}`}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-20 gap-2 sm:gap-4">
            <div className="flex items-center gap-3 sm:gap-4 flex-shrink-0">
              <div className="flex items-center space-x-2">
                <MessageSquare className="w-6 h-6 sm:w-8 sm:h-8 text-yellow-500" />
                <span className="text-lg sm:text-2xl font-bold whitespace-nowrap">
                  <span className="text-slate-800">Vendas</span>
                  <span className="text-yellow-500">+</span>
                  <span className="text-slate-600">IA</span>
                </span>
              </div>
              <a
                href="https://startup.google.com/intl/pt-BR/about-us/"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center border-l border-slate-200 pl-2 sm:pl-4 opacity-80 hover:opacity-100 transition-opacity"
                title="Participante do Google for Startups"
              >
                <img
                  src="/google-startups-logo.jpg"
                  alt="Vendas+IA — IA de prospecção B2B selecionada pelo Google for Startups"
                  className="h-4 sm:h-6 w-auto"
                />
              </a>
            </div>
            <div className="flex items-center gap-1.5 sm:gap-3 flex-shrink-0">
              <button
                onClick={openWhatsApp}
                className="bg-yellow-500 hover:bg-yellow-600 text-slate-900 font-semibold px-3 sm:px-6 py-2 sm:py-3 rounded-lg transition-all duration-300 text-xs sm:text-base whitespace-nowrap"
              >
                Solicitar Demo
              </button>
            </div>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="pt-32 pb-20 px-4 sm:px-6 lg:px-8 bg-gradient-to-br from-slate-50 to-blue-50">
        <div className="max-w-7xl mx-auto">
          <div className="grid md:grid-cols-2 gap-12 items-center">
            <div className="space-y-8">
              <div className="inline-block">
                <span className="bg-yellow-100 text-yellow-800 px-4 py-2 rounded-full text-sm font-semibold">
                  Solução de IA para a área de pré-vendas
                </span>
              </div>
              <h1 className="text-4xl sm:text-5xl md:text-6xl font-bold text-slate-900 leading-tight">
                IA de Prospecção para Pré-Vendas via WhatsApp
              </h1>
              <p className="text-2xl sm:text-3xl font-semibold text-slate-900 leading-tight min-h-[72px] md:min-h-[86px] flex items-center">
                <span 
                  className={`transition-all duration-500 ${
                    fadeIn ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-4'
                  }`}
                >
                  {heroTexts[heroTextIndex].text}
                  <span className="text-yellow-500">{heroTexts[heroTextIndex].highlight}</span>
                  {heroTexts[heroTextIndex].rest}
                </span>
              </p>
              <p className="text-lg sm:text-xl text-slate-600 leading-relaxed">
                A Vendas+IA é a plataforma completa com CRM, dashboard em tempo real e prospecção via WhatsApp.
                Qualifique leads, agende reuniões e analise dados automaticamente com a IA de pré-vendas B2B mais completa do Brasil.
              </p>
              <div className="flex flex-col sm:flex-row gap-4">
                <button 
                  onClick={() => scrollToSection('contato')}
                  className="bg-slate-900 hover:bg-slate-800 text-white font-semibold px-8 py-4 rounded-lg transition-all duration-300 transform hover:scale-105 flex items-center justify-center"
                >
                  Solicitar Demo
                  <Zap className="ml-2 w-5 h-5" />
                </button>
                <button 
                  onClick={() => scrollToSection('features')}
                  className="border-2 border-slate-900 text-slate-900 hover:bg-slate-900 hover:text-white font-semibold px-8 py-4 rounded-lg transition-all duration-300"
                >
                  Ver Funcionalidades
                </button>
              </div>
              <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 sm:gap-6 pt-4">
                <div className="flex items-center">
                  <CheckCircle className="w-5 h-5 text-green-500 mr-2 flex-shrink-0" />
                  <span className="text-slate-600">Ativação em 7 dias</span>
                </div>
                <div className="flex items-center">
                  <CheckCircle className="w-5 h-5 text-green-500 mr-2 flex-shrink-0" />
                  <span className="text-slate-600">Sem fidelidade</span>
                </div>
              </div>
            </div>
            <div className="relative">
              <div className="bg-gradient-to-br from-yellow-400 to-yellow-500 rounded-2xl md:rounded-3xl p-6 md:p-8 shadow-2xl transform rotate-3 hover:rotate-0 transition-transform duration-300">
                <div className="bg-white rounded-xl md:rounded-2xl p-4 md:p-6 transform -rotate-3">
                  <MessageSquare className="w-12 h-12 md:w-16 md:h-16 text-yellow-500 mb-3 md:mb-4" />
                  <h3 className="text-xl md:text-2xl font-bold text-slate-900 mb-2">Colaborador Virtual</h3>
                  <p className="text-sm md:text-base text-slate-600 mb-3 md:mb-4">Prospectando agora mesmo...</p>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between bg-slate-50 p-2.5 md:p-3 rounded-lg">
                      <span className="text-xs md:text-sm text-slate-600">Leads contatados hoje</span>
                      <span className="font-bold text-green-600 text-lg md:text-xl">187</span>
                    </div>
                    <div className="flex items-center justify-between bg-slate-50 p-2.5 md:p-3 rounded-lg">
                      <span className="text-xs md:text-sm text-slate-600">Reuniões agendadas</span>
                      <span className="font-bold text-blue-600 text-lg md:text-xl">8</span>
                    </div>
                    <div className="flex items-center justify-between bg-slate-50 p-2.5 md:p-3 rounded-lg">
                      <span className="text-xs md:text-sm text-slate-600">IA Ativa</span>
                      <span className="font-bold text-purple-600 text-lg md:text-xl">✓</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
{/* VÍDEO DEMO - Otimizado UX/UI */}
<section className="py-20 px-4 sm:px-6 lg:px-8 bg-gradient-to-br from-white to-slate-50">
  <div className="max-w-6xl mx-auto">
    
    {/* Header */}
    <div className="text-center mb-12">
      <span className="bg-yellow-100 text-yellow-800 px-4 py-2 rounded-full text-sm font-bold inline-block mb-4 animate-pulse">
        🎥 DEMONSTRAÇÃO DA PLATAFORMA
      </span>
      <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold text-slate-900 mb-4">
        Veja a IA em Ação
      </h2>
      <p className="text-lg sm:text-xl text-slate-600 max-w-3xl mx-auto">
        Assista como nossa IA prospecta, qualifica e agenda reuniões automaticamente via WhatsApp
      </p>
    </div>
    
    {/* Player Container */}
    <div className="relative">
      
      {/* Decorative elements */}
      <div className="absolute -inset-1 bg-gradient-to-r from-yellow-500 to-yellow-600 rounded-2xl blur opacity-25"></div>
      
      {/* Video */}
      <div className="relative rounded-2xl overflow-hidden shadow-2xl border-4 border-white bg-slate-900">
        <div className="aspect-video">
          <iframe
            className="w-full h-full"
            src="https://www.youtube.com/embed/kf3KA44VmS8"
            title="Vendas+IA - Demonstração da Plataforma"
            frameBorder="0"
            loading="lazy"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
            allowFullScreen
          />
        </div>
      </div>
    </div>
    
    {/* Features do Vídeo */}
    <div className="grid sm:grid-cols-3 gap-6 mt-12">
      <div className="text-center p-6 bg-white rounded-xl shadow-sm border border-slate-100">
        <div className="w-12 h-12 bg-yellow-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <svg className="w-6 h-6 text-yellow-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
          </svg>
        </div>
        <h3 className="font-semibold text-slate-900 mb-2">Prospecção via WhatsApp</h3>
        <p className="text-sm text-slate-600">A Vendas+IA conversa e qualifica leads automaticamente</p>
      </div>
      
      <div className="text-center p-6 bg-white rounded-xl shadow-sm border border-slate-100">
        <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <svg className="w-6 h-6 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
          </svg>
        </div>
        <h3 className="font-semibold text-slate-900 mb-2">Dashboard em Tempo Real</h3>
        <p className="text-sm text-slate-600">Acompanhe métricas e funil de pré-vendas ao vivo com a Vendas+IA</p>
      </div>
      
      <div className="text-center p-6 bg-white rounded-xl shadow-sm border border-slate-100">
        <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <svg className="w-6 h-6 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
        </div>
        <h3 className="font-semibold text-slate-900 mb-2">Agendamento Automático</h3>
        <p className="text-sm text-slate-600">Reuniões marcadas direto no Google Calendar</p>
      </div>
    </div>
    
    {/* CTA */}
    <div className="text-center mt-12">
      <button 
        onClick={() => scrollToSection('contato')}
        className="bg-yellow-500 hover:bg-yellow-600 text-slate-900 font-bold px-8 py-4 rounded-lg transition-all duration-300 transform hover:scale-105 shadow-lg hover:shadow-xl inline-flex items-center"
      >
        Quero Testar a Plataforma
        <ArrowRight className="ml-2 w-5 h-5" />
      </button>
      <p className="text-sm text-slate-500 mt-4">
        Ativação em 7 dias • Setup R$ 999 • Sem fidelidade
      </p>
    </div>
    
  </div>
</section>
      {/* Stats Bar */}
      <section className="py-16 bg-slate-900">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 sm:gap-8 text-center">
            <div>
              <div className="text-3xl sm:text-4xl font-bold text-yellow-500 mb-2">80%</div>
              <div className="text-slate-300 text-sm sm:text-base">Redução de custos</div>
            </div>
            <div>
              <div className="text-3xl sm:text-4xl font-bold text-yellow-500 mb-2">24/7</div>
              <div className="text-slate-300 text-sm sm:text-base">Operação contínua</div>
            </div>
            <div>
              <div className="text-3xl sm:text-4xl font-bold text-yellow-500 mb-2">7 dias</div>
              <div className="text-slate-300 text-sm sm:text-base">Para ativação</div>
            </div>
            <div>
              <div className="text-3xl sm:text-4xl font-bold text-yellow-500 mb-2">R$599</div>
              <div className="text-slate-300 text-sm sm:text-base">A partir de</div>
            </div>
          </div>
        </div>
      </section>

      {/* Meta Business Partner Badge - SIMPLIFICADO */}
      <section className="py-24 px-4 sm:px-6 lg:px-8 bg-gradient-to-br from-blue-50 to-white">
        <div className="max-w-7xl mx-auto text-center">
          <h2 className="text-2xl sm:text-3xl font-bold text-slate-900 mb-4">
            API Oficial WhatsApp
          </h2>
          <p className="text-base sm:text-lg text-slate-600 mb-8">
            Parceiro Oficial Meta Business
          </p>
          
          <div className="flex justify-center">
            <div className="w-64 h-64 sm:w-80 sm:h-80 bg-white rounded-3xl border-4 border-blue-400 shadow-2xl hover:shadow-3xl transition-all duration-300 transform hover:scale-105 overflow-hidden flex items-center justify-center p-8 sm:p-12">
              <img 
                src="/images/meta-partner-logo.jpg"
                alt="Vendas+IA é Meta Business Partner — usa a API oficial do WhatsApp Business"
                className="w-full h-full object-contain hover:scale-110 transition-transform duration-500"
                onError={(e) => {
                  e.currentTarget.style.display = 'none';
                  const parent = e.currentTarget.parentElement;
                  if (parent) {
                    parent.innerHTML = '<div class="w-full h-full flex flex-col items-center justify-center"><span class="text-6xl sm:text-8xl font-black text-blue-700">META</span><span class="text-xl sm:text-2xl font-bold text-blue-600 mt-4">BUSINESS PARTNER</span></div>';
                  }
                }}
              />
            </div>
          </div>
        </div>
      </section>

      {/* PAINÉIS VISUAIS DA PLATAFORMA */}
      <section id="features" className="py-20 px-4 sm:px-6 lg:px-8 bg-white">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-bold text-slate-900 mb-4">
              Plataforma Completa de Pré-Vendas
            </h2>
            <p className="text-xl text-slate-600 max-w-3xl mx-auto">
              Veja como funciona cada módulo da nossa plataforma em produção
            </p>
          </div>

          <div className="space-y-20">
            {/* Painel 1: PROSPECÇÃO WHATSAPP - PRINCIPAL FUNCIONALIDADE */}
            <div className="grid md:grid-cols-2 gap-12 items-center">
              <div>
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-12 h-12 bg-green-100 rounded-xl flex items-center justify-center">
                    <MessageSquare className="w-7 h-7 text-green-600" />
                  </div>
                  <div>
                    <h3 className="text-3xl font-bold text-slate-900">Prospecção via WhatsApp</h3>
                    <span className="inline-block bg-yellow-100 text-yellow-800 px-3 py-1 rounded-full text-xs font-bold mt-2">
                      🚀 FUNCIONALIDADE PRINCIPAL
                    </span>
                  </div>
                </div>
                <p className="text-lg text-slate-700 mb-6 leading-relaxed">
                  Nossa IA inicia conversas no WhatsApp, qualifica leads, responde objeções e agenda reuniões 
                  automaticamente. Veja como ela prospecta em tempo real com linguagem natural e inteligente.
                </p>
                <ul className="space-y-3">
                  <li className="flex items-start gap-2">
                    <CheckCircle className="w-5 h-5 text-green-500 mt-0.5 flex-shrink-0" />
                    <span className="text-slate-700">Inicia conversas automaticamente via WhatsApp</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle className="w-5 h-5 text-green-500 mt-0.5 flex-shrink-0" />
                    <span className="text-slate-700">Qualifica leads com perguntas inteligentes</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle className="w-5 h-5 text-green-500 mt-0.5 flex-shrink-0" />
                    <span className="text-slate-700">Responde objeções em linguagem natural</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle className="w-5 h-5 text-green-500 mt-0.5 flex-shrink-0" />
                    <span className="text-slate-700">Agenda reuniões automaticamente no Google Calendar</span>
                  </li>
                </ul>
              </div>

              {/* Mockup Prospecção WhatsApp ANIMADO */}
              <div className="bg-gradient-to-br from-green-600 to-green-700 rounded-2xl p-4 md:p-6 shadow-2xl border-2 md:border-4 border-green-500 h-[500px] md:h-[600px] flex flex-col">
                <div className="bg-white rounded-xl p-3 md:p-5 flex flex-col h-full overflow-hidden">
                  {/* Header WhatsApp */}
                  <div className="bg-green-600 rounded-t-xl -mx-3 md:-mx-5 -mt-3 md:-mt-5 px-3 md:px-4 py-2.5 md:py-3 mb-3 md:mb-4 flex-shrink-0">
                    <div className="flex items-center gap-2 md:gap-3">
                      <div className="w-8 h-8 md:w-10 md:h-10 bg-white rounded-full flex items-center justify-center flex-shrink-0 overflow-hidden">
                        <img
                          src="/images/ana-paula-avatar.jpg"
                          alt="Ana Paula — IA SDR de prospecção da Vendas+IA"
                          className="w-full h-full object-cover"
                        />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-white font-bold text-xs md:text-sm truncate">Ana Paula - IA Vendas+</p>
                        <p className="text-green-100 text-xs">online</p>
                      </div>
                    </div>
                  </div>

                  {/* Conversa Animada com scroll */}
                  <div id="whatsapp-chat" className="space-y-2 md:space-y-3 flex-1 overflow-y-auto scroll-smooth"
                    style={{
                      scrollbarWidth: 'thin',
                      scrollbarColor: '#cbd5e1 #f1f5f9'
                    }}>
                    {/* Mensagem 0: IA Olá */}
                    {whatsappMessages.includes(0) && (
                      <div className="flex items-start gap-1 md:gap-2 animate-fade-in">
                        <div className="bg-slate-100 rounded-lg p-2 md:p-3 max-w-[90%] md:max-w-[85%]">
                          <p className="text-xs md:text-sm text-slate-900">
                            Olá! Sou a Ana Paula, assistente de pré-vendas da Vendas+IA. 👋
                          </p>
                          <p className="text-xs text-slate-500 mt-1">09:15</p>
                        </div>
                      </div>
                    )}

                    {/* Mensagem 1: IA Pergunta interesse */}
                    {whatsappMessages.includes(1) && (
                      <div className="flex items-start gap-1 md:gap-2 animate-fade-in">
                        <div className="bg-slate-100 rounded-lg p-2 md:p-3 max-w-[90%] md:max-w-[85%]">
                          <p className="text-xs md:text-sm text-slate-900">
                            Vi que você é da <strong>Tech Solutions</strong>. Ajudamos empresas como a sua a 
                            reduzir em até 80% os custos de pré-vendas com IA. Teria interesse em saber mais?
                          </p>
                          <p className="text-xs text-slate-500 mt-1">09:15</p>
                        </div>
                      </div>
                    )}

                    {/* Mensagem 2: Lead responde */}
                    {whatsappMessages.includes(2) && (
                      <div className="flex items-end gap-1 md:gap-2 justify-end animate-fade-in">
                        <div className="bg-green-100 rounded-lg p-2 md:p-3 max-w-[90%] md:max-w-[85%]">
                          <p className="text-xs md:text-sm text-slate-900">
                            Oi! Sim, me interessou. Como funciona?
                          </p>
                          <p className="text-xs text-slate-500 mt-1 text-right">09:17</p>
                        </div>
                      </div>
                    )}

                    {/* Mensagem 3: IA Explica */}
                    {whatsappMessages.includes(3) && (
                      <div className="flex items-start gap-1 md:gap-2 animate-fade-in">
                        <div className="bg-slate-100 rounded-lg p-2 md:p-3 max-w-[90%] md:max-w-[85%]">
                          <p className="text-xs md:text-sm text-slate-900">
                            Perfeito! Nossa IA faz o trabalho de um time de SDRs, prospectando via WhatsApp 24/7. 📊
                          </p>
                          <p className="text-xs md:text-sm text-slate-900 mt-2">
                            Posso fazer algumas perguntas rápidas para entender melhor suas necessidades?
                          </p>
                          <p className="text-xs text-slate-500 mt-1">09:17</p>
                        </div>
                      </div>
                    )}

                    {/* Mensagem 4: Lead aceita */}
                    {whatsappMessages.includes(4) && (
                      <div className="flex items-end gap-1 md:gap-2 justify-end animate-fade-in">
                        <div className="bg-green-100 rounded-lg p-2 md:p-3 max-w-[90%] md:max-w-[85%]">
                          <p className="text-xs md:text-sm text-slate-900">
                            Claro, pode perguntar!
                          </p>
                          <p className="text-xs text-slate-500 mt-1 text-right">09:18</p>
                        </div>
                      </div>
                    )}

                    {/* Mensagem 5: IA Pergunta time */}
                    {whatsappMessages.includes(5) && (
                      <div className="flex items-start gap-1 md:gap-2 animate-fade-in">
                        <div className="bg-slate-100 rounded-lg p-2 md:p-3 max-w-[90%] md:max-w-[85%]">
                          <p className="text-xs md:text-sm text-slate-900">
                            Ótimo! Quantas pessoas você tem no time comercial atualmente?
                          </p>
                          <p className="text-xs text-slate-500 mt-1">09:18</p>
                        </div>
                      </div>
                    )}

                    {/* Mensagem 6: Lead responde 3 */}
                    {whatsappMessages.includes(6) && (
                      <div className="flex items-end gap-1 md:gap-2 justify-end animate-fade-in">
                        <div className="bg-green-100 rounded-lg p-2 md:p-3 max-w-[90%] md:max-w-[85%]">
                          <p className="text-xs md:text-sm text-slate-900">
                            Temos 3 pessoas em pré-vendas
                          </p>
                          <p className="text-xs text-slate-500 mt-1 text-right">09:19</p>
                        </div>
                      </div>
                    )}

                    {/* Mensagem 7: IA ROI */}
                    {whatsappMessages.includes(7) && (
                      <div className="flex items-start gap-1 md:gap-2 animate-fade-in">
                        <div className="bg-slate-100 rounded-lg p-2 md:p-3 max-w-[90%] md:max-w-[85%]">
                          <p className="text-xs md:text-sm text-slate-900">
                            Entendi! Com 3 pessoas, vocês gastam cerca de R$ 12.000/mês só com salários. 
                            Nossa solução custa R$ 1.800/mês e trabalha 24/7. 💰
                          </p>
                          <p className="text-xs md:text-sm text-slate-900 mt-2">
                            Que tal agendar uma demo de 15min para ver a plataforma funcionando?
                          </p>
                          <p className="text-xs text-slate-500 mt-1">09:19</p>
                        </div>
                      </div>
                    )}

                    {/* Mensagem 8: Lead aceita demo */}
                    {whatsappMessages.includes(8) && (
                      <div className="flex items-end gap-1 md:gap-2 justify-end animate-fade-in">
                        <div className="bg-green-100 rounded-lg p-2 md:p-3 max-w-[90%] md:max-w-[85%]">
                          <p className="text-xs md:text-sm text-slate-900">
                            Sim! Quando você tem disponível?
                          </p>
                          <p className="text-xs text-slate-500 mt-1 text-right">09:20</p>
                        </div>
                      </div>
                    )}

                    {/* Mensagem 9: IA Agendamento */}
                    {whatsappMessages.includes(9) && (
                      <div className="flex items-start gap-1 md:gap-2 animate-fade-in">
                        <div className="bg-blue-50 border-2 border-blue-300 rounded-lg p-2 md:p-3 max-w-[90%] md:max-w-[85%]">
                          <p className="text-xs md:text-sm font-bold text-blue-900 mb-1 md:mb-2">📅 Reunião Agendada!</p>
                          <p className="text-xs md:text-sm text-slate-900">
                            <strong>Segunda, 30/12 às 14h</strong><br/>
                            Link do Meet enviado por email ✓
                          </p>
                          <p className="text-xs text-slate-500 mt-1">09:21</p>
                        </div>
                      </div>
                    )}

                    {/* Indicador "digitando..." */}
                    {isTyping && (
                      <div className="flex items-start gap-1 md:gap-2">
                        <div className="bg-slate-100 rounded-lg px-4 py-3">
                          <div className="flex items-center gap-1">
                            <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{animationDelay: '0ms'}}></div>
                            <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{animationDelay: '150ms'}}></div>
                            <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{animationDelay: '300ms'}}></div>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Input WhatsApp */}
                  <div className="mt-3 md:mt-4 pt-2 md:pt-3 border-t-2 border-slate-200">
                    <div className="flex items-center gap-2 bg-slate-100 rounded-full px-3 md:px-4 py-1.5 md:py-2">
                      <span className="text-slate-400 text-xs md:text-sm">Digite uma mensagem...</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Painel 2: CRM (960 leads) */}
            <div className="grid md:grid-cols-2 gap-12 items-center">
              {/* Mockup CRM */}
              <div className="bg-gradient-to-br from-yellow-500 to-yellow-600 rounded-2xl p-3 md:p-6 shadow-2xl border-4 border-yellow-400 order-2 md:order-1">
                <div className="bg-white rounded-xl p-3 md:p-5">
                  <div className="mb-4">
                    <h4 className="text-lg md:text-2xl font-bold text-slate-900 mb-1">CRM - Gestão de Leads</h4>
                    <p className="text-xs md:text-sm text-slate-600">Visualize e gerencie todos os seus contatos</p>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 mb-4">
                    <div>
                      <label className="text-xs text-slate-600 block mb-1">Buscar</label>
                      <input 
                        type="text" 
                        placeholder="Nome, email..."
                        className="w-full px-3 py-1.5 border-2 border-slate-300 rounded-lg text-xs"
                        disabled
                      />
                    </div>
                    <div>
                      <label className="text-xs text-slate-600 block mb-1">Estágio</label>
                      <select className="w-full px-3 py-1.5 border-2 border-slate-300 rounded-lg text-xs" disabled>
                        <option>Todos</option>
                      </select>
                    </div>
                    <div>
                      <label className="text-xs text-slate-600 block mb-1">Tag</label>
                      <select className="w-full px-3 py-1.5 border-2 border-slate-300 rounded-lg text-xs" disabled>
                        <option>Todas as Tags</option>
                      </select>
                    </div>
                  </div>

                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 mb-4">
                    <div className="flex gap-2 flex-wrap">
                      <button className="px-2 sm:px-3 py-1.5 bg-slate-100 border border-slate-300 rounded-lg text-xs font-semibold flex items-center gap-1">
                        🔄 Atualizar
                      </button>
                      <button className="px-2 sm:px-3 py-1.5 bg-slate-100 border border-slate-300 rounded-lg text-xs font-semibold flex items-center gap-1">
                        <Download className="w-3 h-3" />
                        <span className="hidden sm:inline">Exportar</span> Excel
                      </button>
                    </div>
                    <span className="text-xs text-slate-600 font-semibold">📊 960 de 960 leads</span>
                  </div>

                  <div className="space-y-2 overflow-x-auto">
                    <div className="hidden md:grid grid-cols-5 gap-2 text-xs font-bold text-slate-600 pb-2 border-b">
                      <span>LEAD</span>
                      <span>CONTATO</span>
                      <span>EMPRESA</span>
                      <span>STATUS</span>
                      <span>ENGA.</span>
                    </div>

                    <div className="grid grid-cols-3 md:grid-cols-5 gap-2 items-center p-2 bg-slate-50 rounded-lg border border-slate-200 text-xs">
                      <div>
                        <p className="font-semibold text-slate-900 truncate">JOÃO SILVA</p>
                        <p className="text-slate-500 text-xs">😊 Positivo</p>
                      </div>
                      <span className="hidden md:inline text-slate-700 truncate">5511999990001</span>
                      <span className="hidden md:inline text-slate-600 truncate">Tech Solutions</span>
                      <span className="bg-green-100 text-green-700 px-2 py-1 rounded-full font-semibold text-center text-[10px] md:text-xs">Qualificado</span>
                      <span className="text-slate-500 text-center">A</span>
                    </div>

                    <div className="grid grid-cols-3 md:grid-cols-5 gap-2 items-center p-2 bg-slate-50 rounded-lg border border-slate-200 text-xs">
                      <div>
                        <p className="font-semibold text-slate-900 truncate">MARIA SANTOS</p>
                        <p className="text-slate-500 text-xs">😐 Neutro</p>
                      </div>
                      <span className="hidden md:inline text-slate-700 truncate">5511999990002</span>
                      <span className="hidden md:inline text-slate-600 truncate">Marketing Pro</span>
                      <span className="bg-blue-100 text-blue-700 px-2 py-1 rounded-full font-semibold text-center text-[10px] md:text-xs">Novo</span>
                      <span className="text-slate-500 text-center">B</span>
                    </div>

                    <div className="grid grid-cols-3 md:grid-cols-5 gap-2 items-center p-2 bg-slate-50 rounded-lg border border-slate-200 text-xs">
                      <div>
                        <p className="font-semibold text-slate-900 truncate">PEDRO OLIVEIRA</p>
                        <p className="text-slate-500 text-xs">😊 Positivo</p>
                      </div>
                      <span className="hidden md:inline text-slate-700 truncate">5511999990003</span>
                      <span className="hidden md:inline text-slate-600 truncate">Inovare</span>
                      <span className="bg-yellow-100 text-yellow-700 px-2 py-1 rounded-full font-semibold text-center text-[10px] md:text-xs">Contato</span>
                      <span className="text-slate-500 text-center">A</span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="order-1 md:order-2">
                <div className="flex flex-col md:flex-row items-start md:items-center gap-3 mb-6 text-center md:text-left">
                  <div className="w-12 h-12 bg-yellow-100 rounded-xl flex items-center justify-center mx-auto md:mx-0">
                    <Users className="w-7 h-7 text-yellow-600" />
                  </div>
                  <h3 className="text-2xl md:text-3xl font-bold text-slate-900 w-full md:w-auto">CRM de Gestão de Leads</h3>
                </div>
                <p className="text-lg text-slate-700 mb-6 leading-relaxed">
                  Visualize todos os seus leads em uma tabela completa com filtros por estágio, tags e status. 
                  Exporte para Excel com um clique e mantenha seu time comercial sincronizado.
                </p>
                <ul className="space-y-3">
                  <li className="flex items-start gap-2">
                    <CheckCircle className="w-5 h-5 text-green-500 mt-0.5 flex-shrink-0" />
                    <span className="text-slate-700">Filtros por Estágio, Tag e Status</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle className="w-5 h-5 text-green-500 mt-0.5 flex-shrink-0" />
                    <span className="text-slate-700">Exportação para Excel instantânea</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle className="w-5 h-5 text-green-500 mt-0.5 flex-shrink-0" />
                    <span className="text-slate-700">Sentimento automático em cada lead</span>
                  </li>
                </ul>
              </div>
            </div>

            {/* Painel 3: IA Analista */}
            <div className="grid md:grid-cols-2 gap-12 items-center">
              <div>
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-12 h-12 bg-purple-100 rounded-xl flex items-center justify-center">
                    <Sparkles className="w-7 h-7 text-purple-600" />
                  </div>
                  <h3 className="text-3xl font-bold text-slate-900">IA Analista</h3>
                </div>
                <p className="text-lg text-slate-700 mb-6 leading-relaxed">
                  Assistente inteligente de pré-vendas que analisa seus dados automaticamente. 
                  Faça perguntas em linguagem natural e receba insights instantâneos sobre performance, 
                  conversão, sentimento e muito mais.
                </p>
                <ul className="space-y-3">
                  <li className="flex items-start gap-2">
                    <CheckCircle className="w-5 h-5 text-green-500 mt-0.5 flex-shrink-0" />
                    <span className="text-slate-700">Análises de performance em tempo real</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle className="w-5 h-5 text-green-500 mt-0.5 flex-shrink-0" />
                    <span className="text-slate-700">Insights de vendas automatizados</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle className="w-5 h-5 text-green-500 mt-0.5 flex-shrink-0" />
                    <span className="text-slate-700">Perguntas por texto ou botões rápidos</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle className="w-5 h-5 text-green-500 mt-0.5 flex-shrink-0" />
                    <span className="text-slate-700">Conectado aos dados do seu CRM</span>
                  </li>
                </ul>
              </div>

              {/* Mockup IA Analista */}
              <div className="bg-gradient-to-br from-purple-600 to-purple-700 rounded-2xl p-6 shadow-2xl border-4 border-purple-500">
                <div className="bg-white rounded-xl p-5">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-purple-600 rounded-xl flex items-center justify-center">
                      <Sparkles className="w-6 h-6 text-white" />
                    </div>
                    <div>
                      <h4 className="text-xl font-bold text-slate-900">IA Analista</h4>
                      <p className="text-xs text-slate-600">Assistente inteligente de pré-vendas</p>
                    </div>
                  </div>

                  <div className="mb-4 p-3 bg-slate-50 rounded-lg border border-slate-200">
                    <p className="text-sm text-slate-700 mb-3">
                      Olá! 👋 Sou seu assistente de análise de pré-vendas.
                    </p>
                    <p className="text-sm text-slate-700 mb-3">
                      Estou conectado ao banco de dados do cliente <strong>Demo Analytics</strong> e posso ajudar você com:
                    </p>
                    
                    <div className="space-y-2 text-xs">
                      <p className="font-semibold text-slate-900">📊 **Análises de Performance**</p>
                      <p className="text-slate-600 pl-4">- Quantos leads entraram no funil este mês?</p>
                      <p className="text-slate-600 pl-4">- Qual a taxa de conversão entre os estágios?</p>
                      <p className="text-slate-600 pl-4">- Como está distribuído o sentimento dos leads?</p>
                      
                      <p className="font-semibold text-slate-900 mt-2">💡 **Insights de Vendas**</p>
                      <p className="text-slate-600 pl-4">- Quais copies estão tendo melhor resultado?</p>
                      <p className="text-slate-600 pl-4">- Análise de padrões de conversação</p>
                      <p className="text-slate-600 pl-4">- Sugestões de melhoria</p>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2 mb-3">
                    <button className="px-3 py-1.5 bg-purple-100 text-purple-700 rounded-lg text-xs font-semibold hover:bg-purple-200">
                      Quantos leads entraram este mês?
                    </button>
                    <button className="px-3 py-1.5 bg-purple-100 text-purple-700 rounded-lg text-xs font-semibold hover:bg-purple-200">
                      Taxa de conversão do funil
                    </button>
                    <button className="px-3 py-1.5 bg-purple-100 text-purple-700 rounded-lg text-xs font-semibold hover:bg-purple-200">
                      Mostre estatísticas gerais
                    </button>
                  </div>

                  <input 
                    type="text" 
                    placeholder="Digite sua pergunta sobre os dados de pré-vendas..."
                    className="w-full px-4 py-2.5 border-2 border-purple-300 rounded-lg text-sm focus:border-purple-500 focus:outline-none"
                    disabled
                  />
                </div>
              </div>
            </div>

            {/* Painel 4: Detalhe do Lead (40 mensagens) */}
            <div className="grid md:grid-cols-2 gap-12 items-center">
              {/* Mockup Detalhe Lead */}
              <div className="bg-gradient-to-br from-blue-600 to-blue-700 rounded-2xl p-6 shadow-2xl border-4 border-blue-500 order-2 md:order-1">
                <div className="bg-white rounded-xl p-5">
                  <div className="flex items-center justify-center mb-4">
                    <div className="w-24 h-24 bg-slate-700 rounded-full flex items-center justify-center">
                      <span className="text-4xl text-yellow-400 font-bold">JS</span>
                    </div>
                  </div>

                  <h4 className="text-center text-xl font-bold text-slate-900 mb-1">
                    JOÃO SILVA - TECH SOLUTIONS LTDA
                  </h4>

                  <div className="border-t-2 border-slate-200 pt-4 mt-4">
                    <h5 className="font-bold text-slate-900 mb-3 flex items-center gap-2">
                      <Users className="w-4 h-4" />
                      Informações
                    </h5>
                    <div className="space-y-2 text-sm">
                      <div className="flex items-center gap-2">
                        <Phone className="w-4 h-4 text-slate-400" />
                        <span className="text-green-600 font-semibold">(11) 99999-0001</span>
                      </div>
                      <div className="flex items-start gap-2">
                        <Tag className="w-4 h-4 text-slate-400 mt-0.5" />
                        <div>
                          <p className="text-xs text-slate-500">Fonte</p>
                          <p className="font-semibold text-slate-900">indicação</p>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="border-t-2 border-slate-200 pt-4 mt-4">
                    <h5 className="font-bold text-slate-900 mb-3 flex items-center gap-2">
                      <Target className="w-4 h-4" />
                      Status
                    </h5>
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-slate-600">Status Lead</span>
                        <span className="bg-green-100 text-green-700 px-3 py-1 rounded-full text-xs font-bold">
                          qualificado
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-slate-600">Follow-up</span>
                        <span className="bg-purple-100 text-purple-700 px-3 py-1 rounded-full text-xs font-bold">
                          Etapa 3
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="border-t-2 border-slate-200 pt-4 mt-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="bg-blue-50 rounded-lg p-3 text-center">
                        <p className="text-3xl font-bold text-blue-600">28</p>
                        <p className="text-xs text-slate-600">Mensagens</p>
                      </div>
                      <div className="bg-green-50 rounded-lg p-3 text-center">
                        <p className="text-lg font-bold text-green-600">✓ IA Ativa</p>
                        <p className="text-xs text-slate-600">Clique para desativar</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="order-1 md:order-2">
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center">
                    <Target className="w-7 h-7 text-blue-600" />
                  </div>
                  <h3 className="text-3xl font-bold text-slate-900">Visão Completa do Lead</h3>
                </div>
                <p className="text-lg text-slate-700 mb-6 leading-relaxed">
                  Acesse todas as informações de um lead em uma única tela: histórico completo de mensagens,
                  WhatsApp, fonte, status atual, etapa de follow-up e controle da IA.
                </p>
                <ul className="space-y-3">
                  <li className="flex items-start gap-2">
                    <CheckCircle className="w-5 h-5 text-green-500 mt-0.5 flex-shrink-0" />
                    <span className="text-slate-700">Histórico completo de todas as mensagens</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle className="w-5 h-5 text-green-500 mt-0.5 flex-shrink-0" />
                    <span className="text-slate-700">Status e etapa de follow-up em tempo real</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle className="w-5 h-5 text-green-500 mt-0.5 flex-shrink-0" />
                    <span className="text-slate-700">WhatsApp clicável para contato direto</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle className="w-5 h-5 text-green-500 mt-0.5 flex-shrink-0" />
                    <span className="text-slate-700">Ativar/desativar IA com um clique</span>
                  </li>
                </ul>
              </div>
            </div>

            {/* Painel 5: Dashboard com Métricas */}
            <div className="grid md:grid-cols-2 gap-12 items-center">
              <div>
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-12 h-12 bg-green-100 rounded-xl flex items-center justify-center">
                    <BarChart3 className="w-7 h-7 text-green-600" />
                  </div>
                  <h3 className="text-3xl font-bold text-slate-900">Dashboard em Tempo Real</h3>
                </div>
                <p className="text-lg text-slate-700 mb-6 leading-relaxed">
                  Acompanhe todas as métricas da sua operação de pré-vendas em tempo real. 
                  Funil de conversão, análise de sentimento, distribuição por estágio e muito mais.
                </p>
                <ul className="space-y-3">
                  <li className="flex items-start gap-2">
                    <CheckCircle className="w-5 h-5 text-green-500 mt-0.5 flex-shrink-0" />
                    <span className="text-slate-700">Funil de conversão em tempo real</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle className="w-5 h-5 text-green-500 mt-0.5 flex-shrink-0" />
                    <span className="text-slate-700">Análise de sentimento automatizada</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle className="w-5 h-5 text-green-500 mt-0.5 flex-shrink-0" />
                    <span className="text-slate-700">Distribuição de leads por estágio</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle className="w-5 h-5 text-green-500 mt-0.5 flex-shrink-0" />
                    <span className="text-slate-700">Métricas de performance atualizadas</span>
                  </li>
                </ul>
              </div>

              {/* Mockup Dashboard */}
              <div className="bg-gradient-to-br from-green-600 to-green-700 rounded-2xl p-6 shadow-2xl border-4 border-green-500">
                <div className="bg-white rounded-xl p-5">
                  <div className="mb-4">
                    <h4 className="text-2xl font-bold text-slate-900 mb-1">Dashboard de Pré-Vendas</h4>
                    <p className="text-sm text-slate-600">Métricas atualizadas em tempo real</p>
                  </div>

                  {/* Funil de Conversão */}
                  <div className="bg-slate-50 rounded-xl p-4 mb-4 border-2 border-slate-200">
                    <h5 className="text-base font-bold text-slate-900 mb-3 flex items-center gap-2">
                      <TrendingUp className="w-4 h-4" />
                      Funil de Conversão
                    </h5>
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-slate-600">Novo Lead</span>
                        <div className="flex-1 mx-3 bg-slate-200 rounded-full h-2">
                          <div className="bg-blue-600 h-2 rounded-full" style={{width: '100%'}}></div>
                        </div>
                        <span className="text-xs font-bold text-slate-900 w-8 text-right">960</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-slate-600">Contato Iniciado</span>
                        <div className="flex-1 mx-3 bg-slate-200 rounded-full h-2">
                          <div className="bg-yellow-500 h-2 rounded-full" style={{width: '45%'}}></div>
                        </div>
                        <span className="text-xs font-bold text-slate-900 w-8 text-right">432</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-slate-600">Qualificado</span>
                        <div className="flex-1 mx-3 bg-slate-200 rounded-full h-2">
                          <div className="bg-green-500 h-2 rounded-full" style={{width: '18%'}}></div>
                        </div>
                        <span className="text-xs font-bold text-slate-900 w-8 text-right">173</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-slate-600">Reunião Agendada</span>
                        <div className="flex-1 mx-3 bg-slate-200 rounded-full h-2">
                          <div className="bg-purple-600 h-2 rounded-full" style={{width: '9%'}}></div>
                        </div>
                        <span className="text-xs font-bold text-slate-900 w-8 text-right">86</span>
                      </div>
                    </div>
                  </div>

                  {/* Análise de Sentimento */}
                  <div className="bg-slate-50 rounded-xl p-4 border-2 border-slate-200">
                    <h5 className="text-base font-bold text-slate-900 mb-3 flex items-center gap-2">
                      💬 Análise de Sentimento
                    </h5>
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                          <span className="text-xs text-slate-700 font-semibold">Positivo</span>
                        </div>
                        <div className="text-right">
                          <div className="text-base font-bold text-green-600">72.4%</div>
                          <div className="text-xs text-slate-600">695 leads</div>
                        </div>
                      </div>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className="w-3 h-3 bg-slate-400 rounded-full"></div>
                          <span className="text-xs text-slate-700 font-semibold">Neutro</span>
                        </div>
                        <div className="text-right">
                          <div className="text-base font-bold text-slate-600">21.2%</div>
                          <div className="text-xs text-slate-600">204 leads</div>
                        </div>
                      </div>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className="w-3 h-3 bg-red-500 rounded-full"></div>
                          <span className="text-xs text-slate-700 font-semibold">Negativo</span>
                        </div>
                        <div className="text-right">
                          <div className="text-base font-bold text-red-600">6.4%</div>
                          <div className="text-xs text-slate-600">61 leads</div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-16 text-center">
            <button 
              onClick={() => scrollToSection('contato')}
              className="bg-yellow-500 hover:bg-yellow-600 text-slate-900 font-bold px-12 py-4 rounded-xl text-lg transition-all duration-300 transform hover:scale-105 inline-flex items-center"
            >
              Solicitar Demonstração
              <ArrowRight className="ml-2 w-5 h-5" />
            </button>
          </div>
        </div>
      </section>

      {/* ANA PAULA - TESTE A IA NA PRÁTICA */}
      <section className="py-20 px-4 sm:px-6 lg:px-8 bg-gradient-to-br from-slate-900 to-slate-800">
        <div className="max-w-4xl mx-auto text-center text-white">
          <div className="flex justify-center mb-8">
            <div className="relative">
              <div className="w-32 h-32 rounded-full bg-gradient-to-br from-green-400 to-green-600 p-1 animate-pulse">
                <div className="w-full h-full rounded-full bg-slate-800 flex items-center justify-center overflow-hidden">
                  <div className="w-28 h-28 rounded-full bg-gradient-to-br from-green-500 to-emerald-500 flex items-center justify-center overflow-hidden">
                    <img 
                      src="/images/ana-paula-avatar.jpg" 
                      alt="Ana Paula — assistente de IA de pré-vendas da Vendas+IA"
                      className="w-full h-full object-cover"
                    />
                  </div>
                </div>
              </div>
              <div className="absolute bottom-2 right-2 w-6 h-6 bg-green-500 border-4 border-slate-800 rounded-full animate-pulse"></div>
            </div>
          </div>
          
          <div className="inline-block bg-green-500 text-white px-6 py-2 rounded-full font-bold mb-6 text-sm animate-bounce">
            ⚡ TESTE AGORA NA PRÁTICA
          </div>
          
          <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold mb-6">
            Converse com Nossa IA <span className="text-green-400">Ana Paula</span>
          </h2>
          <p className="text-lg sm:text-xl text-slate-300 mb-4">
            Veja como ela prospecta, qualifica e agenda reuniões em tempo real
          </p>
          <p className="text-base text-slate-400 mb-8">
            A mesma IA que trabalha 24/7 prospectando para nossos clientes. Teste agora!
          </p>
          <button 
            onClick={openWhatsApp}
            className="bg-green-500 hover:bg-green-600 text-white font-bold px-8 sm:px-12 py-4 rounded-lg text-base sm:text-lg transition-all duration-300 transform hover:scale-105 inline-flex items-center gap-3 shadow-2xl"
          >
            <MessageSquare className="w-6 h-6 sm:w-7 sm:h-7 flex-shrink-0" />
            <span>Testar Ana Paula Agora</span>
          </button>
          <p className="text-sm text-slate-400 mt-4">Resposta em até 2 minutos • WhatsApp: (11) 95213-4106</p>
        </div>
      </section>

      {/* Casos de Uso */}
      <section className="py-20 px-4 sm:px-6 lg:px-8 bg-gradient-to-br from-slate-50 to-blue-50">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-bold text-slate-900 mb-4">
              Como Empresas Usam Vendas+IA
            </h2>
            <p className="text-xl text-slate-600 max-w-3xl mx-auto">
              Casos de uso reais de empresas que já utilizam nossa plataforma
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            <div className="bg-white rounded-2xl p-8 shadow-xl border-2 border-slate-200">
              <h3 className="text-2xl font-bold text-slate-900 mb-6">Agências & Parceiros</h3>
              <div className="space-y-4">
                <div>
                  <p className="text-sm font-semibold text-slate-500 mb-1">PROBLEMA</p>
                  <p className="text-slate-700">Time sobrecarregado prospectando manualmente para múltiplos clientes</p>
                </div>
                <div>
                  <p className="text-sm font-semibold text-slate-500 mb-1">SOLUÇÃO</p>
                  <p className="text-slate-700">IA prospecta 600+ leads/mês por cliente automaticamente</p>
                </div>
                <div>
                  <p className="text-sm font-semibold text-green-600 mb-1">RESULTADO</p>
                  <p className="text-slate-900 font-bold">3x mais reuniões com mesmo time</p>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-2xl p-8 shadow-xl border-2 border-yellow-500">
              <div className="flex items-center gap-2 mb-6">
                <h3 className="text-2xl font-bold text-slate-900">Empresas B2B</h3>
                <span className="bg-yellow-100 text-yellow-800 px-3 py-1 rounded-full text-xs font-bold">DESTAQUE</span>
              </div>
              <div className="space-y-4">
                <div>
                  <p className="text-sm font-semibold text-slate-500 mb-1">PROBLEMA</p>
                  <p className="text-slate-700">Leads frios sem follow-up estruturado e baixa taxa de conversão</p>
                </div>
                <div>
                  <p className="text-sm font-semibold text-slate-500 mb-1">SOLUÇÃO</p>
                  <p className="text-slate-700">Cadências automáticas de reativação via WhatsApp com IA</p>
                </div>
                <div>
                  <p className="text-sm font-semibold text-green-600 mb-1">RESULTADO</p>
                  <p className="text-slate-900 font-bold">25% dos inativos reativados em 30 dias</p>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-2xl p-8 shadow-xl border-2 border-slate-200">
              <h3 className="text-2xl font-bold text-slate-900 mb-6">Empresas de Serviços</h3>
              <div className="space-y-4">
                <div>
                  <p className="text-sm font-semibold text-slate-500 mb-1">PROBLEMA</p>
                  <p className="text-slate-700">Custo elevado para contratar e treinar SDRs</p>
                </div>
                <div>
                  <p className="text-sm font-semibold text-slate-500 mb-1">SOLUÇÃO</p>
                  <p className="text-slate-700">Substituição de 2-3 SDRs por 1 IA a R$1.800/mês</p>
                </div>
                <div>
                  <p className="text-sm font-semibold text-green-600 mb-1">RESULTADO</p>
                  <p className="text-slate-900 font-bold">70% de economia + disponibilidade 24/7</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Calculadora removida */}

      {/* BDR vs IA */}
      <section className="py-20 px-4 sm:px-6 lg:px-8 bg-gradient-to-br from-slate-50 to-blue-50">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-4xl md:text-5xl font-bold text-slate-900 mb-4">
              Antes da <span className="text-slate-600">Vendas</span><span className="text-yellow-500">+</span><span className="text-blue-600">IA</span>
            </h2>
            <div className="flex items-center justify-center gap-4 mt-8">
              <div className="flex-1 max-w-xs text-right">
                <p className="text-xl font-bold text-amber-700">Antes da Vendas+IA</p>
              </div>
              <div className="text-4xl">⚡</div>
              <div className="flex-1 max-w-xs text-left">
                <p className="text-xl font-bold text-blue-600">Depois da Vendas+IA</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-3xl shadow-2xl overflow-hidden">
            <div className="grid md:grid-cols-2">
              <div className="p-6 md:p-12 bg-gradient-to-br from-slate-100 to-slate-50">
                <div className="space-y-4 md:space-y-6">
                  <div className="bg-white p-4 md:p-6 rounded-2xl border-2 border-slate-200 text-center">
                    <p className="text-slate-900 font-semibold text-base md:text-lg">
                      Salário médio de R$2.500 a R$4.000/mês
                    </p>
                  </div>

                  <div className="bg-white p-4 md:p-6 rounded-2xl border-2 border-slate-200 text-center">
                    <p className="text-slate-900 font-semibold text-base md:text-lg">
                      Tempo médio para rampagem: 3–6 meses
                    </p>
                  </div>

                  <div className="bg-white p-4 md:p-6 rounded-2xl border-2 border-slate-200 text-center">
                    <p className="text-slate-900 font-semibold text-base md:text-lg">
                      Limite de prospecções por dia (cansaço, pausas)
                    </p>
                  </div>
                </div>
              </div>

              <div className="p-6 md:p-12 bg-gradient-to-br from-blue-600 to-blue-700 relative">
                <div className="absolute top-2 right-2 md:top-4 md:right-4 bg-yellow-400 text-blue-900 text-xs font-bold px-3 py-2 rounded-full shadow-lg" style={{whiteSpace: 'nowrap'}}>
                  ⚡ RECOMENDADO
                </div>
                
                <div className="space-y-4 md:space-y-6">
                  <div className="bg-white/95 p-4 md:p-6 rounded-2xl border-2 border-blue-300 text-center">
                    <p className="text-blue-900 font-semibold text-base md:text-lg">
                      Plano de IA a partir de R$599/mês
                    </p>
                  </div>

                  <div className="bg-white/95 p-4 md:p-6 rounded-2xl border-2 border-blue-300 text-center">
                    <p className="text-blue-900 font-semibold text-base md:text-lg">
                      Ativação em até 7 dias
                    </p>
                  </div>

                  <div className="bg-white/95 p-4 md:p-6 rounded-2xl border-2 border-blue-300 text-center">
                    <p className="text-blue-900 font-semibold text-base md:text-lg">
                      Capacidade de prospecção 24/7 sem interrupção
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Planos removidos — preços sob consulta */}
      {false && <section id="planos" className="py-20 px-4 sm:px-6 lg:px-8 bg-white">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-slate-900 mb-4">Planos</h2>
            <p className="text-xl text-slate-600">Escolha o melhor para seu momento</p>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6 max-w-7xl mx-auto">
            {/* Plano Starter - NOVO */}
            <div className="bg-white rounded-2xl p-6 border-2 border-slate-200 hover:border-yellow-500 transition-colors duration-300">
              <h3 className="text-2xl font-bold text-slate-900 mb-2">Starter</h3>
              <div className="mb-6">
                <span className="text-3xl font-bold text-slate-900">R$ 599</span>
                <span className="text-slate-600">/mês</span>
              </div>
              <ul className="space-y-3 mb-8">
                <li className="flex items-start">
                  <CheckCircle className="w-5 h-5 text-green-500 mr-2 mt-0.5 flex-shrink-0" />
                  <span className="text-slate-600 text-sm">300 leads/mês</span>
                </li>
                <li className="flex items-start">
                  <CheckCircle className="w-5 h-5 text-green-500 mr-2 mt-0.5 flex-shrink-0" />
                  <span className="text-slate-600 text-sm">Prospecção Outbound</span>
                </li>
                <li className="flex items-start">
                  <CheckCircle className="w-5 h-5 text-green-500 mr-2 mt-0.5 flex-shrink-0" />
                  <span className="text-slate-600 text-sm"><strong>CRM incluído</strong></span>
                </li>
                <li className="flex items-start">
                  <CheckCircle className="w-5 h-5 text-green-500 mr-2 mt-0.5 flex-shrink-0" />
                  <span className="text-slate-600 text-sm">Integrações básicas</span>
                </li>
                <li className="flex items-start">
                  <CheckCircle className="w-5 h-5 text-green-500 mr-2 mt-0.5 flex-shrink-0" />
                  <span className="text-slate-600 text-sm">Setup: R$ 999</span>
                </li>
              </ul>
              <button 
                onClick={() => scrollToSection('contato')}
                className="w-full bg-slate-900 hover:bg-slate-800 text-white font-semibold py-3 rounded-lg transition-colors duration-300 text-sm"
              >
                Começar Agora
              </button>
            </div>

            {/* Plano Pro - MAIS POPULAR */}
            <div className="bg-gradient-to-br from-yellow-500 to-yellow-600 rounded-2xl p-6 transform lg:scale-105 shadow-2xl">
              <div className="bg-white text-yellow-600 text-xs font-bold px-3 py-1 rounded-full inline-block mb-4">
                MAIS POPULAR
              </div>
              <h3 className="text-2xl font-bold text-white mb-2">Pro</h3>
              <div className="mb-6">
                <span className="text-3xl font-bold text-white">R$ 999</span>
                <span className="text-yellow-100">/mês</span>
              </div>
              <ul className="space-y-3 mb-8">
                <li className="flex items-start">
                  <CheckCircle className="w-5 h-5 text-white mr-2 mt-0.5 flex-shrink-0" />
                  <span className="text-white text-sm">600 leads/mês</span>
                </li>
                <li className="flex items-start">
                  <CheckCircle className="w-5 h-5 text-white mr-2 mt-0.5 flex-shrink-0" />
                  <span className="text-white text-sm">Prospecção Outbound</span>
                </li>
                <li className="flex items-start">
                  <CheckCircle className="w-5 h-5 text-white mr-2 mt-0.5 flex-shrink-0" />
                  <span className="text-white text-sm"><strong>CRM incluído</strong></span>
                </li>
                <li className="flex items-start">
                  <CheckCircle className="w-5 h-5 text-white mr-2 mt-0.5 flex-shrink-0" />
                  <span className="text-white text-sm">Integrações avançadas</span>
                </li>
                <li className="flex items-start">
                  <CheckCircle className="w-5 h-5 text-white mr-2 mt-0.5 flex-shrink-0" />
                  <span className="text-white text-sm">Setup: R$ 999</span>
                </li>
              </ul>
              <button 
                onClick={() => scrollToSection('contato')}
                className="w-full bg-white hover:bg-slate-50 text-yellow-600 font-semibold py-3 rounded-lg transition-colors duration-300 text-sm"
              >
                Começar Agora
              </button>
            </div>

            {/* Plano Growth */}
            <div className="bg-white rounded-2xl p-6 border-2 border-slate-200 hover:border-yellow-500 transition-colors duration-300">
              <h3 className="text-2xl font-bold text-slate-900 mb-2">Growth</h3>
              <div className="mb-6">
                <span className="text-3xl font-bold text-slate-900">R$ 1.800</span>
                <span className="text-slate-600">/mês</span>
              </div>
              <ul className="space-y-3 mb-8">
                <li className="flex items-start">
                  <CheckCircle className="w-5 h-5 text-green-500 mr-2 mt-0.5 flex-shrink-0" />
                  <span className="text-slate-600 text-sm">1.200 leads/mês</span>
                </li>
                <li className="flex items-start">
                  <CheckCircle className="w-5 h-5 text-green-500 mr-2 mt-0.5 flex-shrink-0" />
                  <span className="text-slate-600 text-sm">Prospecção Outbound</span>
                </li>
                <li className="flex items-start">
                  <CheckCircle className="w-5 h-5 text-green-500 mr-2 mt-0.5 flex-shrink-0" />
                  <span className="text-slate-600 text-sm"><strong>CRM incluído</strong></span>
                </li>
                <li className="flex items-start">
                  <CheckCircle className="w-5 h-5 text-green-500 mr-2 mt-0.5 flex-shrink-0" />
                  <span className="text-slate-600 text-sm">Integrações personalizadas</span>
                </li>
                <li className="flex items-start">
                  <CheckCircle className="w-5 h-5 text-green-500 mr-2 mt-0.5 flex-shrink-0" />
                  <span className="text-slate-600 text-sm">Setup: Negociável</span>
                </li>
              </ul>
              <button 
                onClick={() => scrollToSection('contato')}
                className="w-full bg-slate-900 hover:bg-slate-800 text-white font-semibold py-3 rounded-lg transition-colors duration-300 text-sm"
              >
                Começar Agora
              </button>
            </div>

            {/* Plano Enterprise */}
            <div className="bg-white rounded-2xl p-6 border-2 border-slate-200 hover:border-yellow-500 transition-colors duration-300">
              <h3 className="text-2xl font-bold text-slate-900 mb-2">Enterprise</h3>
              <div className="mb-6">
                <span className="text-3xl font-bold text-slate-900">Negociável</span>
              </div>
              <ul className="space-y-3 mb-8">
                <li className="flex items-start">
                  <CheckCircle className="w-5 h-5 text-green-500 mr-2 mt-0.5 flex-shrink-0" />
                  <span className="text-slate-600 text-sm">3.000+ leads/mês</span>
                </li>
                <li className="flex items-start">
                  <CheckCircle className="w-5 h-5 text-green-500 mr-2 mt-0.5 flex-shrink-0" />
                  <span className="text-slate-600 text-sm">Prospecção Outbound</span>
                </li>
                <li className="flex items-start">
                  <CheckCircle className="w-5 h-5 text-green-500 mr-2 mt-0.5 flex-shrink-0" />
                  <span className="text-slate-600 text-sm"><strong>CRM incluído</strong></span>
                </li>
                <li className="flex items-start">
                  <CheckCircle className="w-5 h-5 text-green-500 mr-2 mt-0.5 flex-shrink-0" />
                  <span className="text-slate-600 text-sm">Integrações customizadas</span>
                </li>
                <li className="flex items-start">
                  <CheckCircle className="w-5 h-5 text-green-500 mr-2 mt-0.5 flex-shrink-0" />
                  <span className="text-slate-600 text-sm">Suporte prioritário</span>
                </li>
              </ul>
              <button 
                onClick={() => scrollToSection('contato')}
                className="w-full bg-slate-900 hover:bg-slate-800 text-white font-semibold py-3 rounded-lg transition-colors duration-300 text-sm"
              >
                Falar com Vendas
              </button>
            </div>
          </div>
        </div>
      </section>}

      {/* FAQ Section */}
      <section id="faq" className="py-20 px-4 sm:px-6 lg:px-8 bg-gradient-to-br from-slate-50 to-blue-50">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-3xl md:text-4xl font-bold text-slate-900 mb-12 text-center">
            Dúvidas Frequentes
          </h2>
          <div className="space-y-4">
            {faqs.map((faq, index) => (
              <div
                key={index}
                className="bg-white rounded-xl border-2 border-slate-200 overflow-hidden transition-all duration-300 hover:shadow-lg"
              >
                <button
                  onClick={() => setOpenFaq(openFaq === index ? null : index)}
                  className="w-full px-6 py-5 flex justify-between items-center text-left hover:bg-slate-50 transition-colors"
                >
                  <span className="text-lg font-semibold text-slate-900 pr-4">
                    {faq.question}
                  </span>
                  {openFaq === index ? (
                    <ChevronUp className="w-6 h-6 text-slate-600 flex-shrink-0" />
                  ) : (
                    <ChevronDown className="w-6 h-6 text-slate-600 flex-shrink-0" />
                  )}
                </button>
                {openFaq === index && (
                  <div className="px-6 pb-5">
                    <p className="text-slate-700 leading-relaxed">
                      {faq.answer}
                    </p>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Contato */}
      <section id="contato" className="py-20 px-4 sm:px-6 lg:px-8 bg-white">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-4xl font-bold text-slate-900 mb-4">Solicite uma Demonstração</h2>
            <p className="text-xl text-slate-600">Preencha o formulário e entraremos em contato</p>
          </div>
          
          <div className="max-w-2xl mx-auto">
            <div className="bg-gradient-to-br from-slate-50 to-blue-50 rounded-2xl p-8 mb-8">
              <form
                onSubmit={handleFormSubmit}
                className="space-y-4"
              >
                <input 
                  type="text" 
                  name="nome"
                  placeholder="Seu nome completo"
                  required
                  className="w-full px-4 py-3 rounded-lg border-2 border-slate-300 focus:border-yellow-500 focus:outline-none text-slate-900 font-medium"
                />
                <input 
                  type="email" 
                  name="email"
                  placeholder="seu@email.com"
                  required
                  className="w-full px-4 py-3 rounded-lg border-2 border-slate-300 focus:border-yellow-500 focus:outline-none text-slate-900 font-medium"
                />
                <input
                  type="tel"
                  name="telefone"
                  placeholder="WhatsApp (11) 99999-9999"
                  onChange={handlePhoneChange}
                  maxLength={15}
                  required
                  className="w-full px-4 py-3 rounded-lg border-2 border-slate-300 focus:border-yellow-500 focus:outline-none text-slate-900 font-medium"
                />
                <input 
                  type="text" 
                  name="empresa"
                  placeholder="Nome da sua empresa"
                  required
                  className="w-full px-4 py-3 rounded-lg border-2 border-slate-300 focus:border-yellow-500 focus:outline-none text-slate-900 font-medium"
                />
                <select 
                  name="tamanho_equipe"
                  required
                  className="w-full px-4 py-3 rounded-lg border-2 border-slate-300 focus:border-yellow-500 focus:outline-none text-slate-600 font-medium"
                >
                  <option value="">Tamanho da equipe de vendas</option>
                  <option>1-3 pessoas</option>
                  <option>4-10 pessoas</option>
                  <option>11-20 pessoas</option>
                  <option>20+ pessoas</option>
                </select>
                <textarea 
                  name="desafio"
                  placeholder="Conte-nos sobre seu principal desafio em vendas..."
                  rows={3}
                  required
                  className="w-full px-4 py-3 rounded-lg border-2 border-slate-300 focus:border-yellow-500 focus:outline-none text-slate-900 font-medium"
                ></textarea>

                {formMessage && (
                  <div className={`p-4 rounded-lg ${
                    formMessage.type === 'success'
                      ? 'bg-green-100 text-green-800 border-2 border-green-300'
                      : 'bg-red-100 text-red-800 border-2 border-red-300'
                  }`}>
                    {formMessage.text}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={formSubmitting}
                  className="w-full bg-yellow-500 hover:bg-yellow-600 disabled:bg-slate-400 disabled:cursor-not-allowed text-slate-900 font-bold py-4 rounded-lg transition-colors duration-300 text-lg"
                >
                  {formSubmitting ? 'Enviando...' : 'Solicitar Demonstração'}
                </button>
              </form>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-slate-900 text-white py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="grid md:grid-cols-3 gap-8 mb-8">
            <div>
              <div className="flex items-center space-x-2 mb-4">
                <MessageSquare className="w-8 h-8 text-yellow-500" />
                <span className="text-2xl font-bold">
                  <span>Vendas</span>
                  <span className="text-yellow-500">+</span>
                  <span className="text-slate-300">IA</span>
                </span>
              </div>
              <p className="text-slate-400 mb-6">
                Solução de IA para a área de pré-vendas
              </p>

              {/* Logo Google for Startups */}
              <div className="mt-6">
                <img
                  src="/google-startups-logo.jpg"
                  alt="Vendas+IA no programa Google for Startups"
                  className="h-12 w-auto opacity-80 hover:opacity-100 transition-opacity rounded-lg"
                />
              </div>
            </div>

            <div>
              <h3 className="font-bold text-lg mb-4">Contato</h3>
              <div className="space-y-3">
                <div className="flex items-start space-x-3">
                  <Mail className="w-5 h-5 text-yellow-500 mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="text-slate-300">atendimento@vendasmaisia.com</p>
                  </div>
                </div>
                <div className="flex items-start space-x-3">
                  <MapPin className="w-5 h-5 text-yellow-500 mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="text-slate-300">WeWork - Av. Paulista, 2287</p>
                    <p className="text-slate-300">São Paulo - SP</p>
                  </div>
                </div>
              </div>
            </div>

            <div>
              <h3 className="font-bold text-lg mb-4">Links Rápidos</h3>
              <div className="space-y-2">
                <button onClick={() => scrollToSection('features')} className="block text-slate-400 hover:text-yellow-500 transition-colors">
                  Funcionalidades
                </button>
                <button onClick={() => scrollToSection('contato')} className="block text-slate-400 hover:text-yellow-500 transition-colors">
                  Solicitar Demo
                </button>
                <button onClick={() => scrollToSection('contato')} className="block text-slate-400 hover:text-yellow-500 transition-colors">
                  Solicitar Demo
                </button>
                <a href="/privacidade" className="block text-slate-400 hover:text-yellow-500 transition-colors">
                  Política de Privacidade
                </a>
              </div>
            </div>
          </div>

          <div className="border-t border-slate-800 pt-8 text-center">
            <p className="text-sm text-slate-500">
              © 2025 Vendas+IA. Todos os direitos reservados.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
