# SindFiscal — Testes de validação e pendências

Rodada de testes manuais · 14/10/2026 · Fase 1 (Fundação) + Gestão de Acessos

## 1. Escopo e premissas

Testes simples, feitos à mão, para validar as páginas que apresentavam bugs ou comportamentos estranhos: **Login, Condomínios, Usuários e Permissões** (esta última agora chamada **Gestão de Acessos**).

- Todos os testes foram feitos com o usuário **síndico**, com acesso total e irrestrito.
- Esta rodada valida se as **funcionalidades** de condomínios, usuários e gestão de acessos funcionam bem. Ela **não** valida se as permissões realmente bloqueiam ou liberam o acesso — isso segue pendente (ver seção 6).
- Credenciais e token de teste foram omitidos deste documento de propósito. Convém trocar a senha de teste e não versionar tokens nem senhas em arquivos do repositório.

## 2. Resumo

- **Login:** OK.
- **Condomínios:** listar, criar (com CNPJ único) e desativar OK. Editar e visualizar desativados pendentes.
- **Usuários:** listar e criar OK após correção. Vínculo entre colaborador e síndico pendente.
- **Gestão de Acessos:** modelos, aplicação em lote, matriz e cards OK. Teste de bloqueio real das permissões pendente.

## 3. Resultados dos testes

### 3.1 Login

- Login como síndico: **sucesso**. A resposta traz o token JWT e os dados do usuário (id, nome, e-mail, papel `sindico`, ativo).

### 3.2 Condomínios

**Antes das correções**

- Listar: OK.
- Criar: OK.
- Excluir: não existia (a sugestão era um soft delete).
- Editar: não existia.
- **Bug:** só havia o nome no cadastro, então era possível criar dois condomínios com o mesmo nome. Pode haver nomes iguais na prática, por isso o diferenciador deve ser o CNPJ, único.
- Observação: o cadastro tinha apenas o nome; avaliar se vale incluir outros dados.

**Depois das correções**

- O condomínio agora cria e lista **nome + CNPJ**.
- Não é possível criar dois condomínios com o mesmo CNPJ.
- O botão **Desativar** (soft delete) funciona.
- As permissões respeitam apenas os condomínios ativos.

### 3.3 Usuários

**Antes das correções**

- Listar: mostrava apenas o síndico.
- Criar: **quebrava**, porque `senha_hash` estava como UNIQUE no banco.
- Não havia vínculo entre usuário e condomínios.
- As permissões não puderam ser testadas, porque os usuários não carregavam.

**Depois das correções**

- A listagem mostra todos os usuários. No banco de teste há 5: 1 síndico e 4 colaboradores.
- Estado inicial das permissões: nenhuma cadastrada, nem para o síndico (o síndico não precisa de linha de permissão nos próprios condomínios).
- A tela de permissões passou a listar todos os usuários.

### 3.4 Permissões → Gestão de Acessos

**Problema de UX identificado:** com 20 condomínios, o síndico gastaria muito tempo atribuindo permissão por permissão, condomínio por condomínio. Exemplo de caso real: o colaborador Vinicius edita todos os módulos em todos os condomínios, exceto Contas e Lançamentos, onde apenas visualiza.

**Solução implementada:** página de Gestão de Acessos com matriz por colaborador, modelos de acesso e aplicação em lote.

Validado nesta rodada:

- Criar um usuário redireciona automaticamente para a página de gestão de acessos.
- Modelos de acesso funcionam perfeitamente.
- Copiar acessos de um modelo funciona perfeitamente.
- Marcar todos os condomínios funciona.
- O clique para alternar entre "—", "Ver" e "Editar" funciona bem.
- Os cards de colaboradores, condomínios e usuários sem permissão funcionam bem.
- As permissões respeitam os condomínios ativos.

## 4. Bugs encontrados e status

