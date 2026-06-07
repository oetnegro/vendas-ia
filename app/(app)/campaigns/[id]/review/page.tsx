import { CampaignReview } from '@/components/campaigns/campaign-review'

export const metadata = {
  title: 'Campaign Review | Vendas+IA',
}

export default async function CampaignReviewPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params

  return <CampaignReview campaignId={id} />
}
