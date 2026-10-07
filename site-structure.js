/*
  NEXUS FINANCE — ESTRUTURA DO SITE

  Para criar uma nova aba:
  1. Copie um bloco dentro de pages.
  2. Troque id, label, mobileLabel, icon, title e subtitle.
  3. Se a página ainda não existir no HTML, use blocks para criar o conteúdo automaticamente.

  Exemplo:
  {
    id: "metas",
    label: "Metas",
    mobileLabel: "Metas",
    icon: "◎",
    title: "Metas",
    subtitle: "Objetivos financeiros.",
    showDesktop: true,
    showMobile: true,
    blocks: [
      {
        eyebrow: "OBJETIVOS",
        title: "Minhas metas",
        text: "Aqui você acompanha seus objetivos."
      }
    ]
  }

  Para esconder uma aba sem apagar:
  showDesktop: false
  showMobile: false

  As páginas home, movements, stats, crypto e settings já têm funções próprias.
*/

window.NEXUS_STRUCTURE = {
  brand: {
    name: "NEXUS",
    product: "FINANCE",
    initial: "N"
  },

  pages: [
    {
      id: "home",
      label: "Dashboard",
      mobileLabel: "Início",
      icon: "⌂",
      title: "Dashboard",
      subtitle: "Visão geral das suas finanças.",
      showDesktop: true,
      showMobile: true
    },
    {
      id: "movements",
      label: "Movimentações",
      mobileLabel: "Mov.",
      icon: "＋",
      title: "Movimentações",
      subtitle: "Cadastre tudo no mesmo lugar.",
      showDesktop: true,
      showMobile: true
    },
    {
      id: "stats",
      label: "Estatísticas",
      mobileLabel: "Stats",
      icon: "▥",
      title: "Estatísticas",
      subtitle: "Indicadores, gráficos e relatórios.",
      showDesktop: true,
      showMobile: true
    },
    {
      id: "crypto",
      label: "Cripto & Mercado",
      mobileLabel: "Cripto",
      icon: "₿",
      title: "Cripto & Mercado",
      subtitle: "Preços, notícias e cenários.",
      showDesktop: true,
      showMobile: true,

      subTabs: [
        { id: "radar", label: "Radar" },
        { id: "live", label: "Acompanhamento ao Vivo" }
      ]
    },
    {
      id: "settings",
      label: "Configurações",
      mobileLabel: "Ajustes",
      icon: "⚙",
      title: "Configurações",
      subtitle: "Conexões e preferências.",
      showDesktop: true,
      showMobile: true
    }

    /*
      NOVA ABA — MODELO PRONTO

      ,{
        id: "metas",
        label: "Metas",
        mobileLabel: "Metas",
        icon: "◎",
        title: "Metas",
        subtitle: "Objetivos financeiros.",
        showDesktop: true,
        showMobile: true,
        blocks: [
          {
            eyebrow: "MINHAS METAS",
            title: "Objetivos",
            text: "Você pode editar este texto direto no site-structure.js."
          },
          {
            eyebrow: "PRÓXIMA ETAPA",
            title: "Planejamento",
            text: "Cada bloco vira um painel automaticamente."
          }
        ]
      }
    */
  ]
};
