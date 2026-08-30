# Especificações — Sistema de Gestão Financeira e Administrativa para Síndico Profissional

> Este documento faz parte de um conjunto de 4 arquivos: **Especificações** (este documento) · [Requisitos Funcionais](./requisitos-funcionais.md) · [Requisitos Não Funcionais](./requisitos-nao-funcionais.md) · [Matriz de Rastreabilidade](./matriz-rastreabilidade.md).
>
> Complementa o Levantamento de Requisitos (v3), que traz o racional de negócio por trás de cada regra aqui formalizada.

---

## Sumário

1. [Introdução](#1-introdução)
2. [Escopo](#2-escopo)
3. [Atores](#3-atores)
4. [Regras de Negócio](#4-regras-de-negócio)
5. [Diagrama de Casos de Uso](#5-diagrama-de-casos-de-uso)
6. [Diagrama de Classes](#6-diagrama-de-classes)
7. [Diagrama Entidade-Relacionamento (DER)](#7-diagrama-entidade-relacionamento-der)
8. [Pontos em Aberto](#8-pontos-em-aberto)

---

## 1. Introdução

Este documento formaliza o entendimento de negócio consolidado ao longo de todas as rodadas de validação com o cliente, cobrindo: gastos vinculados a um compromisso "pai", uma área de acerto entre fundos e conta operacional (reposição, aporte periódico e destinação de receita), permissões granulares por usuário/condomínio/módulo, e a decisão de que a fonte de verdade dos lançamentos financeiros não é fixa — varia conforme o condomínio possuir ou não integração disponível com o sistema de sua administradora.

Nenhum nome de fornecedor de administradora aparece nos diagramas ou nos requisitos — a integração externa é tratada de forma agnóstica e configurável por condomínio, exatamente para não acoplar o sistema a um fornecedor específico.

Este documento pressupõe a leitura prévia do Levantamento de Requisitos (v3) para o racional de negócio por trás de cada regra; aqui, o objetivo é a formalização direta, pronta para orientar a modelagem técnica.

## 2. Escopo

### 2.1 Dentro do escopo

- Gestão financeira de despesas extraordinárias (obras, aquisições, serviços) para condomínios administrados por um síndico profissional.
- Operação multi-condomínio, com fornecedores compartilhados entre todos os condomínios de um mesmo síndico.
- Controle de múltiplas contas bancárias/fundos por condomínio, incluindo a distinção entre a conta operacional (a que a administradora efetivamente movimenta) e os fundos com finalidade própria (ordinário, extraordinário, fundo de reserva, fundo de trabalho, fundos de áreas específicas etc.).
- Ciclo completo de necessidade → cotação → decisão → compromisso financeiro → pagamento, incluindo pagamento parcelado, adiantamento e gastos vinculados ("filhos") a um compromisso "pai".
- Fila de execução priorizada para compromissos aprovados aguardando disponibilidade de caixa.
- Área de acerto entre a conta operacional e os fundos de um mesmo condomínio, cobrindo reposição, aporte periódico e destinação de receita — com apoio via checklist manual quando a administradora não oferecer integração automatizada.
- Permissões granulares, concedidas pelo síndico/administrador a colaboradores, por condomínio e por módulo do sistema.
- Integração opcional e configurável por condomínio com o sistema da administradora responsável, quando esta oferecer API — sem que o sistema dependa dela para funcionar.
- Simulação de caixa futuro, dashboard, relatórios de prestação de contas e auditoria/rastreabilidade das decisões e lançamentos.

### 2.2 Fora do escopo

- Despesas ordinárias recorrentes (portaria, limpeza, energia das áreas comuns etc.) — permanecem sob responsabilidade da administradora externa.
- Arrecadação e cobrança de taxas condominiais — permanecem sob responsabilidade da administradora externa.
- Qualquer acoplamento do sistema a uma administradora específica como fonte de verdade obrigatória — o sistema deve operar de forma plenamente funcional em modo 100% manual, tratando qualquer integração externa como uma capacidade opcional e plugável.
- Integrações com APIs de administradoras nesta primeira versão — decisão de projeto confirmada: todos os condomínios operam em modo manual inicialmente; o levantamento de custo e cobertura de API será estudado e implementado em uma fase posterior.

> **Decisão de escopo — fonte de verdade dos lançamentos**
> Não existe uma fonte de verdade única e obrigatória para os lançamentos financeiros reais. Cada condomínio pode ter uma configuração própria: (a) integração via API com o sistema de sua administradora, quando ela oferecer esse recurso, ou (b) operação manual, na qual o síndico e sua equipe registram e conciliam os lançamentos diretamente. O sistema deve ser agnóstico a qual administradora (ou nenhuma) está por trás dessa fonte — nenhum nome de fornecedor específico deve aparecer no modelo de dados.

## 3. Atores

| Ator                              | Natureza                            | Acesso                                                                                                            |
| --------------------------------- | ----------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| Síndico / Administrador           | Usuário interno do sistema          | Acesso pleno em todos os condomínios que administra; concede permissões a colaboradores; configura integrações.   |
| Colaborador (Equipe)              | Usuário interno do sistema          | Acesso concedido pelo síndico, por condomínio e por módulo, em nível de visualização ou edição.                   |
| Conselheiro Fiscal                | Usuário interno do sistema          | Somente leitura — dashboard, relatórios e auditoria.                                                              |
| Fornecedor                        | Entidade de dados, não usuário      | Não acessa o sistema; existe como cadastro (categoria, avaliação, documentação).                                  |
| Condômino                         | Não é ator do sistema nesta fase    | Sem acesso a nenhum dado do sistema.                                                                              |
| Assembleia                        | Referência, não ator                | Campo de referência em decisões (qual assembleia respaldou determinada aprovação); não interage com o sistema.    |
| Sistema Externo da Administradora | Ator externo (integração), opcional | Quando o condomínio tiver integração configurada, fornece lançamentos reais via API; não é um usuário do sistema. |

O nível de permissão de um Colaborador é definido pelo Síndico/Administrador individualmente, por condomínio e por módulo (ver [Requisitos Funcionais §1.1](./requisitos-funcionais.md#11-lista-definitiva-de-módulos-para-permissões-rf03)) — um colaborador pode, por exemplo, visualizar tudo em um condomínio mas apenas editar cotações e pagamentos em outro.

## 4. Regras de Negócio

Consolidação de todas as regras confirmadas ao longo do levantamento de requisitos.

### Fonte de verdade e integração

- **RN01** — A fonte de verdade dos lançamentos financeiros reais não é fixa: cada condomínio possui sua própria configuração, podendo ser manual ou via integração com o sistema de sua administradora, quando disponível.
- **RN02** — Quando não há integração disponível, cabe ao síndico (ou equipe) registrar manualmente os lançamentos reais e conciliá-los com os compromissos financeiros.
- **RN03** — O sistema não deve presumir que todos os condomínios administrados por um mesmo síndico compartilham a mesma fonte de verdade ou a mesma administradora.

### Fornecedores e cotações

- **RN04** — Fornecedor é uma entidade do síndico, compartilhada entre todos os condomínios administrados por ele — nunca isolada por condomínio.
- **RN05** — Uma cotação pode variar livremente em quantidade (1 a N) por necessidade; três cotações é apenas um padrão sugerido, não uma obrigatoriedade.
- **RN06** — Toda cotação deve referenciar um escopo de serviço comum, para garantir comparação justa entre propostas.

### Decisão e aprovação

- **RN07** — O valor de alçada de aprovação (a partir do qual é necessária validação do Conselho Fiscal) é configurável por condomínio, não padronizado.
- **RN08** — Despesas emergenciais podem pular etapas do fluxo (cotação prévia) e ser aprovadas/executadas primeiro, com justificativa e documentação anexada a posteriori.
- **RN09** — Um compromisso aprovado pode ter seu escopo alterado após a aprovação (ex.: troca de material), desde que a alteração seja registrada em histórico, preservando o que foi originalmente decidido.
- **RN10** — O valor final de um compromisso pode divergir do valor da cotação originalmente escolhida.

### Compromissos, gastos vinculados e fila de execução

- **RN11** — Um compromisso financeiro aprovado pode aguardar em uma fila de execução priorizada quando não há caixa disponível para todos os compromissos aprovados simultaneamente; a prioridade é definida e pode ser reordenada livremente pelo síndico. Nesta fase, a decisão de negócio é manter a priorização inteiramente manual, sem critério automático — a definição de um critério assistido fica para depois que o uso real revelar quais cenários de fato importam.
- **RN12** — Um compromisso aprovado pode ser cancelado ou adiado em favor de outro de maior prioridade, mesmo após aprovado.
- **RN13** — Um compromisso financeiro pode ter compromissos "filhos" vinculados (gastos avulsos executados durante a realização do compromisso "pai" — ex.: compra de material extra durante uma obra), sem que isso exija que o compromisso pai tenha um valor total fixo definido antecipadamente.
- **RN14** — O valor total de um compromisso "pai" pode ser acompanhado tanto pelo valor originalmente orçado/aprovado quanto pela soma efetiva dos gastos filhos vinculados a ele — ambos devem poder ser visualizados, já que podem divergir.
- **RN15** — Pode haver pagamentos avulsos, sem despesa aprovada formal associada.
- **RN16** — Um compromisso pode ser liquidado por múltiplos pagamentos (entrada, adiantamento, parcelas, pagamento total), com saldo remanescente calculado automaticamente.

### Área de acerto entre fundos e conta operacional

- **RN17** — Por padrão, as transferências entre a conta operacional e os fundos de um mesmo condomínio são listadas de forma individual (valor por gasto/lançamento); o síndico pode agrupar itens e executá-los como uma transferência única (soma) quando preferir. Não há uma regra fixa igual para todos os condomínios — o padrão individual dá ao síndico a liberdade de decidir, a cada condomínio e a cada momento, a forma mais prática de operar.
- **RN18** — Quando o condomínio possui integração via API com a administradora, a transferência entre contas pode ser executada diretamente pela integração; quando não, o sistema apoia o síndico com uma checklist manual (a "área de acerto") para acompanhar e confirmar cada transferência pendente, evitando perda de controle.
- **RN19** — A conta bancária onde um pagamento efetivamente ocorre (tipicamente a conta operacional, já que a administradora quase sempre movimenta por ela) pode ser diferente do fundo contabilmente responsável por aquele pagamento. Quando isso acontece, o sistema deve gerar automaticamente um item pendente de reposição na área de acerto, em vez de depender de anotação manual do síndico.
- **RN20** — Além da reposição, um fundo pode ter uma regra de aporte periódico (valor fixo ou percentual da receita, por exemplo) para se manter abastecido — mas esse aporte não é obrigatório em todo período: pode ser dispensado quando o fundo atinge seu teto máximo, ou adiado por decisão do síndico diante de uma emergência, sendo compensado em período posterior (inclusive com mais de um aporte no mesmo período de compensação). A regra de aporte (valor, percentual e teto) é definida individualmente por condomínio — não existe um padrão único aplicado a todos os condomínios administrados pelo síndico, do mesmo modo que a alçada de aprovação (RN07) também é configurável por condomínio.
- **RN21** — Quando um aporte periódico é adiado (RN20), o sistema deve manter um saldo acumulado de aporte pendente por fundo, em vez de multiplicar itens soltos na área de acerto a cada período pulado. No momento da compensação, o síndico decide se executa uma única transferência cobrindo o valor acumulado ou múltiplas transferências separadas — a mesma flexibilidade de total ou individual já prevista para reposição (RN17).
- **RN22** — Receitas recebidas na conta operacional que pertencem, no todo ou em parte, a um fundo específico (ex.: aluguel de área comum cobrado junto da taxa de condomínio) também geram um item de destinação de receita na área de acerto, transferindo o valor correspondente da conta operacional para o fundo.
- **RN23** — O valor de uma reserva de área comum destinado ao fundo é fixo, definido no momento da reserva, e não varia em função de o morador ter pago ou não com desconto de pontualidade — o valor a transferir para o fundo é sempre o valor líquido da reserva, somado ao longo do período.
- **RN24** — Um item da área de acerto tem, no mínimo, três status possíveis: sem necessidade de ajuste (fundo responsável e conta de saída/entrada coincidem), pendente de ajuste (divergem e aguardam transferência manual ou automática) e ajustado (a transferência já foi confirmada pelo síndico ou executada pela integração).

### Escopo e limites

- **RN25** — Despesas ordinárias recorrentes (fixas, mensais) são de responsabilidade da administradora externa e não são geridas por este sistema.
- **RN26** — A cobrança/arrecadação de taxas condominiais é de responsabilidade da administradora externa e não é gerida por este sistema.
- **RN27** — Existem dois tipos de arrecadação com naturezas distintas: ordinária (rateio comum) e extraordinária (cobrada à parte para melhorias específicas do prédio) — os recursos devem ser segmentados por finalidade, e não tratados como um único saldo livre.
- **RN28** — Contratos de longo prazo não precisam de modelagem própria (vigência/reajuste) nesta fase — apenas lançamento recorrente mês a mês, com possibilidade de replicação automática como conveniência.

### Acesso e permissões

- **RN29** — O síndico/administrador pode conceder a cada colaborador permissões diferenciadas (visualizar ou editar), por condomínio e por módulo — um mesmo colaborador pode ter níveis de acesso diferentes em condomínios diferentes.
- **RN30** — O Conselho Fiscal tem acesso somente leitura ao sistema; fornecedores e condôminos não têm acesso.

### Auditoria e integridade

- **RN31** — Toda alteração em dados financeiros e decisões deve gerar um registro de auditoria imutável (quem, quando, o quê mudou), mesmo quando feita por uma equipe pequena e de confiança.
- **RN32** — Estornos e devoluções devem ser tratados como eventos vinculados ao lançamento original, nunca como lançamentos soltos e independentes.

## 5. Diagrama de Casos de Uso

Os casos de uso são apresentados em nível de módulo (agrupando os RFs correlatos), para manter o diagrama legível. O detalhamento de cada capacidade está nos [Requisitos Funcionais](./requisitos-funcionais.md).

![Diagrama de Casos de Uso](./diagrams/usecase_diagram.png)

_Figura 1 — Diagrama de Casos de Uso (agrupado por módulo)_

## 6. Diagrama de Classes

Diagrama conceitual de domínio — atributos-chave apenas, sem decisões de tipos de dados, chaves técnicas ou tecnologia de persistência.

![Diagrama de Classes](./diagrams/class_diagram.png)

_Figura 2 — Diagrama de Classes (conceitual)_

## 7. Diagrama Entidade-Relacionamento (DER)

Modelo conceitual de entidades e relacionamentos, com cardinalidades. Observação importante: nenhuma administradora específica aparece no modelo — a entidade `CONFIG_INTEGRACAO` abstrai a existência (ou não) de uma integração externa por condomínio, sem acoplar o modelo a um fornecedor determinado (RN01–RN03).

![Diagrama Entidade-Relacionamento](./diagrams/der_diagram.png)

_Figura 3 — Diagrama Entidade-Relacionamento (conceitual)_

## 8. Pontos em Aberto

Todos os pontos levantados ao longo das rodadas de validação foram resolvidos.

> **Resolvido em rodadas anteriores**
> A regra de aporte por fundo não é padronizada entre condomínios — cada condomínio define a sua própria regra (RN20). Um aporte adiado é acumulado como saldo pendente por fundo, não como múltiplos itens soltos (RN21). Transferências: padrão sempre individual, com opção de agrupar/somar (RN17). Fila de execução: manual nesta fase, sem critério automático (RN11). Documentos: apenas referência textual, sem upload nesta versão. Formalização da aprovação do Conselho Fiscal: não necessária nesta fase. Lista definitiva de módulos para permissão: incorporada nos [Requisitos Funcionais §1.1](./requisitos-funcionais.md#11-lista-definitiva-de-módulos-para-permissões-rf03). Detalhamento do módulo de Reservas de Área Comum: definido, com base no fluxo real via CondoMob (RN23).
>
> **Resolvido na última rodada**
> Avaliação de fornecedor: formato de estrelas (nota de 1 a 5) acompanhado de campo de comentário em texto livre. Custo e cobertura de API por administradora: confirmado como decisão de projeto — nenhuma integração entra nesta primeira versão; todos os condomínios operam em modo manual, e o levantamento de custo/cobertura de API será estudado e implementado em uma fase posterior, depois que esta versão estiver funcionando.

Não há, neste momento, pontos em aberto pendentes de resposta do cliente. Novos pontos podem surgir naturalmente durante a modelagem técnica (banco de dados, arquitetura, desenho de telas) — quando isso acontecer, devem ser registrados e resolvidos com o mesmo rigor aplicado nas rodadas anteriores, antes de seguir adiante.

---

### Encerramento

Este documento formaliza o entendimento de negócio consolidado ao longo de todas as rodadas de validação com o cliente. Com os pontos em aberto resolvidos, o conjunto de documentos (Especificações, Requisitos Funcionais, Requisitos Não Funcionais e Matriz de Rastreabilidade) está pronto para orientar a etapa seguinte: **modelagem técnica e decisões de arquitetura** (banco de dados, APIs, tecnologia) — nenhuma dessas decisões foi tomada neste documento.
