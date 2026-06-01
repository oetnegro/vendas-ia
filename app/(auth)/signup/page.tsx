import { AuthForm } from '@/components/auth/auth-form'

export const metadata = {
  title: 'Criar conta | Vendas+IA App',
}

export default function SignupPage() {
  return <AuthForm mode="signup" />
}
