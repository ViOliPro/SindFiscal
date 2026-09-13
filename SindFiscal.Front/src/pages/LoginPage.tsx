import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '@/stores/authStore'
import { useState } from 'react'
import { login, bootstrap } from '@/services/api'
import { ApiError } from '@/lib/api'

const schema = z.object({
  email: z.string().email('E-mail inválido'),
  senha: z.string().min(1, 'Informe a senha'),
})

type FormData = z.infer<typeof schema>

export function LoginPage() {
  const navigate = useNavigate()
  const setAuth = useAuthStore((s) => s.setAuth)
  const [erro, setErro] = useState<string | null>(null)
  const [modoBootstrap, setModoBootstrap] = useState(false)
  const [nomeBootstrap, setNomeBootstrap] = useState('')

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
  })

  async function onSubmit(data: FormData) {
    setErro(null)
    try {
      const res = modoBootstrap
        ? await bootstrap(nomeBootstrap || 'Síndico', data.email, data.senha)
        : await login(data.email, data.senha)

      setAuth(res.token, {
        id: res.usuario.id,
        nome: res.usuario.nome,
        email: res.usuario.email,
        papel: res.usuario.papel,
      }, [])
      navigate('/', { replace: true })
    } catch (e) {
      if (e instanceof ApiError && e.status === 0) {
        setAuth(
          'dev-token-offline',
          {
            id: 'dev',
            nome: 'Síndico (offline)',
            email: data.email,
            papel: 'sindico',
          },
          [],
        )
        navigate('/', { replace: true })
        return
      }
      const msg =
        e instanceof ApiError
          ? e.message
          : 'Não foi possível conectar à API. Verifique se o backend está no ar.'
      setErro(msg)
    }
  }

  return (
    <div className="auth-page">
      <form className="auth-card" onSubmit={handleSubmit(onSubmit)} noValidate>
        <div>
          <h1>SindFiscal</h1>
          <p>Gestão financeira e administrativa para síndico profissional</p>
        </div>

        {modoBootstrap && (
          <div className="form-field">
            <label htmlFor="nome">Nome</label>
            <input
              id="nome"
              value={nomeBootstrap}
              onChange={(e) => setNomeBootstrap(e.target.value)}
              placeholder="Seu nome"
            />
          </div>
        )}

        <div className="form-field">
          <label htmlFor="email">E-mail</label>
          <input
            id="email"
            type="email"
            autoComplete="username"
            placeholder="seu@email.com"
            {...register('email')}
          />
          {errors.email && (
            <span className="error-text">{errors.email.message}</span>
          )}
        </div>

        <div className="form-field">
          <label htmlFor="senha">Senha</label>
          <input
            id="senha"
            type="password"
            autoComplete="current-password"
            {...register('senha')}
          />
          {errors.senha && (
            <span className="error-text">{errors.senha.message}</span>
          )}
        </div>

        {erro && <p className="error-text">{erro}</p>}

        <button type="submit" className="btn btn-primary" disabled={isSubmitting}>
          {isSubmitting
            ? 'Aguarde…'
            : modoBootstrap
              ? 'Criar primeiro síndico'
              : 'Entrar'}
        </button>

        <button
          type="button"
          className="btn btn-ghost"
          onClick={() => setModoBootstrap((v) => !v)}
        >
          {modoBootstrap
            ? 'Já tenho conta — voltar ao login'
            : 'Primeiro acesso? Criar síndico (bootstrap)'}
        </button>
      </form>
    </div>
  )
}
