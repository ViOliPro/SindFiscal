import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect, useMemo, useState } from "react";
import {
  ajustarValorCompromisso,
  adiarCompromisso,
  cancelarCompromisso,
  concluirCompromisso,
  criarCompromissoAvulso,
  entrarNaFila,
  iniciarExecucao,
  listarCompromissos,
  listarCotacoes,
  listarDecisoes,
  listarNecessidades,
  obterCompromisso,
  registrarDecisao,
  vincularGasto,
} from "@/services/api";
import {
  PRIORIDADE_LABEL,
  RESULTADO_DECISAO_LABEL,
  SITUACAO_NECESSIDADE_LABEL,
  STATUS_COMPROMISSO_LABEL,
  type ResultadoDecisao,
  type SituacaoNecessidade,
  type StatusCompromisso,
} from "@/types";
import { useCondominioStore } from "@/stores/condominioStore";
import { ApiError } from "@/lib/api";

function formatMoney(v: number) {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

const avulsoSchema = z.object({
  categoria: z.string().min(2, "Informe a categoria"),
  valorAprovado: z.coerce.number().min(0, "Valor não pode ser negativo"),
});
type AvulsoForm = z.infer<typeof avulsoSchema>;

const gastoSchema = z.object({
  categoria: z.string().min(2, "Informe a categoria"),
  valor: z.coerce.number().positive("Valor deve ser positivo"),
});
type GastoForm = z.infer<typeof gastoSchema>;

const ajusteSchema = z.object({
  novoValor: z.coerce.number().min(0, "Valor não pode ser negativo"),
  motivo: z.string().min(3, "Motivo é obrigatório (RN09)"),
});
type AjusteForm = z.infer<typeof ajusteSchema>;

const decisaoSchema = z.object({
  necessidadeId: z.string().min(1, "Selecione a necessidade"),
  cotacaoEscolhidaId: z.string().optional(),
  resultado: z.enum(["aprovado", "reprovado", "adiado"]),
  justificativa: z.string().optional(),
  referenciaRespaldo: z.string().optional(),
  data: z.string().min(1),
});
type DecisaoForm = z.infer<typeof decisaoSchema>;

/** Situações em que ainda faz sentido registrar decisão. */
const SITUACOES_DECIDIVEIS: SituacaoNecessidade[] = [
  "em_analise",
  "em_orcamento",
  "adiado",
];

function ErroApi({ error }: { error: unknown }) {
  if (!error) return null;
  const msg =
    typeof error === "string"
      ? error
      : error instanceof ApiError
        ? error.message
        : "Erro inesperado.";
  return (
    <p
      className="muted"
      style={{ color: "var(--color-danger, #c0392b)", fontSize: "0.85rem" }}
    >
      {msg}
    </p>
  );
}

function badgeStatus(status: StatusCompromisso) {
  return (
    <span className="badge">{STATUS_COMPROMISSO_LABEL[status] ?? status}</span>
  );
}

/** Painel expansível de detalhe de um compromisso: gastos vinculados, pagamentos e ações. */
function DetalheCompromisso({
  condominioId,
  compromissoId,
}: {
  condominioId: string;
  compromissoId: string;
}) {
  const qc = useQueryClient();

  const detalheQ = useQuery({
    queryKey: ["compromisso", condominioId, compromissoId],
    queryFn: () => obterCompromisso(condominioId, compromissoId),
  });

  const invalidarTudo = () => {
    qc.invalidateQueries({ queryKey: ["compromissos", condominioId] });
    qc.invalidateQueries({
      queryKey: ["compromisso", condominioId, compromissoId],
    });
  };

  const gastoForm = useForm<GastoForm>({ resolver: zodResolver(gastoSchema) });
  const vincularM = useMutation({
    mutationFn: (d: GastoForm) => vincularGasto(condominioId, compromissoId, d),
    onSuccess: () => {
      invalidarTudo();
      gastoForm.reset();
    },
  });

  const ajusteForm = useForm<AjusteForm>({
    resolver: zodResolver(ajusteSchema),
  });
  const ajustarM = useMutation({
    mutationFn: (d: AjusteForm) =>
      ajustarValorCompromisso(
        condominioId,
        compromissoId,
        d.novoValor,
        d.motivo,
      ),
    onSuccess: () => {
      invalidarTudo();
      ajusteForm.reset();
    },
  });

  const cancelarM = useMutation({
    mutationFn: () =>
      cancelarCompromisso(
        condominioId,
        compromissoId,
        "Cancelado pelo síndico",
      ),
    onSuccess: invalidarTudo,
  });

  const entrarFilaM = useMutation({
    mutationFn: () => entrarNaFila(condominioId, compromissoId),
    onSuccess: invalidarTudo,
  });

  const adiarM = useMutation({
    mutationFn: () => adiarCompromisso(condominioId, compromissoId),
    onSuccess: invalidarTudo,
  });
  const iniciarM = useMutation({
    mutationFn: () => iniciarExecucao(condominioId, compromissoId),
    onSuccess: invalidarTudo,
  });
  const concluirM = useMutation({
    mutationFn: () => concluirCompromisso(condominioId, compromissoId),
    onSuccess: invalidarTudo,
  });

  if (detalheQ.isLoading) return <p className="muted">Carregando detalhe…</p>;
  if (!detalheQ.data) return null;

  const { compromisso, gastosVinculados, pagamentos } = detalheQ.data;
  const podeAjustarOuCancelar =
    compromisso.status !== "cancelado" && compromisso.status !== "concluido";
  const ehGastoVinculado = compromisso.compromissoPaiId !== null;

  return (
    <div
      style={{
        marginTop: "0.5rem",
        padding: "1rem",
        background: "var(--color-bg)",
        borderRadius: "var(--radius)",
        border: "1px solid var(--color-border)",
        display: "flex",
        flexDirection: "column",
        gap: "1rem",
      }}
    >
      <div
        style={{
          display: "flex",
          gap: "2rem",
          flexWrap: "wrap",
          fontSize: "0.85rem",
        }}
      >
        <span>
          Gastos vinculados:{" "}
          <strong>{formatMoney(compromisso.totalGastosVinculados)}</strong>
        </span>
        <span>
          Total pago: <strong>{formatMoney(compromisso.totalPago)}</strong>
        </span>
        <span>
          Saldo remanescente:{" "}
          <strong>{formatMoney(compromisso.saldoRemanescente)}</strong>
        </span>
        {compromisso.requerValidacaoConselho && (
          <span
            className="badge"
            title="Valor atinge a alçada configurada para este condomínio (RF10/RN07)"
          >
            requer validação do Conselho Fiscal
          </span>
        )}
      </div>

      {gastosVinculados.length > 0 && (
        <div>
          <p
            className="muted"
            style={{ fontSize: "0.8rem", marginBottom: "0.35rem" }}
          >
            Gastos vinculados (RF12)
          </p>
          <ul style={{ margin: 0, paddingLeft: "1.1rem", fontSize: "0.85rem" }}>
            {gastosVinculados.map((g) => (
              <li key={g.id}>
                {g.categoria} — {formatMoney(g.valor)} (
                {STATUS_COMPROMISSO_LABEL[g.status]})
              </li>
            ))}
          </ul>
        </div>
      )}

      {pagamentos.length > 0 && (
        <div>
          <p
            className="muted"
            style={{ fontSize: "0.8rem", marginBottom: "0.35rem" }}
          >
            Pagamentos (RF11)
          </p>
          <ul style={{ margin: 0, paddingLeft: "1.1rem", fontSize: "0.85rem" }}>
            {pagamentos.map((p) => (
              <li key={p.id}>
                {p.data} — {p.tipo} — {formatMoney(p.valor)}
              </li>
            ))}
          </ul>
        </div>
      )}

      {!ehGastoVinculado && podeAjustarOuCancelar && (
        <form
          onSubmit={gastoForm.handleSubmit((d) => vincularM.mutate(d))}
          style={{
            display: "grid",
            gap: "0.6rem",
            gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
            alignItems: "end",
          }}
        >
          <div className="form-field">
            <label>Vincular gasto — categoria</label>
            <input
              {...gastoForm.register("categoria")}
              placeholder="Ex.: Material extra"
            />
          </div>
          <div className="form-field">
            <label>Valor</label>
            <input type="number" step="0.01" {...gastoForm.register("valor")} />
          </div>
          <button
            type="submit"
            className="btn btn-ghost"
            disabled={vincularM.isPending}
          >
            Vincular (RF12)
          </button>
          <ErroApi error={vincularM.error} />
        </form>
      )}

      {podeAjustarOuCancelar && (
        <form
          onSubmit={ajusteForm.handleSubmit((d) => ajustarM.mutate(d))}
          style={{
            display: "grid",
            gap: "0.6rem",
            gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
            alignItems: "end",
          }}
        >
          <div className="form-field">
            <label>Ajustar valor aprovado</label>
            <input
              type="number"
              step="0.01"
              defaultValue={compromisso.valorAprovado}
              {...ajusteForm.register("novoValor")}
            />
          </div>
          <div className="form-field" style={{ gridColumn: "span 2" }}>
            <label>Motivo (RN09/RN10)</label>
            <input
              {...ajusteForm.register("motivo")}
              placeholder="Ex.: troca de material aprovada em obra"
            />
          </div>
          <button
            type="submit"
            className="btn btn-ghost"
            disabled={ajustarM.isPending}
          >
            Salvar ajuste
          </button>
          <ErroApi error={ajusteForm.formState.errors.motivo?.message} />
          <ErroApi error={ajustarM.error} />
        </form>
      )}

      <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
        {compromisso.status === "aguardando_execucao" && (
          <>
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => entrarFilaM.mutate()}
              disabled={entrarFilaM.isPending}
            >
              Entrar na fila de execução
            </button>
            <button
              type="button"
              className="btn btn-ghost"
              onClick={() => iniciarM.mutate()}
              disabled={iniciarM.isPending}
            >
              Iniciar execução
            </button>
          </>
        )}
        {compromisso.status === "em_fila_execucao" && (
          <>
            <button
              type="button"
              className="btn btn-ghost"
              onClick={() => adiarM.mutate()}
              disabled={adiarM.isPending}
            >
              Adiar (sair da fila)
            </button>
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => iniciarM.mutate()}
              disabled={iniciarM.isPending}
            >
              Iniciar execução
            </button>
          </>
        )}
        {compromisso.status === "em_execucao" && (
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => concluirM.mutate()}
            disabled={concluirM.isPending}
          >
            Concluir
          </button>
        )}
        {(compromisso.status === "em_fila_execucao" ||
          compromisso.status === "em_execucao" ||
          compromisso.status === "aguardando_execucao") && (
          <button
            type="button"
            className="btn btn-ghost"
            onClick={() => concluirM.mutate()}
            disabled={concluirM.isPending}
          >
            Marcar como concluído
          </button>
        )}
        {podeAjustarOuCancelar && (
          <button
            type="button"
            className="btn btn-ghost"
            style={{ color: "var(--color-danger, #c0392b)" }}
            onClick={() => cancelarM.mutate()}
            disabled={cancelarM.isPending}
          >
            Cancelar compromisso (RN12)
          </button>
        )}
      </div>
      <ErroApi error={cancelarM.error} />
      <ErroApi error={adiarM.error} />
      <ErroApi error={iniciarM.error} />
      <ErroApi error={concluirM.error} />
      <ErroApi error={entrarFilaM.error} />
    </div>
  );
}

