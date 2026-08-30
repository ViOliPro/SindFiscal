# Requisitos Não Funcionais — Sistema de Gestão Financeira e Administrativa para Síndico Profissional

> Este documento faz parte de um conjunto de 4 arquivos: [Especificações](./especificacoes.md) · [Requisitos Funcionais](./requisitos-funcionais.md) · **Requisitos Não Funcionais** (este documento) · [Matriz de Rastreabilidade](./matriz-rastreabilidade.md).

## Sumário

1. [Requisitos Não Funcionais (RNF01–RNF15)](#1-requisitos-não-funcionais)

---

## 1. Requisitos Não Funcionais

**RNF01 — Segurança.** Autenticação obrigatória para todos os perfis de usuário; proteção de dados financeiros sensíveis; controle de acesso por papel.

**RNF02 — Controle de acesso.** Permissões granulares por usuário, condomínio e módulo (visualizar/editar), configuráveis exclusivamente pelo síndico/administrador.

**RNF03 — Isolamento.** Dados financeiros, necessidades, compromissos e documentos isolados por condomínio; apenas fornecedores e usuários são compartilhados entre os condomínios de um mesmo síndico.

**RNF04 — Auditoria.** Toda alteração em dados financeiros ou decisões deve ser rastreável (quem, quando, o quê mudou), independentemente do tamanho da equipe que opera o sistema.

**RNF05 — Integridade.** Uma decisão aprovada não pode ser sobrescrita silenciosamente; os indicadores do painel devem ser sempre matematicamente consistentes entre si.

**RNF06 — Histórico.** Alterações de escopo pós-aprovação, decisões e mudanças de status de compromissos devem preservar o estado anterior, não apenas o atual.

**RNF07 — Consistência.** O saldo disponível e os indicadores derivados devem refletir de forma unificada e sem duplicidade os lançamentos reais e os compromissos financeiros, mesmo quando a fonte dos lançamentos variar entre condomínios (manual ou via integração) — nenhum valor pode ser contado duas vezes entre um pagamento registrado no sistema e o lançamento real correspondente.

**RNF08 — Disponibilidade.** O sistema deve estar disponível para consulta e registro sempre que o síndico ou sua equipe precisarem, dado seu papel de substituir o controle manual atual.

**RNF09 — Backup.** Dados financeiros e de decisão devem ter backup periódico e mecanismo de recuperação, dado o custo de negócio de uma eventual perda.

**RNF10 — Desempenho.** Consultas de saldo, dashboard e relatórios devem responder em tempo hábil mesmo com o crescimento do número de condomínios administrados (18 atualmente, com tendência de expansão).

**RNF11 — Escalabilidade.** O modelo de dados deve suportar o crescimento do número de condomínios, contas, fornecedores e usuários sem redesenho estrutural.

**RNF12 — Manutenibilidade.** A lógica de negócio (cálculo de saldo, fila de execução, conciliação, gastos vinculados, área de acerto) deve ser centralizada e não duplicada entre módulos, facilitando ajustes de regras ao longo do tempo.

**RNF13 — Independência de integração.** O sistema não deve depender de nenhuma administradora ou API específica para funcionar; deve operar de forma plenamente funcional em modo 100% manual, incorporando integrações externas como uma capacidade opcional e plugável por condomínio.

**RNF14 — Auditoria imutável.** Um evento de auditoria (RF19), uma vez registrado, não pode ser alterado ou removido, mesmo por usuários com permissão de edição sobre os dados originais.

**RNF15 — Usabilidade.** Fluxos de uso frequente (registro de gasto vinculado, checklist de transferência manual, aprovação de compromisso) devem ser simples o suficiente para uso recorrente por uma equipe pequena, sem exigir treinamento extenso.
