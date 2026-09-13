import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '@/stores/authStore'
import { useState } from 'react'

const schema = z.object({
  email: z.string().email('E-mail inválido'),
  senha: z.string().min(1, 'Informe a senha'),
})

type FormData = z.infer<typeof schema>

export function LoginPage() {
  const navigate = useNavigate()
  const setAuth = useAuthStore((s) => s.setAuth)
  const [erro, setErro] = useState<string | null>(null)

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
      // Placeholder até AuthController real estar estável.
      // Em produção: POST /auth/login → { token, usuario, permissoes }
      if (data.email && data.senha) {
        setAuth(
          'dev-token-placeholder',
          {
            id: '1',
            nome: 'Síndico Demo',
            email: data.email,
            papel: 'sindico',
          },
          [],
        )
        navigate('/', { replace: true })
      }
    } catch {
      setErro('Falha no login. Verifique as credenciais.')
    }
  }

  return (
    <div className="auth-page">
      <form className="auth-card" onSubmit={handleSubmit(onSubmit)} noValidate>
        <div>
          <h1>SindFiscal</h1>
          <p>Gestão financeira e administrativa para síndico profissional</p>
        </div>

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

        <button
          type="submit"
          className="btn btn-primary"
          disabled={isSubmitting}
        >
          {isSubmitting ? 'Entrando…' : 'Entrar'}
        </button>

        <p className="muted" style={{ textAlign: 'center' }}>
          Modo dev: qualquer e-mail/senha entra como síndico.
        </p>
      </form>
    </div>
  )
}