- Dois condomínios com o mesmo nome e sem diferenciador → **corrigido** (CNPJ opcional, único quando informado).
- Criação de usuário quebrava por `senha_hash` UNIQUE → **corrigido** (migration remove a unicidade e a coluna fica nullable).
- Lista de usuários mostrava só o síndico → **corrigido**.
- Tela de permissões não carregava usuários → **corrigido**.
- Atribuição de permissões lenta, uma a uma → **resolvido** com a Gestão de Acessos.
- Desativar condomínio funciona, mas não há onde ver ou reativar os desativados → **pendente**.

## 5. Correções e melhorias já entregues

- CNPJ no cadastro de condomínio, com índice único parcial e soft delete (campo `ativo`).
- Migration de `senha_hash` e CNPJ aplicada.
- Listagem completa de usuários, incluindo recém-criados sem nenhuma permissão.
- Gestão de Acessos: visão geral com cards, matriz condomínios × módulos, aplicação em lote (modelo ou cópia de outro condomínio) e modelos Consulta, Operacional e Gestor.
- Regras centralizadas de concessão: Auditoria sempre somente leitura, Conselho Fiscal somente leitura, apenas módulos válidos e delegáveis.

## 6. Pendências

### Prioridade alta

- **Testar o bloqueio real das permissões.** Logar como colaborador e verificar: 403 em módulos sem acesso, diferença entre Visualizar e Editar nos controllers e o isolamento entre condomínios.
- **Carregar as permissões do colaborador no login do front.** Hoje o login chama `setAuth(..., [])`, então `hasPermissao` não filtra menu nem telas para colaborador. O back-end protege, mas a interface não esconde o que ele não pode usar.
- **Vincular o colaborador ao síndico.** Hoje o usuário não pertence a um síndico, e a lista de "recém-criados sem permissão" é global. Com mais de um síndico, um veria os colaboradores do outro. Solução prevista: campo `criado_por_id` (ou equivalente) em `usuario`, com migration e preenchimento dos existentes.
- **Segurança de senha.** Trocar o hash SHA256 com salt fixo por bcrypt ou argon2 antes de produção.

### Prioridade média

- **Condomínios desativados:** tela para listar (a API já aceita `incluirInativos`) e reativar (já existe `reativarCondominio` no serviço do front). Definir o que acontece com as permissões ao desativar; hoje elas ficam preservadas e a matriz as ignora.
- **Editar condomínio:** falta a tela. O serviço de atualização já existe no front.
- **Dados do cadastro de condomínio:** avaliar quais campos adicionais fazem sentido (hoje só nome e CNPJ).
- **Modelos padrão:** validar com a síndica os níveis sugeridos de Consulta, Operacional e Gestor.
- **Aviso de alterações não salvas ao navegar dentro do app.** Hoje o aviso cobre só fechar ou recarregar a aba. Precisa de um roteador de dados do React Router, ou de outra abordagem.

### Prioridade baixa / técnica

- **Erros de tipagem anteriores a esta rodada:** `AppShell` (assinatura do `queryFn` de condomínios), import não usado em `ContasPage`, e `DocumentosPage` e `ReservasPage` importando funções que não existem em `services/api` (listar, registrar e atualizar documentos; listar, registrar e fechar período de reservas).
- **tsconfig:** `ignoreDeprecations: "6.0"` é rejeitado pelo TypeScript 5.8.3 fixado no `yarn.lock`. Alinhar a versão do TypeScript ou remover a opção.
- **Aplicar acessos a vários colaboradores ao mesmo tempo:** hoje o lote é por colaborador (vários condomínios de uma vez). Avaliar se vale a pena.
- **Testes automatizados** dos fluxos de acesso (prioridade baixa, alinhada ao plano de Playwright).

## 7. Sequência sugerida

1. Teste de bloqueio real das permissões, com colaborador logado.
2. Permissões carregadas no login do front e menu filtrado por permissão.
3. Vínculo colaborador ↔ síndico e migration.
4. Tela de condomínios desativados, reativação e edição.
5. Troca do hash de senha.
6. Retomar a Fase 2 (Necessidades, Cotações e Fornecedores).
