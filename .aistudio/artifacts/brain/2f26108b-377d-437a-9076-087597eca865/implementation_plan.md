# Conexão Real e Nativa com WhatsApp via Baileys

Substituição total de qualquer método simulado ou instantâneo por uma integração 100% nativa do `@whiskeysockets/baileys` rodando diretamente no servidor Express do Marmita Hub, gerando QR Code oficial e código de pareamento autênticos sem necessidade de comandos de terminal.

## Decisões Críticas e Alinhamento

> [!IMPORTANT]
> **Eliminação Completa de Conexões Falsas/Simuladas**:
> 1. Remoção definitiva dos botões *"Conectar Imediatamente (1 Clique)"*, *"Simular Conexão"* e rotas de confirmação manual (`/simulate-scan` e `/confirm-connection`).
> 2. A conexão somente transitará para o estado **"Conectado e Ativo"** quando o servidor Baileys receber o evento oficial `connection === 'open'` emitido pelo próprio protocolo do WhatsApp após a leitura real do QR Code (ou após a validação do código de pareamento no celular).

---

## 1. Visão Geral da Solução

O usuário acessará a aba **WhatsApp** na interface do Marmita Hub e terá um fluxo direto, sem terminal:
1. Clica no botão **"Gerar QR Code do WhatsApp"**.
2. O servidor inicia uma sessão autêntica via `@whiskeysockets/baileys` conectada aos servidores oficiais do WhatsApp.
3. O payload bruto do QR Code recebido no evento `connection.update` do Baileys é convertido em imagem DataURL e exibido na tela.
4. O usuário abre o WhatsApp no smartphone (`Aparelhos Conectados > Conectar um aparelho`) e aponta a câmera para a tela.
5. O Baileys conclui o handshake criptográfico, emite `connection: 'open'`, salva a sessão em disco e atualiza o status para `connected`.
6. A interface detecta automaticamente a conexão (via polling de status em tempo real) e exibe o número autenticado, sem necessidade de cliques adicionais.
7. Alternativamente, caso o usuário prefira código sem câmera, pode gerar o código oficial de 8 dígitos requisitado diretamente pelo Baileys via `sock.requestPairingCode()`.

---

## 2. Experiência do Usuário (UI/UX)

### Fluxo na Interface:
- **Estado Desconectado**:
  - Exibição de explicação clara de pareamento oficial do WhatsApp Web / Multi-Device.
  - Botão principal: **"Gerar QR Code de Conexão"**.
  - Opção secundária: **"Conectar com Código de 8 Dígitos (Telefone)"**.
  - **Zero botões fictícios**: nenhum botão de confirmação manual ou atalho falso.
- **Estado Aguardando Leitura (Connecting)**:
  - Exibição do QR Code autêntico em alta resolução com contador/indicador de atualização caso o WhatsApp solicite novo código.
  - Spinner sutil e mensagem: *"Aguardando leitura do QR Code pelo WhatsApp do celular..."*.
  - Polling a cada 2 segundos no endpoint `/api/whatsapp/baileys/status`.
- **Estado Conectado (Open)**:
  - Card verde de sucesso exibindo o número oficial autenticado retornado pelo Baileys (`sock.user.id`).
  - Indicação de que a IA está ativa e pronta para receber pedidos reais.
  - Botão **"Desconectar Aparelho"** para encerrar a sessão real e limpar credenciais quando desejado.

---

## 3. Decisões Técnicas e Arquitetura

```
┌────────────────────────────────────────────────────────┐
│                   Navegador (React)                    │
│   - WhatsAppChat.jsx (Aba Conexão)                     │
│   - Exibe QR Code Real (DataURL) gerado pelo Baileys   │
│   - Polling automático a cada 2s do status de conexão  │
└───────────────────────────┬────────────────────────────┘
                            │ HTTP GET / POST
┌───────────────────────────▼────────────────────────────┐
│              Servidor Express (server.ts)              │
│   - Rota /api/whatsapp/baileys/connect                 │
│   - Rota /api/whatsapp/baileys/status                  │
│   - Rota /api/whatsapp/baileys/pairing-code            │
│   - Rota /api/whatsapp/baileys/disconnect              │
└───────────────────────────┬────────────────────────────┘
                            │ Eventos WebSocket
┌───────────────────────────▼────────────────────────────┐
│         Motor Baileys (@whiskeysockets/baileys)        │
│   - makeWASocket() com useMultiFileAuthState           │
│   - Evento connection.update (QR / Open / Close)       │
│   - Armazenamento de credenciais em data/baileys_auth  │
└───────────────────────────┬────────────────────────────┘
                            │ Noise Protocol / TLS
┌───────────────────────────▼────────────────────────────┐
│             Servidores Oficiais do WhatsApp            │
│                 (web.whatsapp.com / WSS)               │
└────────────────────────────────────────────────────────┘
```

### Alterações Principais:

1. **`server.ts`**:
   - Manter o socket Baileys ativo e persistente no processo Express.
   - Usar `useMultiFileAuthState(path.join(DATA_DIR, "baileys_auth", userId))`.
   - Garantir que o socket use a configuração nativa padrão do Baileys para conexão estável com o WhatsApp.
   - Capturar o `update.qr` exato e transformá-lo em QR Code para a UI.
   - No evento `connection === 'open'`, registrar `status: 'connected'` e o telefone real do usuário autenticado (`sock.user.id`).
   - Remover as rotas `/confirm-connection` e `/simulate-scan`.
   - No encerramento (`disconnect`), realizar `sock.logout()`, remover arquivos da pasta de autenticação e definir `status: 'disconnected'`.

2. **`src/pages/WhatsAppChat.jsx` e Contexto**:
   - Remover qualquer botão ou chamada para `confirmConnection` ou `simulateBaileysScan`.
   - Atualizar a interface para focar exclusivamente no QR Code real e no código de pareamento oficial.
   - Adicionar polling ativo enquanto o status for `connecting` para transição automática quando o celular escanear.

3. **Validação**:
   - Testar o ciclo de vida completo do QR Code via build e rotas do servidor.
   - Verificar compilação limpa com `compile_applet`.
