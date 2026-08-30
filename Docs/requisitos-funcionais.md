# Requisitos Funcionais — Sistema de Gestão Financeira e Administrativa para Síndico Profissional

> Este documento faz parte de um conjunto de 4 arquivos: [Especificações](./especificacoes.md) · **Requisitos Funcionais** (este documento) · [Requisitos Não Funcionais](./requisitos-nao-funcionais.md) · [Matriz de Rastreabilidade](./matriz-rastreabilidade.md).

Cada requisito descreve uma capacidade de negócio. A forma de implementação (telas, endpoints, tecnologia) não é definida aqui.

## Sumário

1. [Requisitos Funcionais (RF01–RF21)](#1-requisitos-funcionais)
   - [1.1 Lista definitiva de módulos para permissões (RF03)](#11-lista-definitiva-de-módulos-para-permissões-rf03)

---

## 1. Requisitos Funcionais

**RF01 — Autenticação.** O sistema deve permitir que Síndico, Colaboradores e Conselheiros Fiscais se autentiquem individualmente, com sessão própria.

**RF02 — Condomínios.** O sistema deve permitir cadastrar condomínios administrados por um síndico, cada um com seus próprios dados, contas bancárias e configuração de integração (RF15).

**RF03 — Usuários e permissões.** O sistema deve permitir que o síndico/administrador cadastre colaboradores e conceda, a cada um, permissão de visualizar ou editar, por condomínio e por módulo funcional (ex.: um colaborador pode editar Cotações no Condomínio A e apenas visualizar Pagamentos no Condomínio B). A lista definitiva de módulos para fins de permissão está detalhada na Seção 1.1.

**RF04 — Contas e fundos.** O sistema deve permitir cadastrar múltiplas contas bancárias/fundos por condomínio, cada uma com finalidade (ordinário/rateio, extraordinário, fundo de reserva, fundo de trabalho, fundos de áreas específicas etc.) e saldo próprio. Uma delas pode ser marcada como conta operacional — a conta física que a administradora efetivamente movimenta na prática (tipicamente a conta corrente). Um fundo pode, opcionalmente, ter uma regra de aporte periódico (valor fixo ou percentual, com teto máximo opcional).

**RF05 — Lançamentos.** O sistema deve permitir registrar lançamentos financeiros reais (entrada/saída) vinculados à conta bancária onde o dinheiro efetivamente esteve (na prática, quase sempre a conta operacional). A origem do lançamento pode ser manual (digitado pela equipe) ou proveniente de integração externa (RF15), conforme a configuração do condomínio (RF02). Lançamentos reais devem ser mantidos claramente separados de lançamentos simulados (RF16).

**RF06 — Necessidades.** O sistema deve permitir registrar uma necessidade/previsão (descrição, categoria, prioridade, responsável e texto de escopo do serviço), acompanhando seu estágio em um ciclo de vida único.

**RF07 — Cotações.** O sistema deve permitir registrar qualquer quantidade de cotações vinculadas a uma necessidade, cada uma associada a um fornecedor, com valor, prazo, garantia, condições de pagamento e validade, e comparação automática entre elas.

**RF08 — Fornecedores.** O sistema deve permitir cadastrar fornecedores como entidade do síndico, compartilhada entre todos os seus condomínios, organizados por categoria, com documentação opcional e avaliação no formato de estrelas (nota de 1 a 5) acompanhada de um campo de comentário em texto livre.

**RF09 — Decisões.** O sistema deve permitir registrar uma decisão (aprovar, reprovar, adiar) sobre uma necessidade, como evento histórico — com responsável, data, justificativa e referência de respaldo (ata/assembleia). Alterações de escopo pós-aprovação devem gerar novo registro, preservando o original.

**RF10 — Compromissos.** O sistema deve permitir gerar um compromisso financeiro a partir de uma decisão de aprovação (ou registrá-lo avulso, sem necessidade formal), com valor aprovado, categoria e status; o valor de alçada que exige validação do Conselho Fiscal deve ser configurável por condomínio.

**RF11 — Pagamentos.** O sistema deve permitir registrar um ou mais pagamentos por compromisso (entrada, adiantamento, parcela, total), com saldo remanescente calculado automaticamente, vínculo (reconciliação) com o lançamento real correspondente quando existir, e indicação do fundo responsável pelo pagamento — que pode ser diferente da conta onde o dinheiro efetivamente saiu (RF14).

**RF12 — Gastos vinculados.** O sistema deve permitir vincular um gasto avulso (ex.: compra de material durante uma obra) a um compromisso "pai", sem exigir que este tenha um valor total fixo definido antecipadamente; deve ser possível visualizar tanto o valor originalmente orçado quanto a soma efetiva dos gastos filhos vinculados.

**RF13 — Fila de execução.** O sistema deve permitir organizar compromissos aprovados que aguardam disponibilidade de caixa em uma fila priorizada, reordenável manualmente pelo síndico. Nesta fase, não há critério automático de priorização — a definição de um critério assistido (por urgência, categoria, valor etc.) fica para uma etapa futura, depois que o uso real revelar quais cenários realmente importam.

**RF14 — Transferências (área de acerto).** O sistema deve manter uma área de acerto que lista as transferências pendentes entre a conta operacional e os fundos de um mesmo condomínio. Por padrão, cada pendência é listada de forma individual (uma linha por gasto/lançamento) — o síndico pode, a qualquer momento, selecionar e agrupar itens para executar como uma transferência única (soma), conforme lhe for mais prático a cada condomínio. Cada item de acerto deve indicar um motivo:

- **(a) reposição** — o fundo responsável por um ou mais pagamentos (RF11) divergiu da conta onde o dinheiro efetivamente saiu, tipicamente a conta operacional (RF04), e precisa ser reembolsado;
- **(b) aporte** — transferência periódica e discricionária da conta operacional para um fundo, conforme a regra de aporte do fundo (RF04), podendo ser adiada ou compensada em período seguinte, sem gerar pendência obrigatória;
- **(c) destinação de receita** — um valor recebido na conta operacional pertence, no todo ou em parte, a um fundo específico (ex.: receita vinculada a uma reserva de área comum, RF21) e precisa ser transferido para ele.

Quando houver integração disponível (RF15), a transferência pode ser executada diretamente por ela; quando não, o síndico acompanha a lista, executa manualmente no site da administradora e marca cada item como realizado, atualizando os saldos dos fundos no sistema.

**RF15 — Integrações.** O sistema deve permitir configurar, por condomínio, se há integração disponível com o sistema de sua administradora, e, quando houver, consumir uma API externa para buscar lançamentos reais (RF05) e, quando suportado, executar transferências (RF14). A integração deve ser tratada de forma agnóstica e plugável, sem acoplamento a um fornecedor específico. **Decisão de projeto:** nenhuma integração será implementada nesta primeira versão — todos os condomínios operam em modo manual até esta versão estar funcionando; o levantamento de custo e cobertura de API por administradora será estudado e implementado em uma fase posterior.

**RF16 — Simulações.** O sistema deve permitir simular a aprovação/execução de compromissos com diferentes formas de pagamento e visualizar o impacto projetado no caixa dos meses seguintes, sem afetar os lançamentos reais.

**RF17 — Dashboard.** O sistema deve apresentar indicadores de posição de caixa, comprometimento, fila de execução e alertas, recalculados automaticamente a partir dos dados registrados.

**RF18 — Relatórios.** O sistema deve permitir gerar relatório de prestação de contas parametrizável por período (mês, ano ou período livre), além dos demais relatórios de valor confirmado no levantamento de requisitos (v3, Seção 12).

**RF19 — Auditoria.** O sistema deve registrar automaticamente quem criou ou alterou cada registro financeiro ou de decisão, quando, e quais valores mudaram.

**RF20 — Documentos (referência textual).** Nesta fase, o sistema não realiza upload/anexo de arquivos. Em vez disso, deve permitir registrar uma referência textual de documento (ex.: número da nota fiscal, descrição do comprovante, número da ata) vinculada a registros específicos, servindo como anotação de apoio. O upload real de arquivos fica para uma versão futura.

**RF21 — Reservas de área comum.** O sistema deve permitir registrar, para cada área comum com fundo próprio (ex.: espaço gourmet), quem reservou, o quê e quando — sem reproduzir o próprio aplicativo de reservas usado pelos moradores (hoje, o CondoMob, que continua sendo o canal onde o morador efetivamente reserva). O registro no sistema é feito pela síndica, com base na lista que ela já levanta periodicamente (hoje, por volta do dia 25 de cada mês) para repassar à administradora. Cada reserva registrada deve conter: unidade/apartamento, nome do morador, valor destinado ao fundo (o valor "líquido" da reserva, ex.: R$ 250 — não o valor bruto cobrado no boleto, que pode ser maior para acomodar o desconto de pontualidade) e se o pagamento ocorreu com desconto de pontualidade (sim/não, apenas informativo). O valor destinado ao fundo não muda em função do desconto — o sistema sempre soma o valor líquido de cada reserva do período para compor o item de destinação de receita na área de acerto (RF14), quando o boleto for pago e o valor cair na conta operacional.

### 1.1 Lista definitiva de módulos para permissões (RF03)

Cada módulo abaixo pode receber, por colaborador e por condomínio, o nível **visualizar** ou **editar** (RF03). Módulos marcados como "exclusivo do síndico" não são delegáveis a colaboradores nesta fase, por envolverem configuração administrativa do próprio condomínio ou do acesso de terceiros. O módulo de Auditoria é sempre somente leitura, mesmo para quem tiver "editar" concedido em outros módulos — não existe "editar auditoria".

| #   | Módulo                                         | RFs cobertos           | Delegável a colaborador?                                 |
| --- | ---------------------------------------------- | ---------------------- | -------------------------------------------------------- |
| 1   | Contas e Lançamentos                           | RF04, RF05             | Sim (visualizar ou editar)                               |
| 2   | Necessidades, Cotações e Fornecedores          | RF06, RF07, RF08       | Sim (visualizar ou editar)                               |
| 3   | Decisões e Compromissos                        | RF09, RF10, RF12       | Sim (visualizar ou editar)                               |
| 4   | Pagamentos e Fila de Execução                  | RF11, RF13             | Sim (visualizar ou editar)                               |
| 5   | Transferências / Área de Acerto                | RF14                   | Sim (visualizar ou editar)                               |
| 6   | Simulação de Caixa Futuro                      | RF16                   | Sim (visualizar ou editar)                               |
| 7   | Dashboard e Relatórios                         | RF17, RF18             | Sim (visualizar ou editar)                               |
| 8   | Documentos (referência textual)                | RF20                   | Sim (visualizar ou editar)                               |
| 9   | Reservas de Área Comum                         | RF21                   | Sim (visualizar ou editar)                               |
| 10  | Auditoria                                      | RF19                   | Somente leitura para todos — não delegável como "editar" |
| 11  | Condomínios, Usuários/Permissões e Integrações | RF01, RF02, RF03, RF15 | Não — exclusivo do síndico/administrador                 |
