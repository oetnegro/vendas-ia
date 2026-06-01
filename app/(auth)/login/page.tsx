import { AuthForm } from '@/components/auth/auth-form'

export const metadata = {
  title: 'Entrar | Vendas+IA App',
}

export default function LoginPage() {
  return <AuthForm mode="login" />
}
