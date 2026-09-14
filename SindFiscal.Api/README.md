# Camada de API — Sistema de Gestão Financeira (Síndico Profissional)

ASP.NET Core Web API sobre o modelo de dados já validado em `modelagem-tecnica/` (PostgreSQL + EF Core). Este pacote adiciona: autenticação (JWT), autorização por módulo/permissão (RF03), DTOs, controllers REST e os dois serviços de domínio com a lógica de negócio mais sensível do sistema.

## O que foi verificado neste pacote (sem SDK .NET disponível neste ambiente)

Como no pacote de modelagem técnica, **não foi possível compilar** (sem acesso ao SDK .NET). Em vez disso, rodei três varreduras automatizadas sobre todo o código:

1. **Balanceamento de chaves/parênteses** em todos os arquivos — todos batendo.
2. **Cadeias de navegação** usadas nas queries (ex.: `t.ContaOrigem.Nome`, `c.Fornecedor.Nome`, `p.Compromisso.CondominioId`) conferidas contra as propriedades realmente declaradas nas entidades do pacote `modelagem-tecnica/dotnet/Entities`.
3. **Contagem de argumentos** de toda chamada `new XxxResponse(...)` conferida contra a definição de cada `record` em `Dtos/` — pega o tipo de erro mais comum ao popular DTOs manualmente (parâmetro esquecido ou fora de ordem).

Isso já pegou e corrigiu, durante a escrita:
- Um erro de precedência de operador (`await x.FindAsync(...)!` não faz o que parece — o `!` se aplica à `Task`, não ao resultado). Corrigido para `?? throw` em todos os casos.
- Um atributo com sintaxe de argumento nomeado errada (`NivelPermissao: ...` usando o nome do tipo em vez do nome do parâmetro).
- Uma comparação inválida `DateTimeOffset >= DateTime` no relatório de prestação de contas.

**Ainda assim, isso não substitui `dotnet build`.** Rode a build real no seu ambiente como primeiro passo antes de qualquer outra coisa.

## Estrutura

```
api/
  Program.cs                    # composition root: DbContext, JWT, autorização, Swagger
  Autorizacao/
    Modulos.cs                  # códigos dos 11 módulos (RF03 §1.1)
    RequerPermissaoAttribute.cs # filtro de autorização por módulo/condomínio/nível
    HttpContextExtensions.cs
  Services/
    AreaDeAcertoService.cs      # RF14 — o coração do sistema: reposição, aporte, destinação de receita
    FilaExecucaoService.cs      # RF13 — fila de execução manual (RN11)
  Dtos/                         # um arquivo por módulo/entidade
  Controllers/                  # um controller por módulo/entidade
```

## Autorização (RF03)

`[RequerPermissao(Modulos.X, NivelPermissao.Editar)]` em cada endpoint escrito; leitura usa o default `NivelPermissao.Visualizar`. A regra de negócio "síndico tem acesso pleno aos próprios condomínios, sem precisar de linha em `Permissao`" está implementada diretamente no filtro — colaboradores e conselheiros fiscais sempre dependem de uma linha em `Permissao`.

Dois controllers **não** usam `[RequerPermissao]` porque suas rotas não são aninhadas em `/condominios/{condominioId}`: `FornecedorController` (RF08 — fornecedor é do síndico, não do condomínio, RN04) e `AuthController` (login, `[AllowAnonymous]`). `FornecedorController` faz a checagem de dono inline.

## Pacotes NuGet adicionais (além dos já listados em `modelagem-tecnica/README.md`)

```
Microsoft.AspNetCore.Authentication.JwtBearer
Swashbuckle.AspNetCore          (Swagger/OpenAPI)
```

`appsettings.json` esperado (valores de exemplo):
```json
{
  "ConnectionStrings": { "Default": "Host=localhost;Database=sindico;Username=...;Password=..." },
  "Jwt": { "ChaveSecreta": "<mínimo 32 caracteres>", "Emissor": "sindico-api", "Audiencia": "sindico-app" }
}
```

## O que é lógica de negócio de verdade vs. CRUD mecânico

Vale sua atenção especial em dois arquivos, não no resto:

- **`Services/AreaDeAcertoService.cs`** — os três motivos (reposição, aporte, destinação de receita) têm gatilhos diferentes e são implementados como três métodos distintos, deliberadamente não unificados. `AcumularAportePeriodoAsync` tem um ponto em aberto de produto documentado no próprio código: a base de cálculo do aporte percentual ("percentual de quê?") ainda não foi fechada com o cliente.
- **`Services/FilaExecucaoService.cs`** — propositalmente simples (RN11: sem critério automático nesta fase).

O resto (`Controllers/`) é majoritariamente CRUD mapeado 1:1 aos RFs, sem surpresas — a exceção é `DecisaoController.Registrar`, que gera o `CompromissoFinanceiro` automaticamente quando `Resultado = Aprovado` (RF09 → RF10), e `PagamentoController.Registrar`, que chama `AreaDeAcertoService` logo após salvar (RN19).

## O que fica fora deste pacote

- Hash de senha real (`AuthController` tem um placeholder explícito, comentado no código — não usar em produção).
- Interceptor de auditoria automática (implementado nesta rodada — ver `Services/AuditoriaSaveChangesInterceptor.cs`, registrado em `Program.cs` via `AddInterceptors`, e `Controllers/AuditoriaController.cs` para leitura).
- Testes automatizados (unitários/integração).
- Upload de arquivo real (RF20 — decisão de escopo já registrada na Especificação).
- Estrutura de configuração de API por administradora (RF15 — aguardando levantamento de custo/cobertura).