function rotuloCompromisso(
  c: { categoria: string; necessidadeId: string | null },
  necMap: Map<string, { descricao: string; prioridade: string | null }>,
) {
  if (c.necessidadeId && necMap.has(c.necessidadeId)) {
    return necMap.get(c.necessidadeId)!.descricao;
  }
  return c.categoria;
}

function badgePrioridadeComp(p: string | null | undefined) {
  if (!p || !(p in PRIORIDADE_LABEL)) return null;
  const prioridade = p as "alta" | "media" | "baixa";
  const cor =
    prioridade === "alta"
      ? "#c0392b"
      : prioridade === "media"
        ? "#d68910"
        : "#7f8c8d";
  return (
    <span
      className="badge"
      style={{
        background: cor,
        color: "#fff",
        fontSize: "0.7rem",
        flexShrink: 0,
      }}
    >
      {PRIORIDADE_LABEL[prioridade]}
    </span>
  );
}

const PAGE_SIZE = 15;
type FiltroCompromisso = StatusCompromisso | "ativos" | "";

const FILTROS_COMPROMISSO: { id: FiltroCompromisso; label: string }[] = [
  { id: "ativos", label: "Ativos" },
  { id: "aguardando_execucao", label: "Aguardando" },
  { id: "em_fila_execucao", label: "Em fila" },
  { id: "em_execucao", label: "Em execução" },
  { id: "concluido", label: "Concluídos" },
  { id: "cancelado", label: "Cancelados" },
  { id: "", label: "Todos" },
];

