[2026-08-26 12:35] | RCA criada | Bug do menu mobile analisado e documentado | [frontend/src/styles.css](frontend/src/styles.css) | Validar comportamento em telas administrativas reais

# Sintoma
Em viewport mobile, ao tocar no botão de menu nas telas administrativas a interface desfocava, mas o drawer lateral não ficava visível para troca de página.

# Causa raiz
O drawer global do menu mobile tinha ajustes visuais de largura no breakpoint responsivo, mas não estava explicitamente ancorado ao viewport com `inset: 0`. Em combinações de layout mais densas das telas administrativas, o overlay abria e aplicava o blur, porém o painel podia permanecer preso ao canto direito ou parcialmente fora da área útil visível.

# Impacto
Usuários em mobile não conseguiam navegar entre `Temporada`, `Mensalidades`, `Prêmios`, `Usuários` e `Config.` a partir do menu principal em algumas telas.

# Origem
A regressão foi introduzida durante a rodada de refinamentos responsivos, quando o menu passou a receber overrides mobile parciais focados em largura e padding, sem redefinir completamente sua ancoragem física no viewport.

# Correção aplicada
No breakpoint mobile, o seletor `.account-menu` passou a usar `inset: 0`, `width: auto`, `height: auto`, `min-width: 0`, `border-radius: 0` e `overflow-x: hidden`, garantindo que o drawer ocupe a viewport inteira de forma estável.

# Prevenção
Todo overlay global mobile deve redefinir explicitamente ancoragem (`top/right/bottom/left` ou `inset`) no breakpoint em vez de depender só de `width` e `padding`.