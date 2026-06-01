import { CadenceEditor } from '@/components/campaigns/cadence-editor'

export const metadata = {
  title: 'Cadencia | Vendas+IA App',
}

export default async function CampaignCadencePage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params

  return <CadenceEditor campaignId={id} />
}