function PainelCompromissos({ condominioId }: { condominioId: string }) {
  const qc = useQueryClient();
  const [filtroStatus, setFiltroStatus] = useState<FiltroCompromisso>("ativos");
  const [expandidoId, setExpandidoId] = useState<string | null>(null);
  const [pagina, setPagina] = useState(0);

  const statusApi =
    filtroStatus === "ativos" || filtroStatus === "" ? undefined : filtroStatus;

  const compromissosQ = useQuery({
    queryKey: ["compromissos", condominioId, filtroStatus],
    queryFn: () => listarCompromissos(condominioId, statusApi),
  });

  const necQ = useQuery({
    queryKey: ["necessidades", condominioId],
    queryFn: () => listarNecessidades(condominioId),
  });

  const necMap = useMemo(() => {
    const m = new Map<
      string,
      { descricao: string; prioridade: string | null }
    >();
    for (const n of necQ.data ?? [])
      m.set(n.id, { descricao: n.descricao, prioridade: n.prioridade ?? null });
    return m;
  }, [necQ.data]);

  const listaBase = useMemo(() => {
    let items = (compromissosQ.data ?? []).filter((c) => !c.compromissoPaiId);
    if (filtroStatus === "ativos") {
      items = items.filter((c) =>
        ["aguardando_execucao", "em_fila_execucao", "em_execucao"].includes(
          c.status,
        ),
      );
    }
    return items;
  }, [compromissosQ.data, filtroStatus]);

  const totalPaginas = Math.max(1, Math.ceil(listaBase.length / PAGE_SIZE));
  const paginaSegura = Math.min(pagina, totalPaginas - 1);
  const paginaItens = listaBase.slice(
    paginaSegura * PAGE_SIZE,
    paginaSegura * PAGE_SIZE + PAGE_SIZE,
  );

  const avulsoForm = useForm<AvulsoForm>({
    resolver: zodResolver(avulsoSchema),
  });
  const criarAvulsoM = useMutation({
    mutationFn: (d: AvulsoForm) => criarCompromissoAvulso(condominioId, d),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["compromissos", condominioId] });
      avulsoForm.reset();
    },
  });

  function mudarFiltro(f: FiltroCompromisso) {
    setFiltroStatus(f);
    setPagina(0);
    setExpandidoId(null);
  }

  return (
    <div
      className="card"
      style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}
    >
      <div>
        <p
          className="muted"
          style={{ fontSize: "0.85rem", marginBottom: "0.5rem" }}
        >
          RN15 — compromisso avulso, sem necessidade formal associada.
        </p>
        <form
          onSubmit={avulsoForm.handleSubmit((d) => criarAvulsoM.mutate(d))}
          style={{
            display: "grid",
            gap: "0.75rem",
            gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
            alignItems: "end",
          }}
        >
          <div className="form-field">
            <label>Categoria / título</label>
            <input
              {...avulsoForm.register("categoria")}
              placeholder="Ex.: Manutenção elevador"
            />
          </div>
          <div className="form-field">
            <label>Valor aprovado</label>
            <input
              type="number"
              step="0.01"
              {...avulsoForm.register("valorAprovado")}
            />
          </div>
          <button
            type="submit"
            className="btn btn-primary"
            disabled={criarAvulsoM.isPending}
          >
            Criar compromisso avulso
          </button>
        </form>
        <ErroApi error={criarAvulsoM.error} />
      </div>

      <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
        {FILTROS_COMPROMISSO.map((f) => (
          <button
            key={f.id || "todos"}
            type="button"
            className={`btn ${filtroStatus === f.id ? "btn-primary" : "btn-ghost"}`}
            onClick={() => mudarFiltro(f.id)}
          >
            {f.label}
          </button>
        ))}
      </div>

      {compromissosQ.isLoading && <p className="muted">Carregando…</p>}
      <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
        {paginaItens.map((c) => {
          const titulo = rotuloCompromisso(c, necMap);
          const necInfo = c.necessidadeId
            ? necMap.get(c.necessidadeId)
            : undefined;
          const mostraCategoriaSec = Boolean(
            c.necessidadeId && titulo !== c.categoria,
          );
          return (
            <div
              key={c.id}
              style={{
                padding: "1rem",
                background: "var(--color-bg)",
                borderRadius: "var(--radius)",
                border: "1px solid var(--color-border)",
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "0.75rem",
                  width: "100%",
                }}
              >
                <div style={{ flex: 1, minWidth: 0, textAlign: "left" }}>
                  <div
                    style={{
                      fontWeight: 600,
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {titulo}
                  </div>
                  <div
                    className="muted"
                    style={{ fontSize: "0.8rem", textAlign: "left" }}
                  >
                    {mostraCategoriaSec && <>{c.categoria} · </>}
                    {formatMoney(c.valorAprovado)}
                    {c.prioridadeFila !== null &&
                      ` · fila #${c.prioridadeFila}`}
                  </div>
                </div>
                <div
                  style={{
                    display: "flex",
                    gap: "0.4rem",
                    alignItems: "center",
                    flexShrink: 0,
                    marginLeft: "auto",
                  }}
                >
                  {badgePrioridadeComp(necInfo?.prioridade)}
                  {badgeStatus(c.status)}
                  <button
                    type="button"
                    className="btn btn-ghost"
                    style={{ fontSize: "0.8rem" }}
                    onClick={() =>
                      setExpandidoId(expandidoId === c.id ? null : c.id)
                    }
                  >
                    {expandidoId === c.id ? "Ocultar" : "Detalhar"}
                  </button>
                </div>
              </div>
              {expandidoId === c.id && (
                <DetalheCompromisso
                  condominioId={condominioId}
                  compromissoId={c.id}
                />
              )}
            </div>
          );
        })}
        {listaBase.length === 0 && !compromissosQ.isLoading && (
          <p className="muted" style={{ padding: "1rem 0" }}>
            Nenhum compromisso neste filtro.
          </p>
        )}
      </div>

      {listaBase.length > PAGE_SIZE && (
        <div
          style={{
            display: "flex",
            gap: "0.5rem",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <button
            type="button"
            className="btn btn-ghost"
            disabled={paginaSegura <= 0}
            onClick={() => setPagina((p) => Math.max(0, p - 1))}
          >
            ← Anterior
          </button>
          <span className="muted" style={{ fontSize: "0.85rem" }}>
            {paginaSegura + 1} / {totalPaginas} ({listaBase.length} itens)
          </span>
          <button
            type="button"
            className="btn btn-ghost"
            disabled={paginaSegura >= totalPaginas - 1}
            onClick={() => setPagina((p) => Math.min(totalPaginas - 1, p + 1))}
          >
            Próxima →
          </button>
        </div>
      )}
    </div>
  );
}

function PainelDecisoes({ condominioId }: { condominioId: string }) {
  const qc = useQueryClient();
  const [necessidadeId, setNecessidadeId] = useState("");

  const necessidadesQ = useQuery({
    queryKey: ["necessidades", condominioId],
    queryFn: () => listarNecessidades(condominioId),
  });

  const cotacoesQ = useQuery({
    queryKey: ["cotacoes", condominioId, necessidadeId],
    queryFn: () => listarCotacoes(condominioId, necessidadeId),
    enabled: !!necessidadeId,
  });

  const decisoesQ = useQuery({
    queryKey: ["decisoes", condominioId, necessidadeId],
    queryFn: () => listarDecisoes(condominioId, necessidadeId),
    enabled: !!necessidadeId,
  });

  const form = useForm<DecisaoForm>({
    resolver: zodResolver(decisaoSchema),
    defaultValues: {
      necessidadeId: "",
      cotacaoEscolhidaId: "",
      resultado: "aprovado",
      data: new Date().toISOString().slice(0, 10),
    },
  });

  const necessidadeSelecionada = form.watch("necessidadeId");
  const resultadoSelecionado = form.watch("resultado");

  useEffect(() => {
    setNecessidadeId(necessidadeSelecionada || "");
  }, [necessidadeSelecionada]);

  const elegiveis =
    necessidadesQ.data?.filter((n) =>
      SITUACOES_DECIDIVEIS.includes(n.situacao),
    ) ?? [];
  const outras =
    necessidadesQ.data?.filter(
      (n) => !SITUACOES_DECIDIVEIS.includes(n.situacao),
    ) ?? [];

  const registrarM = useMutation({
    mutationFn: (d: DecisaoForm) =>
      registrarDecisao(condominioId, d.necessidadeId, {
        cotacaoEscolhidaId: d.cotacaoEscolhidaId || null,
        resultado: d.resultado as ResultadoDecisao,
        justificativa: d.justificativa || undefined,
        referenciaRespaldo: d.referenciaRespaldo || undefined,
        data: d.data,
      }),
    onSuccess: (_, vars) => {
      setNecessidadeId(vars.necessidadeId);
      form.reset({
        necessidadeId: vars.necessidadeId,
        cotacaoEscolhidaId: "",
        resultado: "aprovado",
        data: new Date().toISOString().slice(0, 10),
        justificativa: "",
        referenciaRespaldo: "",
      });
      qc.invalidateQueries({
        queryKey: ["decisoes", condominioId, vars.necessidadeId],
      });
      qc.invalidateQueries({ queryKey: ["compromissos", condominioId] });
      qc.invalidateQueries({ queryKey: ["necessidades", condominioId] });
      qc.invalidateQueries({ queryKey: ["despesas-futuras", condominioId] });
    },
  });

  return (
    <div
      className="card"
      style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}
    >
      <p className="muted" style={{ fontSize: "0.85rem" }}>
        RF09 — decisão como evento histórico imutável (RN09). Aprovar gera
        automaticamente o compromisso financeiro (RF10). Selecione a necessidade
        e, se houver, a cotação escolhida.
      </p>

      <form
        onSubmit={form.handleSubmit((d) => registrarM.mutate(d))}
        style={{
          display: "grid",
          gap: "0.75rem",
          gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
          alignItems: "end",
        }}
      >
        <div className="form-field" style={{ gridColumn: "1 / -1" }}>
          <label>Necessidade</label>
          <select
            className="select-condominio"
            style={{ width: "100%" }}
            {...form.register("necessidadeId", {
              onChange: () => form.setValue("cotacaoEscolhidaId", ""),
            })}
            disabled={necessidadesQ.isLoading}
          >
            <option value="">
              {necessidadesQ.isLoading
                ? "Carregando…"
                : "Selecione uma necessidade"}
            </option>
            {elegiveis.length > 0 && (
              <optgroup label="Aguardando decisão">
                {elegiveis.map((n) => (
                  <option key={n.id} value={n.id}>
                    {n.descricao} — {n.categoria}
                    {n.prioridade
                      ? ` (${PRIORIDADE_LABEL[n.prioridade]})`
                      : ""}{" "}
                    — {SITUACAO_NECESSIDADE_LABEL[n.situacao]}
                  </option>
                ))}
              </optgroup>
            )}
            {outras.length > 0 && (
              <optgroup label="Já decididas / outras">
                {outras.map((n) => (
                  <option key={n.id} value={n.id}>
                    {n.descricao} — {n.categoria} —{" "}
                    {SITUACAO_NECESSIDADE_LABEL[n.situacao]}
                  </option>
                ))}
              </optgroup>
            )}
          </select>
        </div>

        <div className="form-field" style={{ gridColumn: "1 / -1" }}>
          <label>
            Cotação escolhida
            {resultadoSelecionado === "aprovado"
              ? " (recomendada na aprovação)"
              : " (opcional)"}
          </label>
          <select
            className="select-condominio"
            style={{ width: "100%" }}
            {...form.register("cotacaoEscolhidaId")}
            disabled={!necessidadeId || cotacoesQ.isLoading}
          >
            <option value="">
              {!necessidadeId
                ? "Selecione a necessidade primeiro"
                : cotacoesQ.isLoading
                  ? "Carregando cotações…"
                  : cotacoesQ.data?.length
                    ? "Nenhuma (emergencial / sem cotação prévia — RN08)"
                    : "Nenhuma cotação registrada"}
            </option>
            {cotacoesQ.data?.map((c) => (
              <option key={c.id} value={c.id}>
                {c.fornecedorNome} — {formatMoney(c.valor)}
                {c.prazoExecucaoDias != null
                  ? ` — ${c.prazoExecucaoDias} dias`
                  : ""}
                {c.validade ? ` — vál. ${c.validade}` : ""}
              </option>
            ))}
          </select>
          {necessidadeId && cotacoesQ.data && cotacoesQ.data.length > 0 && (
            <p
              className="muted"
              style={{ fontSize: "0.75rem", marginTop: "0.25rem" }}
            >
              {cotacoesQ.data.length} cotação(ões) · menor{" "}
              {formatMoney(Math.min(...cotacoesQ.data.map((c) => c.valor)))} ·
              maior{" "}
              {formatMoney(Math.max(...cotacoesQ.data.map((c) => c.valor)))}
            </p>
          )}
        </div>

        <div className="form-field">
          <label>Resultado</label>
          <select
            className="select-condominio"
            style={{ width: "100%" }}
            {...form.register("resultado")}
          >
            {(Object.keys(RESULTADO_DECISAO_LABEL) as ResultadoDecisao[]).map(
              (r) => (
                <option key={r} value={r}>
                  {RESULTADO_DECISAO_LABEL[r]}
                </option>
              ),
            )}
          </select>
        </div>
        <div className="form-field">
          <label>Data</label>
          <input type="date" {...form.register("data")} />
        </div>
        <div className="form-field">
          <label>Justificativa</label>
          <input
            {...form.register("justificativa")}
            placeholder="Motivo / contexto"
          />
        </div>
        <div className="form-field">
          <label>Referência (ata/assembleia)</label>
          <input
            {...form.register("referenciaRespaldo")}
            placeholder="Ex.: Ata 12/2026"
          />
        </div>
        <button
          type="submit"
          className="btn btn-primary"
          disabled={registrarM.isPending || !necessidadeSelecionada}
        >
          {registrarM.isPending ? "Registrando…" : "Registrar decisão"}
        </button>
      </form>
      <ErroApi error={form.formState.errors.necessidadeId?.message} />
      <ErroApi error={registrarM.error} />

      {necessidadeId && (
        <div>
          <p
            className="muted"
            style={{ fontSize: "0.8rem", marginBottom: "0.5rem" }}
          >
            Histórico de decisões desta necessidade (imutável — RN09)
          </p>
          {decisoesQ.isLoading && <p className="muted">Carregando…</p>}
          <div
            style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}
          >
            {decisoesQ.data?.map((d) => {
              const cot = cotacoesQ.data?.find(
                (c) => c.id === d.cotacaoEscolhidaId,
              );
              return (
                <div
                  key={d.id}
                  style={{
                    padding: "0.75rem",
                    background: "var(--color-bg)",
                    borderRadius: "var(--radius)",
                    border: "1px solid var(--color-border)",
                    fontSize: "0.85rem",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      gap: "0.5rem",
                      flexWrap: "wrap",
                    }}
                  >
                    <strong>{RESULTADO_DECISAO_LABEL[d.resultado]}</strong>
                    <span className="muted">{d.data}</span>
                  </div>
                  {cot && (
                    <p className="muted" style={{ marginTop: "0.25rem" }}>
                      Cotação: {cot.fornecedorNome} — {formatMoney(cot.valor)}
                    </p>
                  )}
                  {d.justificativa && (
                    <p className="muted" style={{ marginTop: "0.25rem" }}>
                      {d.justificativa}
                    </p>
                  )}
                  {d.referenciaRespaldo && (
                    <p className="muted">Ref.: {d.referenciaRespaldo}</p>
                  )}
                </div>
              );
            })}
            {decisoesQ.data?.length === 0 && (
              <p className="muted">
                Nenhuma decisão registrada para esta necessidade ainda.
              </p>
            )}
          </div>
        </div>
      )}

      {!necessidadesQ.isLoading && elegiveis.length === 0 && (
        <p className="muted" style={{ fontSize: "0.85rem" }}>
          Nenhuma necessidade em análise, em orçamento ou adiada. Crie ou avance
          itens em <strong>Necessidades</strong>.
        </p>
      )}
    </div>
  );
}

/** Stub temporário após commit PLACEHOLDER. Aplicar patch sindfiscal-decisoes-align-2026-10-16.zip */
export function CompromissosPage() {
  const condominioId = useCondominioStore((s) => s.condominioAtivoId);
  return (
    <div>
      <header className="page-header">
        <h1>Decisões e Compromissos</h1>
        <p>
          Aplique o patch <code>sindfiscal-decisoes-align-2026-10-16.zip</code>{" "}
          em <code>src/pages/CompromissosPage.tsx</code> (aba Decisões alinhada
          com selects).
        </p>
      </header>
      {!condominioId && (
        <p className="muted">Selecione um condomínio no topo.</p>
      )}
    </div>
  );
}
