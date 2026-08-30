# Matriz de Rastreabilidade — Sistema de Gestão Financeira e Administrativa para Síndico Profissional

> Este documento faz parte de um conjunto de 4 arquivos: [Especificações](./especificacoes.md) · [Requisitos Funcionais](./requisitos-funcionais.md) · [Requisitos Não Funcionais](./requisitos-nao-funcionais.md) · **Matriz de Rastreabilidade** (este documento).

## Sumário

1. [Matriz de Rastreabilidade](#1-matriz-de-rastreabilidade)
2. [Cobertura](#2-cobertura)

---

## 1. Matriz de Rastreabilidade

Liga cada Requisito Funcional às Regras de Negócio que o governam, aos Requisitos Não Funcionais mais relevantes, às entidades correspondentes nos diagramas (ver [Especificações §§5–7](./especificacoes.md)) e ao módulo de permissão (ver [Requisitos Funcionais §1.1](./requisitos-funcionais.md#11-lista-definitiva-de-módulos-para-permissões-rf03)).

Regras de Negócio e Requisitos Não Funcionais de caráter transversal (ex.: RNF04 Auditoria, RNF13 Independência de integração) aplicam-se a múltiplos RFs mesmo quando não listados explicitamente em todas as linhas — aqui estão indicados apenas os vínculos mais diretos.

| RF | RNs relacionadas | RNFs relacionadas | Entidades principais | Módulo |
|---|---|---|---|---|
| RF01 — Autenticação | — | RNF01, RNF02 | Usuario | 11 |
| RF02 — Condomínios | RN03 | RNF03, RNF11 | Condominio | 11 |
| RF03 — Usuários e permissões | RN29, RN30 | RNF02 | Usuario, Permissao | 11 |
| RF04 — Contas e fundos | RN20, RN21, RN27 | RNF03, RNF07, RNF11 | ContaBancaria | 1 |
| RF05 — Lançamentos | RN01, RN02, RN03, RN32 | RNF07, RNF13 | Lancamento | 1 |
| RF06 — Necessidades | RN08 | RNF06 | Necessidade | 2 |
| RF07 — Cotações | RN04, RN05, RN06 | — | Cotacao, Fornecedor | 2 |
| RF08 — Fornecedores | RN04 | — | Fornecedor | 2 |
| RF09 — Decisões | RN07, RN08, RN09, RN10 | RNF05, RNF06 | Decisao | 3 |
| RF10 — Compromissos | RN07, RN11, RN12, RN25, RN26 | RNF05, RNF06 | CompromissoFinanceiro | 3 |
| RF11 — Pagamentos | RN15, RN16, RN19 | RNF07 | Pagamento, Lancamento | 4 |
| RF12 — Gastos vinculados | RN13, RN14 | RNF06 | CompromissoFinanceiro (pai/filho) | 3 |
| RF13 — Fila de execução | RN11, RN12 | RNF15 | CompromissoFinanceiro | 4 |
| RF14 — Transferências (área de acerto) | RN17, RN18, RN19, RN20, RN21, RN22, RN23, RN24 | RNF07, RNF12, RNF13 | Transferencia, ContaBancaria | 5 |
| RF15 — Integrações | RN01, RN02, RN03 | RNF13 | ConfiguracaoIntegracao | 11 |
| RF16 — Simulações | — | RNF07 | Lancamento (simulado) | 6 |
| RF17 — Dashboard | — | RNF05, RNF10 | (indicadores derivados) | 7 |
| RF18 — Relatórios | — | RNF10 | (indicadores derivados) | 7 |
| RF19 — Auditoria | RN31 | RNF04, RNF14 | RegistroAuditoria | 10 |
| RF20 — Documentos (referência textual) | — | RNF15 | Documento | 8 |
| RF21 — Reservas de área comum | RN22, RN23 | RNF03 | Reserva | 9 |

## 2. Cobertura

Todos os 21 Requisitos Funcionais têm ao menos uma entidade correspondente nos diagramas de Classes e DER. Regras de Negócio sem vínculo direto a um RF específico (ex.: RN25, RN26 — limites de escopo) funcionam como restrições gerais, já refletidas na [Seção de Escopo](./especificacoes.md#2-escopo). Nenhuma Regra de Negócio ou Requisito Não Funcional ficou sem RF associado; nenhum RF ficou sem RN ou RNF de referência, exceto onde a natureza do requisito é puramente operacional (ex.: RF16–RF18, cujo comportamento decorre dos dados já regidos por outras regras, não de regras próprias).
