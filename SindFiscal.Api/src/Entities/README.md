# Modelagem Técnica — Sistema de Gestão Financeira (Síndico Profissional)

Este pacote traduz o conjunto de especificação (Especificações, Requisitos Funcionais, Requisitos Não Funcionais, Matriz de Rastreabilidade) em um modelo técnico executável: schema físico PostgreSQL + entidades C#/.NET (Entity Framework Core).

**Este schema foi criado e validado rodando de fato contra um PostgreSQL 16** (não é apenas texto revisado à mão) — ver "Validação" abaixo. As entidades C# não puderam ser compiladas neste ambiente (sem SDK .NET disponível), mas foram conferidas por script automatizado: toda referência de navegação `HasOne`/`WithMany` bate com as propriedades declaradas, e os 19 enums batem, valor a valor, com os `CHECK constraints` do banco.

## Estrutura

```
modelagem/
  database/
    schema.sql              # DDL completo, comentado, pronto para rodar num Postgres novo
  dotnet/
    Enums.cs                 # 19 enums de negócio (um por coluna text+CHECK do schema)
    Conversoes/
      SnakeCaseEnumConverter.cs   # converte PascalCase (C#) <-> snake_case (banco)
    Entities/                # uma classe por tabela (17 entidades + 2 tabelas de junção)
    AppDbContext.cs           # DbContext com Fluent API — mapeia entidades -> tabelas
```

## Convenções adotadas

- **Chaves primárias:** `uuid` (`gen_random_uuid()`), pensando em múltiplos condomínios/tenants sem expor sequência incremental.
- **Nomenclatura:** snake_case em português no banco (`conta_bancaria`, `valor_aprovado`), PascalCase em português no C# (`ContaBancaria`, `ValorAprovado`) — espelhando os nomes já usados na Especificação e nos diagramas conceituais, para não exigir tradução mental entre documento e código.
- **Dinheiro:** sempre `numeric(14,2)` / `decimal` — nunca `float`/`double`.
- **Enums de negócio fechados** (ex.: `papel`, `status`, `motivo`): modelados como `text` + `CHECK constraint` no banco (não `ENUM` nativo do Postgres), para permitir adicionar um valor novo com uma migration simples, sem `ALTER TYPE`. No C#, isso vira um `enum` real, convertido via `SnakeCaseEnumConverter`.
- **Auditoria (RF19/RNF14):** `registro_auditoria` é uma tabela somente-INSERT. Recomenda-se `REVOKE UPDATE, DELETE ON registro_auditoria FROM <role_da_aplicação>` para reforçar a imutabilidade a nível de banco, além da regra de negócio.
- **Associações polimórficas** (`documento`, `registro_auditoria` apontando para várias tabelas via `entidade_tipo` + `entidade_id`): implementadas **sem foreign key**, com `CHECK` restringindo os tipos válidos quando a lista é fechada (`documento`). A integridade referencial nesse caso é responsabilidade da camada de aplicação — é o padrão pragmático mais comum para esse tipo de relação em bancos relacionais.
- **Gastos vinculados (RF12):** `compromisso_financeiro.compromisso_pai_id` é uma auto-relação (FK para a própria tabela), com `ON DELETE RESTRICT`.
- **Área de acerto consolidando múltiplos itens (RN17, RN23):** duas tabelas de junção N:N — `transferencia_pagamento` e `transferencia_reserva` — permitem que uma única transferência cubra vários pagamentos de reposição ou várias reservas do período.
- **Conta operacional única por condomínio:** garantida por um índice único parcial (`WHERE eh_conta_operacional`), não apenas por regra de aplicação.

## Pacotes NuGet esperados

```
Npgsql.EntityFrameworkCore.PostgreSQL
EFCore.NamingConventions
```

Setup no composition root (`Program.cs`):

```csharp
services.AddDbContext<AppDbContext>(opt => opt
    .UseNpgsql(connectionString)
    .UseSnakeCaseNamingConvention());
```

O pacote `EFCore.NamingConventions` converte automaticamente nomes de **propriedades e tabelas configuradas implicitamente** para snake_case; como o schema usa nomes de **tabela no singular**, cada entidade ainda chama `ToTable("nome_singular")` explicitamente no `AppDbContext` para casar exatamente com `schema.sql`.

## Como aplicar

**Opção recomendada nesta fase — rodar o DDL diretamente:**
```bash
psql -h <host> -U <usuario> -d <database> -f database/schema.sql
```

**Alternativa — gerar migration do EF Core a partir das entidades** (uma vez que o projeto .NET estiver criado e o pacote acima instalado):
```bash
dotnet ef migrations add InitialCreate
dotnet ef database update
```
Ambos os caminhos devem convergir para o mesmo schema — `schema.sql` é a referência autoritativa nesta fase; se a migration gerada pelo EF divergir em algum ponto (nomes de constraint, índice parcial, `CHECK` composto), ajuste a migration manualmente para casar com `schema.sql`, não o contrário.

## Validação já realizada

- ✅ `schema.sql` executado do zero contra PostgreSQL 16 real — todas as tabelas, índices e constraints foram criados sem erro.
- ✅ Teste funcional: inserção de condomínio, contas, compromisso "pai" com gasto "filho" vinculado, e transferência com motivo válido — todos funcionaram como esperado.
- ✅ Constraint de conta operacional única por condomínio: testada e confirmada (segunda tentativa de INSERT rejeitada corretamente).
- ✅ Constraint de motivo de transferência inválido: testada e confirmada (rejeitada corretamente).
- ✅ Constraint de conta origem = conta destino: testada e confirmada (rejeitada corretamente).
- ✅ Dois bugs de `varchar(N)` menor que o maior valor do `CHECK` foram encontrados e corrigidos durante os testes (`finalidade` e `transferencia.origem`, ambos precisavam de `varchar(30)`, não `varchar(20)`).
- ✅ Todos os 19 enums C# conferidos programaticamente contra os `CHECK ... IN (...)` do schema — todos batem exatamente, valor a valor.
- ✅ Todas as referências de navegação (`HasOne`/`WithMany`/`WithOne`) no `AppDbContext` conferidas contra as propriedades realmente declaradas nas classes de entidade.
- ⚠️ **Não foi possível compilar o C#** — este ambiente não tem o SDK .NET disponível (rede sem acesso aos domínios da Microsoft). Recomenda-se rodar `dotnet build` no ambiente de desenvolvimento real antes de seguir para a próxima etapa, como primeira verificação.

## Pontos que ficam para a próxima etapa de arquitetura (fora deste pacote)

- Upload real de arquivo (RF20) — quando aprovado, adicionar coluna `arquivo_url`/`arquivo_ref` na tabela `documento` e decidir armazenamento (S3, disco, etc.).
- Estrutura de configuração de API por administradora (RF15) — schema já tem `configuracao_integracao` como ponto de extensão, mas os campos específicos de credencial/endpoint dependem do levantamento de custo/cobertura ainda pendente com o cliente.
- Camada de API (endpoints, autenticação/autorização real, DTOs) — não coberta aqui; este pacote é só o modelo de dados.
- Estratégia de migrations em produção (versionamento, rollback) — este pacote entrega o schema inicial, não uma pipeline de deploy.
