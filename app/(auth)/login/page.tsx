import { AuthForm } from '@/components/auth/auth-form'

export const metadata = {
  title: 'Sign In | Vendas+IA',
}

export default function LoginPage() {
  return <AuthForm mode="login" />
}
