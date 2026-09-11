# Relatório de Atendimentos

Aplicativo web para eletricistas industriais lançarem atendimentos por voz.
Você fala, por exemplo:

> "Fiz um atendimento na máquina 1, gastei quarenta minutos"

e o app calcula o horário (início/fim), identifica o setor/máquina e usa a
fala como descrição do que foi feito — tudo confirmável e editável antes de
salvar.

## Como usar

1. Abra `index.html` num navegador (de preferência **Chrome**, no celular ou
   no computador — é o que tem melhor suporte a reconhecimento de voz em
   português).
2. Toque no botão de microfone e fale o atendimento.
3. Confira/ajuste os campos (setor, início, fim, descrição) na tela de
   confirmação e toque em **Salvar atendimento**.
4. Os atendimentos do dia aparecem na lista, com o total de horas.
5. Use **Copiar relatório do dia** (ou **Baixar .txt**) para enviar o
   relatório por WhatsApp, e-mail etc.

Caso o microfone não funcione ou você prefira digitar, use a opção
**"Prefiro digitar"** — o mesmo interpretador de texto é usado.

### O que o app entende

- Duração: "quarenta minutos", "meia hora", "uma hora e meia", "20 minutos"...
- Horário explícito: "das seis da tarde até seis e meia", "das 14h às 14h40"...
- Local: "na máquina 1", "no setor X", "na linha 2", "no painel", "no CCM"...
- Se você disser "ontem", o atendimento é lançado no dia anterior.

Quando algo não é reconhecido, o campo fica em branco ou com um valor padrão
(horário atual) para você completar manualmente — a tela de confirmação
sempre aparece antes de salvar.

## Publicar para usar no celular

Não há backend: tudo roda no navegador e os dados ficam salvos localmente
(no `localStorage` daquele navegador/dispositivo). Para acessar por uma URL
no celular, publique como site estático, por exemplo com o GitHub Pages:

1. No repositório, vá em **Settings → Pages**.
2. Em "Source", selecione a branch (ex.: `main`) e a pasta raiz (`/`).
3. Salve e acesse a URL gerada pelo GitHub no navegador do celular.
4. Você pode "Adicionar à tela inicial" para abrir como um app.

## Limitações

- O reconhecimento de voz (Web Speech API) depende do navegador — funciona
  bem no Chrome; pode não funcionar no Firefox ou em navegadores in-app.
- Os dados são salvos apenas no dispositivo/navegador usado (sem sincronização
  entre aparelhos ou backup na nuvem).
- A interpretação de texto é heurística; frases fora dos padrões acima podem
  precisar de ajuste manual — por isso a tela de confirmação existe.
