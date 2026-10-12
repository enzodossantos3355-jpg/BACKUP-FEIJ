# Marmita Hub - PRD

## Problem Statement
"um aplicativo de pedidos onde eu posso adicionar pedidos, produtos, forma de pagamento, valores e relatorio e observações" — Marmitaria (delivery + retirada, sem consumo no local).

## User Choices
- Negócio: Marmitaria (entrega/retirada)
- Auth: Login customizado (JWT) + Google Login (Emergent Auth)
- Pagamento: Registro manual (Dinheiro, Cartão Crédito, Cartão Débito, Pix)
- Relatórios: Completos com gráficos
- Idioma: pt-BR

## Personas
- Dono(a) de marmitaria (admin/operador)
- Atendente que registra pedidos
- Cozinha (consulta status)

## Core Requirements
1. Autenticação multi-provedor (email/senha + Google)
2. CRUD de produtos (marmitas, bebidas, etc.)
3. CRUD de pedidos com itens, cliente, endereço, forma de pagamento, observações
4. Pipeline de status: Novo → Em Preparo → Pronto → Em Entrega → Concluído (ou Cancelado)
5. Relatórios: faturamento por dia, por forma de pagamento, top produtos, ticket médio

## Implemented (2026-02)
- Backend FastAPI com JWT + Emergent Google Auth (cookies httpOnly)
- Endpoints: /api/auth/{register,login,me,logout,session}
- /api/products CRUD com isolamento por usuário; produtos com `additionals` (lista nome+preço)
- /api/orders CRUD + PATCH /status + PATCH /payment com isolamento
- Itens de pedido podem ter `additionals` selecionáveis e `notes`
- `payment_method = "Pendente"` permite criar pedido sem definir pagamento e alterar depois
- /api/delivery-zones CRUD para taxas fixas por bairro/zona
- /api/upload + /api/files/{path:path} via Emergent Object Storage (JPG/PNG/WEBP, máx 5MB, isolado por usuário)
- /api/reports/summary com agregações
- Frontend React com sidebar, design earthy (paleta terracota/stone)
- Páginas: Login, Register, Dashboard (KPIs + pedidos recentes), Pedidos (filtro por status, dialog de criação com seleção de adicionais e zona de entrega, detalhe com mudança rápida de pagamento/status), Produtos (upload de foto, gestão de adicionais, cards bonitos), Relatórios (BarChart + PieChart + top produtos), Configurações (gerencia zonas de entrega)
- Admin auto-seedado: admin@marmita.com / admin123
- 36/36 testes de backend passando (20 regressão + 16 novos)
- 86/86 testes pytest passando (iterações 3, 4, 5)
- 102/102 testes pytest passando (iterações 3-6)
- Iteração 7: Acréscimo (surcharge) em pedidos, filtro por forma de pagamento específica, ícones coloridos para cada método (PaymentIcon + PaymentBadge), contagem por método nos relatórios
- Iteração 5: GET /api/day/status + POST /api/day/close para fechar pedidos em aberto do período e gerar relatório
- Iteração 4: PUT /api/orders/{id} usado para edição completa; POST /api/customers exige telefone
- Frontend: filtros Pagos/Pendentes e Entrega/Retirada em Pedidos, botão "Finalizar dia" com relatório no Dashboard, edição de pedidos via botão lápis, itens visíveis direto na lista
- Iteração 9: IA Gemini 3 Flash (Emergent LLM Key) — gerador de descrição de produto, insights em relatórios, parse de texto do cliente em pedido estruturado
- Iteração 10 (2026-02): **Modo Voz** em Pedidos — reconhecimento de voz nativo do navegador (pt-BR) com animação de microfone pulsante, transcrição em tempo real editável, retorno em TTS (SpeechSynthesis) confirmando o pedido interpretado. Reutiliza `/api/ai/parse-order`.
- Iteração 11 (2026-02): **Modo Balcão** (hands-free) em Pedidos — dialog fullscreen com escuta contínua e auto-restart, comandos de voz "confirmar/salvar" (parseia + cria pedido), "cancelar/limpar" (reseta), "sair do balcão" (encerra). Cada pedido salvo é confirmado por TTS ("Pedido salvo. Cliente X. Total Y reais. Pode falar o próximo."). Painel lateral com histórico da sessão e total acumulado. Suporte a `hideClose` adicionado em `dialog.jsx`.
- Iteração 12 (2026-02): **Palavra de Ativação (Wake Word)** + **Botão Flutuante Global**. Wake words: "olá marmita", "ola marmita", "oi marmita", "novo pedido", "hey marmita". Modo dormente com ícone de lua até despertar. Toggle Wake ON/OFF no header. Após salvar pedido, volta pro dormente aguardando próximo cliente. Botão flutuante circular no canto inferior direito de todas as páginas autenticadas via `CounterModeContext` + `FloatingCounterButton` montado no Layout.
- Iteração 13 (2026-02): **Fixes do Modo Balcão**: (a) erro `insertBefore` do React resolvido — FAB agora usa `createPortal(document.body)` + visibility CSS em vez de desmontar (evita conflito com Portal do Radix Dialog); (b) **duplicação de pedidos** eliminada — `handleConfirm` tinha side-effect dentro de `setTranscript((prev)=>{...})`, o que causava dupla invocação no React 18 StrictMode. Agora computa `combined` via `transcriptRef.current` fora do updater + guarda `if (processingRef.current) return;`; (c) **TTS padrão OFF** — a voz sintetizada default era feia. Adicionado feedback visual grande em pílula colorida (verde/vermelho/âmbar/preto) via `showFeedback()` no topo da tela; (d) Melhor seleção de voz quando ligada (prefere Google/Microsoft/natural).
- Iteração 14 (2026-02): **Sistema de impressão térmica** integrado. Novo `/app/frontend/src/lib/print.js` com `printReceipt(order)` que gera cupom 80mm formatado num iframe oculto e chama `window.print()`. Toggle **Auto-imprimir** persistente via localStorage. Integrações: (a) Card "Impressão de cupom" em Configurações com toggle ON/OFF e botão "Imprimir cupom de teste"; (b) Toggle **Imprimir ON/OFF** no header do Modo Balcão; (c) Auto-print acionado após salvar pedido tanto em Modo Balcão quanto no fluxo normal; (d) Item "Imprimir cupom" no dropdown de cada pedido para reimprimir manualmente. Testado 100% pelo testing_agent (iteration_11).
- Iteração 15 (2026-02): **Causa raiz do erro `insertBefore` no Modo Balcão** encontrada e corrigida — havia **2 FloatingCounterButton** montados simultaneamente (um em Layout, outro renderizado durante StrictMode double-invoke). Consolidação: FAB agora é renderizado APENAS dentro de `CounterModeProvider`, garantindo instância única. `printReceipt` também isolado em container dedicado + defer via rAF pra não conflitar com portals do Radix/Sonner. **Contador de Produção (Cozinha)** adicionado no topo de Pedidos — mostra quantos de cada produto ainda faltam fazer (soma de Novo + Em Preparo), agrupado por produto, com pills por status e resumo de adicionais. Card colapsável, some quando não há nada pendente. Testado 100% (iteration_12).
- Iteração 16 (2026-02): **Real bug do Modo Balcão finalmente corrigido**. O erro que o usuário via após confirmar o pedido era `TypeError: BRL is not a function` — `BRL` é `Intl.NumberFormat` (objeto com `.format()`) e não callable. 4 chamadas erradas em `CounterModeDialog.jsx` corrigidas de `BRL(v)` para `BRL.format(v)`.
- Iteração 17 (2026-02): **Pareamento de impressora Bluetooth**. Novo `/app/frontend/src/lib/bluetooth-printer.js` implementa Web Bluetooth API + ESC/POS: `pairPrinter()`, `getPairedPrinter()`, `clearPairedPrinter()`, `printViaBluetooth()`. Suporte a impressoras térmicas Xprinter/Elgin/MP-4200/MTP etc via GATT services conhecidos. Envio ESC/POS em chunks de 100 bytes (BLE MTU). Fallback automático pro diálogo do navegador se BT falhar ou não estiver pareado. UI de pareamento em Configurações com botões "Parear impressora" / "Desconectar" + instruções passo-a-passo.
- Iteração 18 (2026-02): **Formato do cupom alterado para 58mm** (era 80mm). CSS do template HTML atualizado: `@page size: 58mm auto`, `body width: 54mm`, fontes proporcionais reduzidas. ESC/POS Bluetooth já usava 32 chars (padrão 58mm). Testado 100% (iteration_14).
- Deployment em produção verificado saudável pelo deployer agent — bundle 200, APIs 200, env vars OK. Tela branca reportada pelo usuário foi cache do edge/navegador logo após promote.

## Backlog
### P1
- Integração de pagamento online (Stripe) opcional
- Impressão de comanda / recibo
- WhatsApp/SMS notification para cliente
- Upload de imagem para produto (object storage)

### P2
- Multi-usuário por marmitaria (papéis: atendente, cozinha, entregador)
- Cardápio público com pedidos via link
- Cupons de desconto
- Estoque/insumos
- Dashboard mobile-first (PWA)

## Next Tasks
- Validar fluxo de Google Login com sessão real
- Considerar testes E2E de frontend
